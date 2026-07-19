# Audit securite et robustesse — Boite a coeur (Lovebox)

| Champ | Valeur |
|-------|--------|
| Date | 2026-07-19 |
| Commit audite | `632ae2d281e6027e0bb20a7724e350cd6bf750d6` |
| Branche | `main` |
| Perimetre | Backend PHP, firmware ESP32, app Expo (`mobile-rn`), app KMP (`applications/mobile`) |
| Methode | Audit lecture seule, exploration automatisee + revue manuelle des chemins critiques (auth, OTA, BLE, navigation) |
| Backup associe | `C:\Users\Puparia\Documents\GitHub\Lovebox-backups\20260719-050338\` |

---

## Table des matieres

1. [Resume executif](#1-resume-executif)
2. [Verdict global — brickage et blocage](#2-verdict-global--brickage-et-blocage)
3. [Matrice transversale des risques](#3-matrice-transversale-des-risques)
4. [Plan de remediation priorise](#4-plan-de-remediation-priorise)
5. [Backend PHP (`web/backend`)](#5-backend-php-webbackend)
6. [Firmware ESP32 (`firmware/boite-a-coeur`)](#6-firmware-esp32-firmwareboite-a-coeur)
7. [App mobile Expo (`applications/mobile-rn`)](#7-app-mobile-expo-applicationsmobile-rn)
8. [App mobile KMP (`applications/mobile`) — legacy](#8-app-mobile-kmp-applicationsmobile--legacy)
9. [Inventaire des endpoints API](#9-inventaire-des-endpoints-api)
10. [Points positifs](#10-points-positifs)
11. [Annexes](#11-annexes)

---

## 1. Resume executif

Quatre audits paralleles ont couvert l'ensemble de la stack. **Aucun chemin identifie ne brique definitivement le flash firmware** : le pipeline OTA cloud verifie taille + SHA256 avant `Update.end()`, utilise des partitions A/B 3 Mo, et installe les assets **avant** le firmware.

Les risques les plus graves sont :

| Domaine | Risque principal | Severite |
|---------|------------------|----------|
| Backend | Reemission du `device_secret` sans ancien secret (uuid + serial) | CRITIQUE |
| Backend | `id_token` OAuth decode sans verification de signature | CRITIQUE |
| Backend | Zip slip a l'upload OTA assets | CRITIQUE |
| Firmware | Rollback OTA annule des le boot (`setup()`) | CRITIQUE |
| Firmware | Wipe `/assets` avant telechargement complet | CRITIQUE |
| App mobile-rn | `fetch` sans timeout → spinner infini | CRITIQUE |
| App mobile-rn | Provisioning BLE bloquant ~120 s sans annulation | CRITIQUE |

L'app KMP (`applications/mobile`) est un **client secondaire / quasi-legacy** (7 commits, v0.1.0). Impact faible tant qu'elle n'est pas distribuee, sauf secrets WiFi hardcodes dans le binaire.

---

## 2. Verdict global — brickage et blocage

### Ce qui ne brique PAS la boite (confirmé)

- Coupure WiFi / cloud injoignable → mode Lost + BLE provisioning, retry 30 s.
- NVS vide ou corrompu → defaults + first setup.
- FFAT non monte → warning, boot continue (UI degradee).
- OTA firmware interrompu **avant** `Update.end(true)` → abort, ancien firmware conserve.
- Pas de `min_version` cote firmware → pas de blocage OTA auto-impose par le device.

### Chemins vers etat mort ou quasi-mort

| # | Chemin | Composant | Symptome | Recuperation |
|---|--------|-----------|----------|--------------|
| B1 | Rollback annule trop tot | `firmware/boite-a-coeur/BacApp.h` | Boot loop si FW boote en setup puis crashe | Reflash USB |
| B2 | Wipe assets + coupure reseau | `firmware/boite-a-coeur/BacAssetsOta.h` | Ecran/UI degrade, icons manquants | OTA assets reussi ou reflash |
| B3 | Marqueur `.ok` jamais verifie au boot | `BacAssetsOta.h` (fn `markerPresent` non appelee) | Pas de reinstall auto apres OTA assets ratee | Manuel |
| B4 | `display.begin()` echoue | `firmware/boite-a-coeur/boite-a-coeur.ino` | Ecran mort, pas de BLE/WiFi | Reflash / hardware |
| B5 | Usurpation device (backend) | `web/backend/src/Services/DeviceService.php` | Boite controlee par attaquant | Rotation secret + reflash usine |
| B6 | Spinner infini app | `applications/mobile-rn/src/data/api/ApiClient.ts` | App figee, loading global | Kill app |
| B7 | OAuth callback sans catch | `applications/mobile-rn/src/app/oauth-callback.tsx` | Spinner infini | Kill app |

---

## 3. Matrice transversale des risques

| ID | Severite | Domaine | Fichier(s) cle(s) | Titre court |
|----|----------|---------|-------------------|-------------|
| C-01 | CRITIQUE | Backend | `web/backend/src/Services/DeviceService.php` | Reemission device_secret sans secret |
| C-02 | CRITIQUE | Backend | `web/backend/src/Services/OAuthService.php` | id_token non verifie |
| C-03 | CRITIQUE | Backend | `web/backend/src/Support/AssetsPackBuilder.php` | Zip slip upload OTA |
| C-04 | CRITIQUE | Backend | `web/backend/config/settings.php` | JWT secret par defaut |
| C-05 | CRITIQUE | Firmware | `firmware/boite-a-coeur/BacApp.h` | Rollback OTA annule trop tot |
| C-06 | CRITIQUE | Firmware | `firmware/boite-a-coeur/BacAssetsOta.h` | Wipe assets avant download |
| C-07 | CRITIQUE | Firmware | `firmware/boite-a-coeur/BacAssetsOta.h` | markerPresent jamais utilise |
| C-08 | CRITIQUE | mobile-rn | `applications/mobile-rn/src/data/api/ApiClient.ts` | fetch sans timeout |
| C-09 | CRITIQUE | mobile-rn | `applications/mobile-rn/src/app/ble.tsx` | BLE provisioning sans annulation |
| C-10 | CRITIQUE | mobile-rn | `applications/mobile-rn/src/app/oauth-callback.tsx` | Spinner infini si exception |
| E-01 | ELEVE | Backend | `web/backend/src/Services/DeviceService.php` | Claim sans preuve possession |
| E-02 | ELEVE | Backend | `web/backend/src/Controllers/UsbDebugController.php` | Download FW sans auth reelle |
| E-03 | ELEVE | Backend | `web/backend/src/Middleware/OtaAdminMiddleware.php` | Cle OTA admin unique |
| E-04 | ELEVE | Backend | `web/backend/.env.example` | Secrets plausibles committes |
| E-05 | ELEVE | Backend | `web/backend/src/Repositories/UserRepository.php` | Tokens reset/verify en clair DB |
| E-06 | ELEVE | Firmware | `firmware/boite-a-coeur/BacOta.h` | Boucle download sans timeout global |
| E-07 | ELEVE | Firmware | `firmware/boite-a-coeur/boite-a-coeur.ino` | WDT 60 s sans reset explicite |
| E-08 | ELEVE | Firmware | `firmware/boite-a-coeur/boite-a-coeur.ino` | display.begin fail = mur |
| E-09 | ELEVE | Firmware | `firmware/boite-a-coeur/BacCloudClient.h` | pollCommands body sans limite |
| E-10 | ELEVE | mobile-rn | `applications/mobile-rn/src/app/oauth-callback.tsx` | Tokens OAuth dans URL |
| E-11 | ELEVE | mobile-rn | `applications/mobile-rn/src/app/onboarding/profile.tsx` | Piege onboarding |
| E-12 | ELEVE | mobile-rn | `applications/mobile-rn/src/app/(tabs)/_layout.tsx` | Pas de garde auth tabs |
| E-13 | ELEVE | KMP | `applications/mobile/shared/.../TokenStorage.*.kt` | Tokens en clair |
| E-14 | ELEVE | KMP | `applications/mobile/shared/.../AppConfig.kt` | WiFi dev hardcode |

*(Voir sections detaillees pour MOYEN et FAIBLE.)*

---

## 4. Plan de remediation priorise

### Phase 1 — Securite critique (immediate)

1. **Backend** : exiger `X-Device-Secret` valide pour toute reemission ; ne jamais reemettre sur uuid+serial seul.
   - Fichier : `web/backend/src/Services/DeviceService.php` (L46-L55)
2. **Backend** : verifier signature JWT `id_token` (JWKS Apple/Google) ; supprimer confiance email body client.
   - Fichier : `web/backend/src/Services/OAuthService.php` (L240-L247, L126-L135)
3. **Backend** : corriger zip slip — normaliser chemins, rejeter `..`, extraire dans sandbox.
   - Fichier : `web/backend/src/Support/AssetsPackBuilder.php` (L138-L151)
4. **Backend** : forcer `JWT_SECRET` en prod ; purger `.env.example`.
   - Fichiers : `web/backend/config/settings.php`, `web/backend/.env.example`
5. **Firmware** : retarder `esp_ota_mark_app_valid_cancel_rollback()` apres checks sante (WiFi + FFAT + 1 frame).
   - Fichier : `firmware/boite-a-coeur/BacApp.h` (L665-L676, L122-L124)
6. **Firmware** : staging assets atomique ; verifier `markerPresent()` au boot.
   - Fichier : `firmware/boite-a-coeur/BacAssetsOta.h`

### Phase 2 — Robustesse utilisateur

7. **mobile-rn** : timeout global fetch (30-60 s) + reset `loading` garanti.
   - Fichier : `applications/mobile-rn/src/data/api/ApiClient.ts`
8. **mobile-rn** : bouton Annuler sur ecran BLE ; retour autorise pendant claim.
   - Fichiers : `applications/mobile-rn/src/app/ble.tsx`, `applications/mobile-rn/src/store/appStore.ts`
9. **mobile-rn** : try/catch/finally sur `oauth-callback.tsx` et OAuth inline.
   - Fichiers : `applications/mobile-rn/src/app/oauth-callback.tsx`, `applications/mobile-rn/src/app/auth.tsx`
10. **mobile-rn** : aligner login email sur check `profile_complete` ; garde auth sur `(tabs)`.
    - Fichiers : `applications/mobile-rn/src/app/auth.tsx`, `applications/mobile-rn/src/app/index.tsx`

### Phase 3 — Durcissement

11. Firmware : timeout global `BacOta::installFromUrl` ; WDT reset en OTA.
12. Backend : rate limit fail-closed ; hash tokens email en DB ; CORS restreint.
13. Backend : auth USB debug via device secret ou token ephemere.
14. KMP : retirer `DEV_WIFI_*` ; chiffrer TokenStorage — ou marquer app legacy officiellement.

---

## 5. Backend PHP (`web/backend`)

### 5.1 CRITIQUE

#### C-01 — Reemission `device_secret` sans ancien secret

**Fichier :** `web/backend/src/Services/DeviceService.php` (L46-L55)

**Endpoint :** `POST /api/v1/devices/register` (sans auth, rate limit 30/min)

**Comportement :** Si device existe avec `secret_hash`, uuid correspond, pas de header `X-Device-Secret`, mais `serial_number` match → nouveau secret emis en clair.

**Impact :** Usurpation complete boite (poll, heartbeat, ack, OTA) si uuid + serial connus.

**Scenario :** uuid expose (admin OTA, pairing, export RGPD, BLE) + serial sur etiquette (`BACXS32…`).

---

#### C-02 — OAuth `id_token` sans verification signature

**Fichier :** `web/backend/src/Services/OAuthService.php` (L240-L247)

```php
private function decodeIdToken(string $idToken): array
{
    $parts = explode('.', $idToken);
    // ... base64 decode payload ONLY, no signature verify
}
```

**Utilise par :** Apple web callback, Google id_token, **Apple native** (`POST /api/v1/auth/oauth/apple/native`).

**Impact additionnel :** email injectable depuis body client (L131-L135) → liaison compte existant / creation frauduleuse.

---

#### C-03 — Zip slip upload OTA assets

**Fichier :** `web/backend/src/Support/AssetsPackBuilder.php` (L138-L151)

Entree `assets/../../tmp/evil` passe `str_starts_with('assets/')` → ecriture hors `$tmpdir`.

---

#### C-04 — JWT secret par defaut

**Fichier :** `web/backend/config/settings.php` (L17-L20)

```php
'secret' => $_ENV['JWT_SECRET'] ?? 'dev-secret-change-me',
```

Si deploy sans `.env` → tokens forgeables.

---

### 5.2 ELEVE

#### E-01 — Claim device sans preuve possession

**Fichier :** `web/backend/src/Services/DeviceService.php` (L122-L141)

Claim utilisateur : uuid + serial_number seulement. Pas de challenge signe device secret.

---

#### E-02 — USB debug : download firmware sans auth reelle

**Fichier :** `web/backend/src/Controllers/UsbDebugController.php` (L108-L114)

Auth = regex serial `^BACXS32[A-Z0-9]+R[12]$`. Pas de device secret.

**Endpoints publics :**
- `GET /api/v1/usb-debug/releases`
- `GET /api/v1/usb-debug/releases/{id}/chunk`

---

#### E-03 — Cle OTA admin unique

**Fichier :** `web/backend/src/Middleware/OtaAdminMiddleware.php` (L19-L31)

`hash_equals` correct. Meme cle protege `/api/v1/updates/*` et `/api/v1/admin/*`. Panels HTML stockent cle dans `localStorage` :
- `web/backend/public/updates/index.html`
- `web/backend/public/admin/index.html`

---

#### E-04 — Secrets plausibles dans `.env.example`

**Fichier :** `web/backend/.env.example` (L9-L11)

`DB_PASSWORD`, `JWT_SECRET` ressemblent a de vrais credentials.

---

#### E-05 — Tokens reset/verify email en clair en DB

**Fichier :** `web/backend/src/Repositories/UserRepository.php`

Tokens reset password, verify email, contact email stockes non hashes. Fuite DB = prise de comptes.

*(Refresh tokens : SHA-256 via TokenUtil — OK.)*

---

### 5.3 MOYEN

| # | Fichier | Probleme |
|---|---------|----------|
| M-01 | `web/backend/src/Middleware/CorsMiddleware.php` | `Access-Control-Allow-Origin: *` |
| M-02 | `web/backend/src/Middleware/RateLimitMiddleware.php` | Fail-open si FS non writable ; `X-Forwarded-For` spoofable |
| M-03 | `web/backend/src/Controllers/OAuthController.php` | Tokens OAuth dans query string redirect |
| M-04 | `web/backend/src/Services/AuthService.php` | Login sans gate `email_verified_at` |
| M-05 | `web/backend/src/Services/OtaService.php` | `force=true` contourne min_version |
| M-06 | `web/backend/src/Services/OtaService.php` | Publish sans validation existence binaire on-disk |
| M-07 | `web/backend/src/Services/PairingService.php` | Bruteforce code `LOVE-XXXX` (~23 j/IP a 30 req/min) |
| M-08 | `web/backend/src/Services/OtaService.php` | Admin lookup expose uuid/serial/online |
| M-09 | `web/backend/src/Controllers/MessageController.php` | `scheduled_at` non valide |
| M-10 | `web/backend/public/index.php` | `APP_DEBUG=true` expose stack traces |

---

### 5.4 FAIBLE

| # | Fichier | Probleme |
|---|---------|----------|
| F-01 | `web/backend/src/Services/JwtService.php` | Pas de iss/aud ; pas de revocation access token |
| F-02 | `web/backend/src/Controllers/InviteController.php` | `findInvite()` inexistant, route absente — code mort |
| F-03 | `web/backend/src/Repositories/DeviceRepository.php` | Pattern UPDATE `$key = :$key` fragile |
| F-04 | Device poll | Long poll 25 s — charge workers |

---

### 5.5 OTA serveur — risque brickage

| Controle | Present |
|----------|---------|
| Semver version | Oui |
| SHA-256 a l'upload | Oui |
| Validation binaire ESP32 (magic, taille) | **Non** |
| Verification fichier existe avant publish | **Non** |
| Rollback automatique serveur | **Non** |
| min_version (sauf force) | Oui |

Mauvais binaire avec SHA correct → risque brick materiel. Publish sans fichier → OTA 404 cote client (pas brick si client verifie SHA).

---

## 6. Firmware ESP32 (`firmware/boite-a-coeur`)

**Partition :** dual-bank OTA `ota_0` / `ota_1` (3 Mo) + FFAT 9 Mo.

### 6.1 CRITIQUE

#### C-05 — Rollback OTA annule trop tot

**Fichiers :**
- `firmware/boite-a-coeur/BacApp.h` L665-L676 (`confirmFirmwareValid`)
- `firmware/boite-a-coeur/BacApp.h` L122-L124 (`onCacheReady`)
- `firmware/boite-a-coeur/boite-a-coeur.ino` L65-L69

`esp_ota_mark_app_valid_cancel_rollback()` appele immediatement apres `ui.begin()` en setup — pas apres WiFi, FFAT, smoke test.

**Impact :** FW qui boote en setup puis crashe → boot loop, pas de rollback.

---

#### C-06 — Wipe `/assets` avant telechargement (install full)

**Fichier :** `firmware/boite-a-coeur/BacAssetsOta.h` L102-L117

Sequence : wipe → stream install. Coupure apres wipe = assets perdus, marqueur `.ok` absent.

---

#### C-07 — `markerPresent()` jamais appele au boot

**Fichier :** `firmware/boite-a-coeur/BacAssetsOta.h` L136-L145

Fonction existe pour detecter install interrompue. Aucun appel dans `BacApp.h`, `boite-a-coeur.ino`, `Projet_setup.h`.

---

#### C-06b — Diff assets sans rollback

**Fichier :** `firmware/boite-a-coeur/BacAssetsOta.h` L484-L512 (`applyDiff`)

Suppression fichiers obsoletes + ecriture partielle → etat mixte si echec.

---

### 6.2 ELEVE

| # | Fichier | Lignes | Probleme |
|---|---------|--------|----------|
| E-06 | `BacOta.h` | L60-L65 | Boucle download sans timeout global (vs 300 s dans assets) |
| E-07 | `boite-a-coeur.ino` | L38-L41 | WDT 60 s panic, jamais reset ; OTA sur meme core que loop |
| E-08 | `boite-a-coeur.ino` | L52-L56 | `display.begin()` fail → return setup, app non init, ecran mort |
| E-09 | `Projet_setup.h` + `boite-a-coeur.ino` | L56-L63 | FFAT non monte : warning only, UI degradee |
| E-10 | `BacCloudClient.h` | L490-L492 | `pollCommands` body JSON sans limite taille → OOM |
| E-11 | `BacUserConfig.h` | L106 | `api_secret` NVS plaintext |
| E-12 | `BacApp.h` | L693-L705 | Commandes cloud `reboot` / `factory_reset` sans garde-fou local |

---

### 6.3 MOYEN — Points positifs OTA firmware

**Fichier :** `firmware/boite-a-coeur/BacOta.h` L87-L97

- Taille + SHA256 avant `Update.end(true)`
- `Update.abort()` si mismatch

**Fichier :** `firmware/boite-a-coeur/BacApp.h` L864-L868

- Assets installes **avant** firmware (evite FW neuf + assets stale)

**Fichiers :** `BacUrlFailover.h`, `BacOta.h` L30-L100

- Failover 3 hotes pour download OTA

**Fichier :** `BacApp.h` L769-L777, L828

- OTA uniquement si claimed + mode Idle

**Fichier :** `BacTls.h`

- Bundle CA par defaut ; `setInsecure()` seulement si `BAC_DEV_INSECURE_TLS`

---

### 6.4 Autres domaines firmware

| Domaine | Verdict | Fichiers |
|---------|---------|----------|
| NVS vide/corrompu | OK — defaults + first setup | `BacUserConfig.h`, `BacApp.h` L132-L143 |
| WiFi jamais connecte | OK — Lost + BLE, retry 30 s | `BacApp.h`, timeouts WiFi |
| BLE provisioning | OK — SSID 32, pass 63, buffer 192 | `BacBle.h` L265-L304 |
| Parsing BACM | OK — magic, version, dimensions | `BacMessageStore.h`, `BacCloudClient.h` |
| min_version device | Absent — pas de blocage OTA auto | `BacOtaPayload.h` |
| Failover API poll | Partiel — register oui, poll/heartbeat non | `BacCloudClient.h` |
| Factory reset local | 10 s timer — faible risque accidentel | `BacApp.h`, `FACTORY_RESET_MIN_MS` |

---

### 6.5 FAIBLE

| # | Fichier | Probleme |
|---|---------|----------|
| F-01 | `BacApp.h` | `onCacheReady()` ne attend pas cache warmup — naming trompeur |
| F-02 | `BacUsbDebug.h` | Flash USB meme modele SHA — risque limite debug |
| F-03 | `BacOta.h` | `total != len` → abort + failover (comportement correct) |

---

## 7. App mobile Expo (`applications/mobile-rn`)

**Client de production.** Pas de flux OTA cote app (affichage `firmware_version` seulement).

### 7.1 CRITIQUE

#### C-08 — `fetch` sans timeout

**Fichier :** `applications/mobile-rn/src/data/api/ApiClient.ts` L25-L31

Pas de `AbortController`. Reseau mort → attente infinie, `loading: true` bloque l'UI.

**Impacte :** bootstrap, login, claim (24 retries), envoi message, provisioning BLE.

---

#### C-09 — Provisioning BLE bloquant sans annulation

**Fichiers :**
- `applications/mobile-rn/src/app/ble.tsx` L107 — pas de retour arriere pendant Connecting/SendingWifi/WaitingForBox
- `applications/mobile-rn/src/data/ble/BleProvisioner.ts` L118 — connect timeout 30 s
- `applications/mobile-rn/src/data/ble/BleProvisioner.ts` L205-L231 — awaitWifiResult 90 s

Total ~120 s sans bouton Annuler.

---

#### C-10 — `oauth-callback.tsx` spinner infini

**Fichier :** `applications/mobile-rn/src/app/oauth-callback.tsx` L25-L53

`useEffect` async sans try/catch global. Exception → ActivityIndicator permanent.

---

#### C-10b — Login email contourne onboarding

**Fichier :** `applications/mobile-rn/src/app/auth.tsx` L136-L143 vs L148-L162

Email login/register → `/(tabs)/home` direct. OAuth verifie `profile_complete`.

---

### 7.2 ELEVE

| # | Fichier | Probleme |
|---|---------|----------|
| E-10 | `oauth-callback.tsx` L17-L21 | Tokens dans query params deep link |
| E-11 | `onboarding/profile.tsx` L25 | Pas de sortie / deconnexion ; gesture disabled (`_layout.tsx` L91) |
| E-12 | `(tabs)/_layout.tsx` | Pas de garde auth — seul `index.tsx` verifie session |
| E-13 | `auth.tsx` L178-L184 | `oauthBusy` bloque si exception sans finally |
| E-14 | `data/ble/permissions.ts` L3-L4 | iOS BT permission jamais detectee blocked |
| E-15 | `AppErrorBoundary.tsx` L38-L41 | Stack trace affichee en prod |
| E-16 | `store/appStore.ts` L30-L32 | Claim 24×3 s + loading global |
| E-17 | `ApiClient.ts` L25-L30 | `res.json()` sans protection corps invalide |

---

### 7.3 MOYEN

| # | Fichier | Probleme |
|---|---------|----------|
| M-01 | `store/appStore.ts` | Flag `loading` global unique — courses cross-ecrans |
| M-02 | `store/appStore.ts` L846-L847 | BLE live settings echecs avalés (`catch {}`) |
| M-03 | `device/[id].tsx`, `home.tsx`, `boxes.tsx` | Navigation `/ble` meme si permissions refusees |
| M-04 | `store/appStore.ts` L503-L511 | Pas de disconnect BLE sur echec awaitWifiResult |
| M-05 | `BleProvisioner.ts` L241 | Promesse flottante handleStatus |
| M-06 | `BleProvisioner.ts` L259-L269 | confirmOk retourne true en cas d'erreur |
| M-07 | `store/appStore.ts` L312-L326 | Bootstrap echoue silencieusement, tokens restent |
| M-08 | — | Pas de gestion globale hors ligne (NetInfo partiel) |
| M-09 | `BleProvisioner.ts` L171-L172 | Mot de passe WiFi en clair sur BLE (attendu, a documenter) |

---

### 7.4 FAIBLE

| # | Fichier | Probleme |
|---|---------|----------|
| F-01 | `settings.tsx`, `box-settings.tsx` | Routes orphelines (redirect only) |
| F-02 | `app.json` | `RECORD_AUDIO` inutile |
| F-03 | `history.tsx` L51-L55 | Preview errors avalées |
| F-04 | `AppErrorBoundary.tsx` | Reset ne corrige pas cause deterministe |
| F-05 | `BlePermissionCard.tsx` | `onManualWifi` jamais passe |
| F-06 | `compose.tsx` L83-L96 | ensureFontsLoaded sans catch |

---

### 7.5 Points positifs mobile-rn

| Element | Fichier |
|---------|---------|
| Tokens SecureStore | `applications/mobile-rn/src/data/storage/tokenStorage.ts` |
| BLE device storage chiffre | `applications/mobile-rn/src/data/storage/bleDeviceStorage.ts` |
| Pas de console.log secrets | grep `src/` — OK |
| Permissions Android blocked + reglages | `blePermissionStatus.ts`, `BlePermissionCard.tsx` |
| Scan vide : message + bouton | `ble.tsx` L133-L138 |
| Deep link scheme coherent | `app.json`, `AppConfig.ts` |
| AppErrorBoundary present | `AppErrorBoundary.tsx`, `_layout.tsx` |

---

## 8. App mobile KMP (`applications/mobile`) — legacy

### Statut

| Indicateur | KMP | mobile-rn (officiel) |
|------------|-----|----------------------|
| Commits | 7 | 64+ |
| Version | 0.1.0 | Expo SDK 57 |
| iOS | Pas de projet Xcode | iOS via Expo |
| CI | Aucun | Documente |

**Impact audit :** findings KMP = faible priorite sauf distribution manuelle.

### 8.1 CRITIQUE

#### C-K01 — Tokens JWT en clair

**Android :** `applications/mobile/shared/src/androidMain/kotlin/com/tchy/boiteacoeur/data/storage/TokenStorage.android.kt`

SharedPreferences standard (pas EncryptedSharedPreferences).

**iOS :** `applications/mobile/shared/src/iosMain/kotlin/com/tchy/boiteacoeur/data/storage/TokenStorage.ios.kt`

NSUserDefaults non chiffre.

**Aggrave par :** `androidApp/src/androidMain/AndroidManifest.xml` L25 — `allowBackup="true"`.

---

#### C-K02 — Identifiants WiFi dev hardcodes

**Fichier :** `applications/mobile/shared/src/commonMain/kotlin/com/tchy/boiteacoeur/AppConfig.kt` L13-L14

```kotlin
const val DEV_WIFI_SSID = "freebox_MAISON"
const val DEV_WIFI_PASSWORD = "2cc23402B"
```

Pre-rempli par defaut : `BleSetupScreen.kt` L72-L73. Extractible par decompilation APK.

---

### 8.2 ELEVE

| # | Fichier | Probleme |
|---|---------|----------|
| E-K01 | `AuthScreen.kt` L241-L245 | OAuth ouvre URL sans `app=native` + redirect — inerte |
| E-K02 | `AndroidManifest.xml` L40-L54 | Deep links invite declares, jamais traites |
| E-K03 | `ApiClient.kt` L223-L237 | authRequest ne catch que ApiException |
| E-K04 | `HttpClient.android.kt`, `HttpClient.ios.kt` | Pas de HttpTimeout explicite |

---

### 8.3 MOYEN

| # | Fichier | Probleme |
|---|---------|----------|
| M-K01 | `AppViewModel.kt` | Flag loading partage — courses coroutines |
| M-K02 | `BleSetupScreen.kt` L89-L97 | Provisioning ~2 min, retour desactive |
| M-K03 | `AppViewModel.kt` L242, `HomeScreen.kt` L87 | Operateurs `!!` |
| M-K04 | `AppViewModel.kt` L33 | Coroutines sans CoroutineExceptionHandler |
| M-K05 | `BleProvisioner.android.kt` | Catch vides scan/write GATT |
| M-K06 | `ApiClient.kt` L186-L190 | scheduled_at non URL-encoded |

---

### 8.4 FAIBLE

| # | Fichier | Probleme |
|---|---------|----------|
| F-K01 | `ClaimScreen.kt` | Code mort — jamais route |
| F-K02 | — | Pas forgot-password, pas Apple native, pas messages recus |
| F-K03 | — | HTTPS standard, pas de trust-all |
| F-K04 | — | Pas de logs tokens — OK |

---

## 9. Inventaire des endpoints API

**Fichier routes :** `web/backend/src/Routes/ApiRoutes.php` (et `public/index.php` pour pages statiques)

### Sans authentification

| Methode | Route | Rate limit | Risque |
|---------|-------|------------|--------|
| GET | `/health` | — | OK |
| POST | `/api/v1/auth/register` | auth 30/min | OK |
| POST | `/api/v1/auth/login` | auth 30/min | OK |
| POST | `/api/v1/auth/refresh` | auth 30/min | OK |
| POST | `/api/v1/auth/logout` | auth 30/min | OK |
| GET | `/api/v1/auth/verify-email` | auth 30/min | OK |
| POST | `/api/v1/auth/forgot-password` | auth 30/min | OK |
| GET/POST | `/api/v1/auth/reset-password` | auth 30/min | OK |
| GET | `/api/v1/auth/oauth/providers` | auth 30/min | OK |
| GET | `/api/v1/auth/oauth/{provider}/start` | auth 30/min | OK |
| GET/POST | `/api/v1/auth/oauth/{provider}/callback` | auth 30/min | MOYEN |
| POST | `/api/v1/auth/oauth/apple/native` | auth 30/min | **CRITIQUE** |
| GET | `/api/v1/users/me/verify-contact-email` | auth 30/min | OK |
| POST | `/api/v1/devices/register` | devreg 30/min | **CRITIQUE** |
| GET | `/api/v1/usb-debug/releases` | usb-debug-list 60/min | ELEVE |
| GET | `/api/v1/usb-debug/releases/{id}/chunk` | usb-debug-chunk 8000/h | ELEVE |

### Auth device (`X-Device-Uuid` + `X-Device-Secret`)

| Route | Usage |
|-------|-------|
| `/api/v1/devices/poll` | Poll messages |
| `/api/v1/devices/commands/poll` | Poll commandes |
| `/api/v1/devices/firmware/check` | Check OTA |
| `/api/v1/devices/heartbeat` | Heartbeat + firmware_update |
| `/api/v1/devices/deregister` | Deregister |
| `/api/v1/devices/messages/{id}/ack|opened|seen|nack` | ACK messages |
| `/api/v1/devices/commands/{id}/ack|fail` | ACK commandes |

### Auth JWT Bearer

| Route | Usage |
|-------|-------|
| `/api/v1/devices/claim` | Claim boite |
| `/api/v1/devices/me` | Liste boites |
| `/api/v1/devices/{id}` PATCH/DELETE | Update/unclaim |
| `/api/v1/pairings/*` | Codes, contacts |
| `/api/v1/users/me/*` | Profil, migration |
| `/api/v1/messages/*` | Envoi, historique |

### Auth OTA admin (`X-Ota-Admin-Key`)

| Route | Usage |
|-------|-------|
| `/api/v1/updates/*` | Upload, publish, notify OTA |
| `/api/v1/admin/*` | Fleet, factory_reset, lookup |

### Fichiers statiques publics

| Chemin | Fichier |
|--------|---------|
| `/sim/*` | `web/backend/public/sim/` |
| `/admin/*` | `web/backend/public/admin/` |
| `/bac-debug/*` | `web/backend/public/bac-debug/` |
| `/updates/index.html` | `web/backend/public/updates/index.html` |
| `/updates/{version}/firmware.bin` | Alias nginx requis |

---

## 10. Points positifs

### Backend

- Requetes SQL preparees (repositories audites)
- Refresh tokens hashes + rotation
- `hash_equals` cle OTA admin
- Device auth middleware propre (une fois secret obtenu)
- Messages/pairings filtres par ownership
- Zip assets : interdiction `user.txt`, validation chemins pack `.bacassets`
- Unclaim rotate device secret (`DeviceService.php` L220-L222)
- Anti-enumeration forgot-password et delete-me
- Honeypot delete-me form

### Firmware

- SHA256 + taille avant commit OTA firmware
- Dual-bank 3 Mo
- Assets avant firmware (ordre d'install)
- Failover URLs OTA download
- Backoff SHA256 apres 3 echecs OTA
- BLE provisioning buffers bornes
- BACM parsing valide
- TLS bundle CA production
- WiFi/Lost/BLE recovery paths

### mobile-rn

- SecureStore tokens
- Pas de logs sensibles
- BLE permission UX Android
- Error boundary + boot error screen
- Mapping erreurs API enrichi (`errors.ts`)

---

## 11. Annexes

### 11.1 Fichiers audites (liste principale)

```
web/backend/
  config/settings.php
  public/index.php
  src/Controllers/AuthController.php
  src/Controllers/DeviceController.php
  src/Controllers/OAuthController.php
  src/Controllers/OtaController.php
  src/Controllers/UsbDebugController.php
  src/Controllers/InviteController.php
  src/Controllers/MessageController.php
  src/Middleware/JwtAuthMiddleware.php
  src/Middleware/DeviceAuthMiddleware.php
  src/Middleware/OtaAdminMiddleware.php
  src/Middleware/RateLimitMiddleware.php
  src/Middleware/CorsMiddleware.php
  src/Services/AuthService.php
  src/Services/DeviceService.php
  src/Services/OAuthService.php
  src/Services/OtaService.php
  src/Services/PairingService.php
  src/Services/MessageService.php
  src/Services/EmailService.php
  src/Support/AssetsPackBuilder.php
  src/Repositories/*.php

firmware/boite-a-coeur/
  boite-a-coeur.ino
  BacApp.h
  BacOta.h
  BacAssetsOta.h
  BacCloudClient.h
  BacBle.h
  BacUserConfig.h
  BacTls.h
  BacUrlFailover.h
  BacMessageStore.h
  BacOtaPayload.h
  Projet_setup.h

applications/mobile-rn/
  src/data/api/ApiClient.ts
  src/data/api/errors.ts
  src/data/api/oauth.ts
  src/data/ble/BleProvisioner.ts
  src/data/ble/blePermissionStatus.ts
  src/store/appStore.ts
  src/app/ble.tsx
  src/app/oauth-callback.tsx
  src/app/auth.tsx
  src/app/index.tsx
  src/components/AppErrorBoundary.tsx

applications/mobile/
  shared/src/commonMain/kotlin/.../ApiClient.kt
  shared/src/commonMain/kotlin/.../AppViewModel.kt
  shared/src/commonMain/kotlin/.../AppConfig.kt
  shared/src/.../TokenStorage.*.kt
  androidApp/src/androidMain/AndroidManifest.xml
```

### 11.2 Comptage findings

| Severite | Backend | Firmware | mobile-rn | KMP | Total |
|----------|---------|----------|-----------|-----|-------|
| CRITIQUE | 4 | 4 | 4 | 2 | 14 |
| ELEVE | 5 | 7 | 8 | 4 | 24 |
| MOYEN | 10 | 6 | 9 | 6 | 31 |
| FAIBLE | 4 | 3 | 6 | 4 | 17 |

*(Chevauchements transversaux comptes par domaine.)*

### 11.3 Backup

```
C:\Users\Puparia\Documents\GitHub\Lovebox-backups\20260719-050338\
  Lovebox.bundle      # git bundle --all
  MANIFEST.txt        # commit, branche, date
  working-tree/       # copie miroir (excl. node_modules, .expo, __pycache__, .git, factory/releases)
```

Restauration bundle :

```powershell
git clone Lovebox.bundle Lovebox-restored
```

---

## 11.4 Statut de remediation

Correctifs appliques le 2026-07-19 sur l'ensemble des findings des sections 5 a 8 (backend, firmware, mobile-rn, KMP). Non compile / non deploye (build cote utilisateur).

Actions manuelles requises cote utilisateur :

- `web/backend` : appliquer la migration `migrations/011_oauth_exchange_codes.sql`, lancer `composer install`, definir les nouvelles variables d'env (`JWT_ISSUER`, `JWT_AUDIENCE`, `REQUIRE_EMAIL_VERIFICATION`, `CORS_ALLOWED_ORIGINS`, `TRUSTED_PROXIES`, `ADMIN_API_KEY`, `USB_DEBUG_TOKEN_SECRET`, `USB_DEBUG_TOKEN_TTL`, `LONG_POLL_MAX_SECONDS`).
- `applications/mobile` (KMP) : `androidx.security:security-crypto` ajoute a `libs.versions.toml` + `shared/build.gradle.kts` — resync gradle.
- OAuth : le flux web bascule sur un code d'echange one-shot (`?code=` + `POST /auth/oauth/exchange`). Backend et mobile-rn sont alignes ; deployer conjointement.
- Firmware : le rollback A/B ne se confirme qu'apres smoke test (WiFi + FFAT + frame rendue + stabilite) ; verifier que le rollback est active au bootloader.

Choix d'architecture notables : E-01/E-02 durcis sans challenge cryptographique (l'app ne connait pas le device_secret) ; E-11 api_secret isole dans un namespace NVS dedie (chiffrement materiel non activable en pur firmware) ; E-K01 boutons OAuth KMP desactives explicitement (feature absente de l'app legacy) ; E-K02 deep links invite retires (endpoint backend inexistant).

---

*Document genere le 2026-07-19. Findings identifies en audit lecture seule ; correctifs appliques le meme jour (voir 11.4).*
