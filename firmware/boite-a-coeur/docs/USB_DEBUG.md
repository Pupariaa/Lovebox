# USB debug (BAC-XS3)

## Peripherique USB

Sur ESP32-S3 (FQBN `USBMode=default`, `CDCOnBoot=cdc`, `UploadMode=cdc`), la Boite expose un port serie USB via TinyUSB OTG.

| Champ | Valeur |
|-------|--------|
| Fabricant | Techalchemy |
| Produit | BAC-XS3 |
| Interface CDC (Web Serial) | `BAC-XS3` ou `BAC-XS3 <serial>` |
| Numero de serie | NVS `bac` / `serial_number` (ex. `BACXS32F10012026R2`) |

Chrome et Windows utilisent le descripteur **iInterface** de l'interface CDC pour nommer le port dans Web Serial. Le core Arduino ESP32 le fixe a `TinyUSB CDC` dans `USBCDC.cpp` ; il n'existe pas encore d'API officielle ([issue #11394](https://github.com/espressif/arduino-esp32/issues/11394)).

La factory patche automatiquement `USBCDC.cpp` pour appeler `bac_usb_cdc_interface_name()` (defini dans `BacUsbIdentity.cpp`). Compilation manuelle depuis l'IDE : lancer une fois `python -c "from factory.lib.arduino_usbcdc_patch import apply_usbcdc_patch; apply_usbcdc_patch()"`.

Apres changement de nom USB, Windows peut garder l'ancien libelle en cache : debrancher/rebrancher ou desinstaller le peripherique dans le Gestionnaire de peripheriques.

## Protocole `@BAC`

Lignes texte terminees par `\n`, prefixe `@BAC `.

### Commandes

| Commande | Description |
|----------|-------------|
| `PING` | Identite firmware, serial, nom device |
| `HELP` | Liste des commandes |
| `ANALYZE` | Diagnostic (serial, WiFi, NVS, FFAT, heap, OTA, mode) |
| `FLASH_BEGIN size=N sha256=HEX64` | Ouvre une session d'ecriture OTA |
| `FLASH_CHUNK HEX` | Chunk binaire (max 384 octets, hex pair) |
| `FLASH_END` | Verifie SHA256, finalise OTA, reboot |
| `FLASH_ABORT` | Annule la session |

### Reponses

- `@BAC OK ...` succes
- `@BAC ERR ...` erreur
- `@BAC CHECK code ok|fail detail` (pendant ANALYZE)
- `@BAC INFO ...` (pendant ANALYZE)
- `@BAC ANALYZE_BEGIN` / `@BAC ANALYZE_END issues=N`

Les commandes contenant `read`, `dump`, `export`, `download` ou `extract` sont refusees.

## Securite firmware

- **Ecriture seule** : le protocole ne propose aucune lecture de flash ni export du binaire.
- **Slot OTA cible** : `esp_ota_get_next_update_partition` + API `Update` Arduino (partition inactive uniquement).
- **Integrite** : SHA256 calcule pendant la reception ; mismatch = abort.
- **Exclusivite** : flash refuse si OTA cloud en cours ou session deja active.
- **Acces physique** : esptool / JTAG restent possibles avec acces materiel ; hors perimetre de cette interface.

## Interface web

Page statique : `/public/bac-debug/` (Web Serial API, Chrome/Edge).

1. Connecter la BaC en USB (filtre VID Espressif `0x303A`).
2. Ping : le serial est lu depuis la BaC.
3. Analyse profonde.
4. Choisir une version **publiee** sur le serveur.
5. Le navigateur recupere des morceaux via `GET /api/v1/usb-debug/releases/{id}/chunk` (header `X-Bac-Serial`) et les relaie vers la BaC.

API publique utilisateur, sans cle admin. Les morceaux firmware exigent le serial lu sur la BaC connectee.

## Integration firmware

- `boite-a-coeur.ino` : appel `BacUsbIdentity::begin()` (no-op ; l'identite est posee dans `BacUsbIdentity.cpp`).
- `BacSerialConsole.h` : lignes `@BAC` routees vers `BacUsbDebug::handleLine()`.
- Buffer ligne etendu a 1100 caracteres pour `FLASH_CHUNK`.
