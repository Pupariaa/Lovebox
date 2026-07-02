# Lovebox / Boîte à Cœur — contexte pour agent IA

Document de passation. Dernière mise à jour : juin 2026.  
**Ce repo est indépendant de [Lucarne](https://github.com/Pupariaa/Lucarne).** Lucarne = lib UI Arduino + Studio. Lovebox = produit (firmware ESP32, app Android, recherche hardware).

---

## Identité produit

| | |
|---|---|
| **Nom commercial** | Boîte à Cœur |
| **Nom repo / code** | Lovebox |
| **GitHub** | `https://github.com/Pupariaa/Lovebox` |
| **Concept** | Boîte connectée type Lovebox : écran SPI, touch, WiFi, messages reçus depuis le réseau local, provisioning BLE |
| **UI** | Conçue dans **Lucarne Studio**, exportée en `Projet*.h` |
| **Lib firmware UI** | **Lucarne** (repo séparé, v0.2.0 publiée) — dépendance externe, pas un sous-dossier |

---

## Layout des repos (machine dev typique)

```
Documents/GitHub/
├── Lucarne/          # Lib Arduino + editor/ (Studio) + docs lib
└── Lovebox/          # CE REPO — produit uniquement
```

**Ne pas** mettre le firmware Lovebox dans le repo Lucarne.

Ancien emplacement de dev (peut encore exister en local) :  
`Documents/Arduino/Test_lovebox_2` — sketch renommé `boite-a-coeur.ino`, contenu migré vers `Lovebox/firmware/boite-a-coeur/`.

---

## Structure de ce repo

```
Lovebox/
├── succession.md                 # ce fichier
├── README.md
├── .gitignore                    # non commité au moment de la rédaction
├── docs/research/                # études hardware (ESP32-S3, SD, SPI, perf UI…)
├── applications/android/v.0.1.0/ # squelette Kotlin (com.tchy.boiteacoeur), pas d'Activity encore
└── firmware/
    ├── README.md
    └── boite-a-coeur/            # sketch Arduino principal
        ├── boite-a-coeur.ino
        ├── Bac*.h                # logique applicative
        ├── Lovebox*.h            # utilitaires (frame pacer, touch nav legacy…)
        ├── Projet*.h             # export Lucarne Studio
        ├── Lovebox.lucarne.json  # projet Studio source
        ├── LucarneUserConfig.h   # FFat on, SD off
        ├── data/                 # bundle FFat (assets + user.txt)
        ├── ble-sim/              # Flask : BLE provisioning + composer messages
        └── docs/                 # doc firmware détaillée
```

---

## État Git (à vérifier au démarrage)

Au moment de la rédaction, **le firmware n'était pas encore commité** sur `main` (dossier `firmware/` untracked). Seuls `docs/research/` et début Android étaient versionnés.

Commits existants :
- `842ed0f` — Deepen research pack…
- `70b0505` — Add hardware and UI performance research pack…

**À faire côté repo :** commit `.gitignore`, `firmware/`, Android app, README mis à jour ; ne pas committer `data/user.txt` (device-specific), `ble-sim/.venv/`, `local.properties`, `.idea/`.

---

## Hardware cible vs actuel

### Panneau (firmware actuel)

| Paramètre | Valeur |
|-----------|--------|
| Driver | ST7789 |
| Physique | 240×280 |
| Rotation Lucarne | 1 → layout logique **280×240** (largeur × hauteur) |
| SPI | 40 MHz, mode 3, RGB, invert on |
| Framebuffer | `BufferMode::Full` |
| Target FPS | 45 (`LoveboxFramePacer`) |

### GPIO (`Projet_setup.h` dans ce repo)

| Signal | GPIO |
|--------|------|
| CS | 16 |
| DC | 15 |
| RST | 8 |
| MOSI | 18 |
| SCLK | 17 |
| MISO | -1 (non utilisé) |
| Touch | 1 (`TOUCH_PIN` dans `.ino`) |
| Backlight | non câblé (`bl = -1`) |

`initSpiBus()` : `SPI.begin(17, -1, 18, 17)` puis `display.begin()` reconfigure le bus.

### Touch

- Pressé si ADC **> 23500**, relâché **< 22500**
- Valide ~15000–32000

### Stockage assets

- **FFat** partition interne (`LUCARNE_ENABLE_VOLUME=1`, SD désactivé)
- Fichiers sous `/assets/` sur volume (images `.rgb565`, icônes animées par dossier)
- Config device : `/user.txt` sur FFat

### Recherche hardware (`docs/research/`)

Vision long terme : ESP32-S3 N16R8, microSD pour assets, optimisations anim Lucarne. **Pas encore le PCB de prod** — le firmware tourne sur un setup de dev ESP32 classique.

---

## Dépendance Lucarne

- Installer la lib depuis `../Lucarne` ou Arduino Library Manager (**0.2.0+** recommandé).
- Studio : ouvrir `firmware/boite-a-coeur/Lovebox.lucarne.json` via `../Lucarne/editor/`.
- Export Studio → regénérer `Projet.h`, `Projet_setup.h`, `Projet_fonts.h`, `Projet_icons.h`, `Projet_images.h` + copier assets dans `data/assets/`.
- Menus exportent des couleurs custom (`setActiveFill`, `setInactiveText`, etc.) — API Lucarne 0.2.0.

---

## Architecture firmware

### Boucle principale (`boite-a-coeur.ino`)

```
touch.read() → app.tick()
ui.update()
app.drawMessageOverlay(display)   // seulement sur écran message_opened
projet::update()
framePacer.wait()
```

### `BacApp` — orchestrateur

| Mode | Description |
|------|-------------|
| `Caching` | Warm-up cache écran splash |
| `FirstSetup` | Wizard first_p1…p4 |
| `WifiBoot` | Connexion WiFi au boot |
| `Idle` | Horloge, serveur HTTP messages actif |
| `Lost` | Pas de WiFi, BLE provisioning |
| `Settings` | Menu réglages (long press 5 s) |

**Fichiers clés :**

| Fichier | Rôle |
|---------|------|
| `BacApp.h` | Modes, navigation, touch, flows settings, messages |
| `BacBle.h` | BLE GATT provisioning WiFi |
| `BacWifi.h` | Station WiFi + link monitor |
| `BacUserConfig.h` | Lecture/écriture `user.txt` |
| `BacTouch.h` | Touch + log debug |
| `BacScreenCache.h` | Pre-render écrans lourds |
| `BacTimeSync.h` | NTP après setup |
| `BacMessageStore.h` | Parse BACM v1, stockage PSRAM (max 2 MB, 1 message) |
| `BacMessageRenderer.h` | Draw message (bg + layers + anim) |
| `BacMessageServer.h` | HTTP :8080 — `/info`, `/ping`, `POST /message` |
| `BacScreens.h` | Écran dynamique `message_opened` (hors export Studio) |

### Règles critiques (bugs déjà rencontrés)

1. **BLE callback** : ne jamais appeler `WiFi.begin` / `String` lourdes dans le callback BLE → queue vers main loop (`pollPendingWifiProv`).
2. **Pas de `BLEDevice::deinit()`** sur le chemin WiFi connect (crash heap).
3. **HTTP gros payloads** : upload multipart + parsing différé (`pollPendingMessage`) pour ne pas freezer l'UI.
4. **Overlay message** : display en `BufferMode::Full` → après draw overlay, appeler **`presentFull()`** sinon écran vide / thème par défaut.
5. **Navigation message** : `goInstant()` sans transition fade vers écrans vides.
6. **Texte BACM** : texte composé avec alpha sur le fond (pas de calque opaque 280×32) sinon bandeau noir en RGB565.

---

## BLE provisioning

| | |
|---|---|
| Service UUID | `bac1c201-1fb5-459e-8fcc-c5c9c331914b` |
| Char WiFi UUID | `bac1c202-36e1-4688-b7f5-ea07361b26a8` |
| Format payload | `ssid\|password` ou `ssid\npassword` |
| Open network | mot de passe vide OK |
| Nom BLE | `device_name` dans `user.txt` (défaut `BoiteACoeur`) |

Écrans provisioning : `first_p3`, `first_p3_wifi_connecting`, `lost_connection`.  
Connexion min **8 s** sur l'écran connecting avant succès/erreur.

---

## WiFi messages (MVP)

### Serveur HTTP (idle uniquement)

| Route | Méthode | Description |
|-------|---------|-------------|
| `/info` | GET | JSON : name, uuid, ip, w, h, port |
| `/ping` | GET | `ok` |
| `/message` | POST | corps binaire BACM v1 (multipart ou raw) |

Port **8080**.

### Format BACM v1

```
Magic "BACM", version 1, screen 280×240
Background RGB565 (w×h×2)
Par layer (16 bytes meta) : type, fps, x, y, w, h, frameCount, dataSize + blob
  type 0 = static, type 1 = anim (frames concaténées)
```

Texte et photos : **bakés dans le background** côté composer. Seules les icônes animées restent en layer anim.

### Flow utilisateur

1. Message reçu → écran `new_message` (Studio)
2. Tap → `message_opened` (écran vide Lucarne + overlay `BacMessageRenderer`)
3. Tap → retour `idle`

### `user.txt` (FFat)

```
device_name: BoiteACoeur
serial_number: ...
ssid:
psw:
configured: 0|1
uuid: (128 chiffres, regen au début setup)
tz_offset: (optionnel)
```

Template : `data/user.txt.example`. Ne pas committer `data/user.txt` réel.

---

## Écrans Studio (`Projet.h`)

Noms logiques (utilisés dans `BacApp` par string) :

| Nom | Usage |
|-----|--------|
| `splash_screen` | Boot cache |
| `first_p1` … `first_p4` | Setup initial |
| `first_p3_wifi_connecting` | Connexion WiFi |
| `first_wifi_error` | Échec setup |
| `idle` | Accueil horloge |
| `lost_connection` | WiFi perdu |
| `new_message` | Notification message |
| `message_opened` | **dynamique** (`BacScreens.h`), pas dans Studio |
| `settings_*` | Réglages (typos préservées : `settings_fatory_reseting`) |

Symboles C++ : `screen_scr_mq…` — grep `Screen("` dans `Projet.h`.

### Touch (`BacApp`)

| Gesture | Action |
|---------|--------|
| Hold 5 s idle/lost | Settings |
| Tap menu | next |
| Hold 0.5 s menu | select |
| Tap `new_message` | open message |
| Tap `message_opened` | idle |
| Tap first_p1/p2/p3/p4 | wizard steps |

---

## ble-sim (outil dev Python)

**Chemin :** `firmware/boite-a-coeur/ble-sim/`  
**Port :** `http://127.0.0.1:8765`

```bash
cd firmware/boite-a-coeur/ble-sim
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

| Section | Rôle |
|---------|------|
| Connection | Scan/connect BLE |
| WiFi provisioning | Envoie SSID/password |
| Message composer | Canvas 280×240, layers, discover LAN, send BACM |

**Lucarne Studio scripts** servis via `/lucarne/...` :
- Chemin par défaut : `../Lucarne/editor` (sibling repo)
- Override : variable d'environnement `LUCARNE_EDITOR`

Fichiers JS : `static/message_pack.js` (BACM builder), `message.js` (UI composer), `app.js` (BLE).

Proxy : `POST /api/send-message?ip=` → multipart vers box:8080/message.

---

## App Android

`applications/android/v.0.1.0/` — package `com.tchy.boiteacoeur`, **squelette Gradle uniquement** (manifest sans Activity). L'app prod BLE/WiFi n'est pas implémentée ; **ble-sim** fait office de simulateur app Android sur PC.

---

## Préférences utilisateur (conversations)

- Pas d'emoji dans le code
- Commentaires et `console.log` en **anglais**
- Pas de git commit sauf demande explicite
- L'utilisateur build/flash lui-même
- Ne pas lancer de serveurs en double s'il en a déjà un
- Lucarne et Lovebox = **projets séparés**

---

## Travail réalisé (session récente)

- [x] BLE/WiFi solidifié (deferred BLE, pas de deinit heap crash)
- [x] Touch navigation settings / menus / messages
- [x] `user.txt` : configured, uuid, WiFi creds
- [x] MVP messages WiFi : BACM, HTTP server, PSRAM store, renderer
- [x] ble-sim : discover, composer, multipart upload
- [x] Fix overlay `presentFull()`, parsing HTTP différé
- [x] Fix texte BACM (alpha composite, pas bandeau noir)
- [x] Migration firmware → repo Lovebox `firmware/boite-a-coeur/`
- [x] Docs firmware dans `firmware/boite-a-coeur/docs/`
- [x] Lucarne **v0.2.0** publiée (menu colors, prefetch, anim fixes) — repo séparé

## Pas encore fait / backlog

- [ ] Commit + push firmware Lovebox sur GitHub
- [ ] App Android réelle (remplacer ble-sim pour prod)
- [ ] Écran `message_opened` exportable dans Studio (aujourd'hui overlay dynamique seulement)
- [ ] Réduire taille payloads anim (~900 KB) — opaque bake côté web coûteux
- [ ] Freeze court à la réception message (parsing PSRAM encore lourd)
- [ ] Aligner hardware recherche (SD, ESP32-S3) avec firmware si nouveau PCB
- [ ] Lucarne Studio `web/editor/v0.2.0` déployé en ligne (editor local gitignoré dans Lucarne)
- [ ] Bouton « send heart » sur idle (log Serial seulement pour l'instant)
- [ ] `LoveboxTouchNav.h` — legacy ?, navigation principale dans `BacApp`

---

## Fichiers à lire en priorité

1. `firmware/boite-a-coeur/BacApp.h` — toute la logique produit
2. `firmware/boite-a-coeur/Projet.h` — UI exportée
3. `firmware/boite-a-coeur/Projet_setup.h` — pins + storage
4. `firmware/boite-a-coeur/ble-sim/app.py` — outil dev
5. `firmware/boite-a-coeur/docs/ARCHITECTURE.md` — détail modules
6. `docs/research/10-ACTION-PLAN.md` — roadmap hardware

---

## Test rapide message

1. Box sur WiFi → écran `idle`
2. `ble-sim` → Discover → Send message
3. Box → `new_message` → tap → contenu BACM visible
4. Tap → idle

Serial 115200, préfixe log `Bac:`.

---

## Liens

- Lucarne lib : https://github.com/Pupariaa/Lucarne (release v0.2.0)
- Lovebox : https://github.com/Pupariaa/Lovebox
- Lucarne Studio en ligne : https://lucarnelib.techalchemy.fr/editor/
