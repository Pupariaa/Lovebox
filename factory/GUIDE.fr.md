# Guide factory — build, flash, OTA, versionnage

Documentation de référence pour la production et le développement firmware Boîte à cœur (BaC).

## Sommaire

1. [Prérequis](#prerequis)
2. [Versionnage](#versionnage)
3. [Arborescence et fichiers clés](#arborescence-et-fichiers-clés)
4. [Release OTA (sans boîte)](#release-ota-sans-boîte)
5. [Provision sur boîte (USB)](#provision-sur-boîte-usb)
6. [Modes de re-flash sur boîte existante](#modes-de-re-flash-sur-boîte-existante)
7. [Test firmware direct USB (sans OTA cloud)](#test-firmware-direct-usb-sans-ota-cloud)
8. [Test OTA sur une seule boîte](#test-ota-sur-une-seule-boîte)
9. [Traçabilité et archives](#traceabilite-et-archives)
10. [Variables d'environnement](#variables-denvironnement)
11. [Dépannage](#depannage)

---

## Prérequis

```powershell
cd factory
.\setup_tools.ps1
pip install -r requirements.txt
```

- **arduino-cli** dans le PATH
- Bibliothèque **Lucarne** (repo voisin ou dossier libraries Arduino)
- **esptool** via le core ESP32 Arduino (utilise automatiquement par la factory)
- Cable USB sur la BaC (mode CDC, port `BAC-XS3` ou `BAC-XS3 <serial>`)

---

## Versionnage

### Source de vérité

| Fichier | Rôle |
|---------|------|
| `factory/VERSION` | Version cible pour build factory / release (ex. `1.0.21`) |
| `firmware/boite-a-coeur/BacFirmware.h` | `#define BAC_FW_VERSION` — patche temporairement a la compilation, puis restaure |

Les scripts `provision.py` et `release.py` lisent `factory/VERSION` par defaut. Option `--version X.Y.Z` pour forcer une version ponctuelle sans modifier le fichier.

### Règles

- Format accepte : `MAJOR.MINOR.PATCH` avec suffixe optionnel (`1.0.22-beta`)
- À chaque build, `compile_sketch()` écrit `BAC_FW_VERSION` dans `BacFirmware.h`, compile, puis restaure le fichier git
- La version affichée sur la BaC, dans les logs `@BAC PING`, et signalée au serveur OTA provient de cette macro
- **Incrémenter `factory/VERSION`** avant une release destinée aux utilisateurs

### Bump de version typique

```powershell
# Option A : éditer factory/VERSION a la main, puis release
python factory\release.py --upload --publish

# Option B : version explicite + écriture du fichier
python factory\release.py --version 1.0.22 --set-version --upload --publish
```

---

## Arborescence et fichiers clés

```
factory/
  VERSION              Version courante
  registry.json        Registre des boîtes provisionnées
  provision.py         Build + flash + archive par serial
  release.py           Build release OTA (sans serial) + upload serveur
  ota_device.py        Déclenche OTA sur UNE boîte (admin API)
  archives/            Snapshots par serial + timestamp
  releases/            Snapshots par version release + timestamp
  lib/                 Build, NVS, FFAT, OTA API, identité

firmware/boite-a-coeur/
  factory/devices/     {SERIAL}.user.txt — identité usine par boîte
  data/assets/         Contenu FFAT (icônes, fonts, manifest)
  build/esp32.../      Binaires arduino-cli après compilation
  docs/USB_DEBUG.md    Protocole @BAC et page bac-debug
```

Chaque `{SERIAL}.user.txt` contient : `device_name`, `serial_number`, `uuid`, URLs API, flags `configured` / `claimed`, WiFi (`ssid` / `psw`), `api_secret`, etc.

---

## Release OTA (sans boîte)

Workflow pour publier une version sur le serveur **sans notifier la flotte**. Vous déclenchez l'update boîte par boîte.

### Étape 1 — Build local (+ archive)

```powershell
python factory\release.py --version 1.0.22 --set-version
```

Produit :

- Compilation firmware
- Archive locale : `factory/releases/1.0.22/{timestamp}/firmware.bin` (+ `manifest.json`)

### Étape 2 — Build + upload + publish (sans notify flotte)

```powershell
$env:OTA_ADMIN_KEY = "votre-cle-admin"
$env:BAC_API_URL = "https://boite-a-coeur.fr"

python factory\release.py --version 1.0.22 --upload --publish
```

Avec assets FFAT (OTA assets en plus du firmware) :

```powershell
python factory\release.py --version 1.0.22 --with-assets --upload --publish
```

Comportement :

| Action | Detail |
|--------|--------|
| `--upload` | `POST /api/v1/updates/upload` (multipart firmware + optionnel assets.zip) |
| `--publish` | `POST /api/v1/updates/releases/{id}/publish` avec `{"notify": false}` |
| Sans `--publish` | Release en brouillon sur le serveur ; publish via admin UI ou `--publish` |

La sortie JSON contient `release.id` — notez-le pour l'etape suivante.

### Étape 3 — Déclencher OTA sur une boîte

```powershell
python factory\ota_device.py --serial BACXS32P10052026R2 --release-id 42 --force
```

| Option | Rôle |
|--------|------|
| `--release-id` | Release publiée a appliquer (obligatoire si plusieurs releases actives) |
| `--force` | Ignore version min / annule OTA en cours |
| `--lookup` | Affiche l'etat device sans declencher |

Alternative : section **Test device** dans `/public/updates/` (admin UI).

### Resume workflow OTA controle

```
release.py --upload --publish     →  release publiée, flotte NON notifiee
ota_device.py --serial ... --release-id N --force   →  une boîte reçoit l'update
```

---

## Provision sur boîte (USB)

### Nouvelle boîte (identité + flash complet)

```powershell
python factory\provision.py --new --port COM5
```

Genere serial + uuid, écrit `factory/devices/{SERIAL}.user.txt`, met a jour `registry.json`, compile, construit NVS + FFAT, flash complet, archive.

```powershell
python factory\provision.py --new --port COM5 --version 1.0.22
python factory\provision.py --new --build-only
```

### Lister ports / boîtes / modes

```powershell
python factory\provision.py --list-ports
python factory\provision.py --list-devices
python factory\provision.py --list-modes
```

---

## Modes de re-flash sur boîte existante

Pour une boîte déjà connue (`--serial`), choisir explicitement un mode ou répondre au menu interactif.

```powershell
python factory\provision.py --serial BACXS32P10052026R2 --port COM5 --mode update
python factory\provision.py --serial BACXS32P10052026R2 --port COM5 --mode reset-same-ids
python factory\provision.py --serial BACXS32P10052026R2 --port COM5 --mode reset-new-ids
```

### Tableau comparatif

| Mode | Flash | NVS | FFAT | uuid | WiFi / claim / secrets | Usage |
|------|-------|-----|------|------|------------------------|-------|
| `update` | App uniquement (`0x10000`) | conserve | conserve | conserve | conserve | Dev / patch firmware sur boîte configurée |
| `reset-same-ids` | Complet | réécrit | réécrit | **même** uuid | effacés (`configured=0`, `claimed=0`) | Remise usine, re-claim avec même identité cloud |
| `reset-new-ids` | Complet | réécrit | réécrit | **nouveau** uuid | effacés | Boîte comme neuve côté serveur (nouveau device) |

### Compatibilité `--firmware-only`

`--firmware-only` reste supporte (alias cache) et équivaut a `--mode update`.

### Reflash complet en conservant la config runtime (export device)

Si la boîte tourne encore et expose le moniteur série :

1. Sur la BaC : commande d'export config (voir firmware / console)
2. Sauver le fichier `runtime.txt`
3. :

```powershell
python factory\provision.py --serial BACXS32P10052026R2 --port COM5 --runtime-config runtime.txt
```

Identité usine (`uuid`, serial) depuis `{SERIAL}.user.txt` ; WiFi, secrets, flags depuis l'export. **Ne pas combiner** avec `--mode reset-*`.

---

## Test firmware direct USB (sans OTA cloud)

Trois methodes, de la plus rapide a la plus proche production.

### A. Flash firmware-only (recommande dev)

```powershell
python factory\provision.py --serial BACXS32P10052026R2 --port COM5 --mode update
```

WiFi et claim intacts. Ideal pour iterer sur le code applicatif.

### B. Build sans flash

```powershell
python factory\provision.py --serial BACXS32P10052026R2 --mode update --build-only
```

Binaire dans `firmware/boite-a-coeur/build/esp32.esp32.esp32s3/boite-a-coeur.ino.bin` — flash manuel esptool si besoin.

### C. Page Web Serial `/public/bac-debug/`

Documentation détaillée : `firmware/boite-a-coeur/docs/USB_DEBUG.md`

1. BaC en USB (Chrome/Edge)
2. Ouvrir `https://boite-a-coeur.fr/public/bac-debug/`
3. Connecter le port `BAC-XS3`
4. Choisir une version **déjà publiée** sur le serveur
5. Le navigateur télécharge des chunks API et les envoie via protocole `@BAC FLASH_*`

Protocole console `@BAC` : `PING`, `HELP`, `ANALYZE`, `FLASH_BEGIN`, `FLASH_CHUNK`, `FLASH_END`.

Utile pour valider une release publiée sans attendre le polling OTA WiFi.

### D. Release locale sans upload

```powershell
python factory\release.py --version 1.0.22-test
```

Archive dans `factory/releases/` — pas de serveur.

---

## Test OTA sur une seule boîte

Prérequis : release **publiée** sur le serveur (via `release.py --publish` ou admin UI).

```powershell
$env:OTA_ADMIN_KEY = "..."

python factory\ota_device.py --serial BACXS32P10052026R2 --lookup
python factory\ota_device.py --serial BACXS32P10052026R2 --release-id 42 --force
```

La BaC doit être en WiFi, `configured=1`, et joignable par le backend. L'OTA cloud télécharge le firmware depuis les URLs configurées (`api_url`, failover `api_url_b1` / `api_url_b2`).

---

## Traçabilité et archives

### Provision (par serial)

```
factory/archives/{SERIAL}/{timestamp}/
  manifest.json       version, mode, sha256, port
  identity.json
  user.txt
  boite-a-coeur.ino.bin
  ffat.bin, nvs.bin, bootloader, partitions, boot_app0
```

`registry.json` : historique `provision_history`, `last_firmware_version`, `last_provisioned_at`.

### Release OTA (par version)

```
factory/releases/{VERSION}/{timestamp}/
  manifest.json
  firmware.bin
  ffat.bin            si --with-assets
  assets.zip          si --with-assets
```

---

## Variables d'environnement

| Variable | Défaut | Usage |
|----------|--------|-------|
| `OTA_ADMIN_KEY` | — | Clé admin upload / publish / notify device |
| `BAC_API_URL` | `https://boite-a-coeur.fr` | Base URL API |

---

## Dépannage

| Problème | Piste |
|----------|-------|
| `arduino-cli not found` | Relancer `setup_tools.ps1`, verifier PATH |
| Port USB inconnu | `--list-ports`, débrancher/rebrancher, voir USB_DEBUG.md (cache Windows) |
| `device file not found` | Vérifier `firmware/boite-a-coeur/factory/devices/{SERIAL}.user.txt` |
| OTA device échoue | `--lookup` ; release doit être **published** ; `--force` ; WiFi OK |
| Upload release HTTP 401/403 | Vérifier `OTA_ADMIN_KEY` |
| Full flash efface WiFi | Utiliser `--mode update` au lieu de reset |
| Nouveau uuid mais même serial physique | `--mode reset-new-ids` ; re-claim dans l'app |

---

## Référence rapide des commandes

```powershell
# Release OTA complète (upload + publish sans notify flotte)
python factory\release.py --version 1.0.22 --set-version --with-assets --upload --publish

# OTA une boîte
python factory\ota_device.py --serial SERIAL --release-id ID --force

# Nouvelle boîte
python factory\provision.py --new --port COM5

# Update firmware seul (WiFi conserve)
python factory\provision.py --serial SERIAL --port COM5 --mode update

# Factory reset mêmes ids
python factory\provision.py --serial SERIAL --port COM5 --mode reset-same-ids

# Factory reset nouveaux ids
python factory\provision.py --serial SERIAL --port COM5 --mode reset-new-ids
```

Voir aussi `factory/README.md` (index anglais court) et `firmware/boite-a-coeur/docs/USB_DEBUG.md`.
