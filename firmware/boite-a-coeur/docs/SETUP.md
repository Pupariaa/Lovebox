# Setup

Build and flash the Boîte à Cœur firmware from `firmware/boite-a-coeur/`.

## Prerequisites

- Arduino IDE 2.x (or arduino-cli)
- ESP32 board support (Espressif)
- Python 3.10+ (only for `ble-sim`, optional)
- Lucarne library from the sibling repo `../Lucarne`

## Install Lucarne

Clone Lucarne next to the Lovebox repo:

```
Lovebox/
Lucarne/
```

In Arduino IDE: **Sketch → Include Library → Add .ZIP Library** or add `../Lucarne` as a library source. The sketch includes `<Lucarne.h>` and relies on `LucarneStorageConfig.h` for volume mounting.

## Board settings

| Setting | Value |
| --- | --- |
| Board | ESP32 module matching your hardware |
| Partition scheme | **16M Flash (3MB APP/9.9MB FATFS)** |
| Flash size | 16 MB (if selectable) |
| PSRAM | Enabled when available |

The partition label must be `ffat` (see `Projet_setup.h` → `mountVolume(..., "ffat")`).

## Configure storage flags

`LucarneUserConfig.h` (also copied under `data/`) enables FFat and disables SD:

```c
#define LUCARNE_ENABLE_SD 0
#define LUCARNE_ENABLE_VOLUME_FAT 1
#define LUCARNE_ENABLE_VOLUME 1
```

## User config (NVS)

User settings are stored in **NVS** (Preferences namespace `bac`), not on FFAT.

See **[factory/README.md](../factory/README.md)** for device identity files and recovery steps.

At factory, program identity via:

| Method | Notes |
| --- | --- |
| `factory/devices/{SERIAL}.user.txt` | One-shot migration: copy to `data/user.txt`, upload FFAT once, delete |
| NVS partition tool | Write keys under namespace `bac` directly |

Required for cloud register: `serial_number`, valid 128-digit `uuid` (auto-generated if missing).

Keys persisted in NVS:

| Key | Purpose |
| --- | --- |
| `device_name` | BLE advertised name (default `BoiteACoeur`) |
| `serial_number` | Device serial string |
| `ssid` / `psw` | WiFi credentials (empty until provisioned) |
| `configured` | `false` = run first-setup flow |
| `claimed` | Cache from backend register (`owner_user_id`) |
| `uuid` | 128-digit identifier |
| `api_secret` | Device cloud secret |
| `tz_offset` | Optional timezone offset in seconds |

`setupComplete()` requires configured + WiFi + secret + claimed. OTA is blocked until claim.

## Upload volume assets

1. Open `firmware/boite-a-coeur/` as the sketch folder.
2. **Tools → ESP32 Sketch Data Upload** (or equivalent FFat uploader).
3. Upload **`data/assets/`** only (no `user.txt` on new factory images).

See `factory/VOLUME_MANIFEST.txt` for the expected file list and partition notes.

## Flash firmware

1. Open `boite-a-coeur.ino`.
2. Select the correct serial port.
3. Upload the sketch.

Serial monitor at **115200** baud shows boot mode (`first setup`, `no wifi`, `wifi boot`, etc.).

## UI changes

Edit screens in Lucarne Studio using `Lovebox.lucarne.json`, export headers into the sketch folder, re-upload `data/` if assets changed, then reflash. See [STUDIO.md](STUDIO.md).

## Development tools

- [BLE_SIM.md](BLE_SIM.md) — local BLE + message composer without physical phone
- [MESSAGES.md](MESSAGES.md) — BACM format and HTTP API
- Compile flag `BAC_DEV_INSECURE_TLS` — skip TLS certificate verification (local dev only)

## Factory recovery

If FFAT is corrupted after a failed OTA:

1. Reflash firmware over USB
2. Re-upload FFAT assets
3. BLE provision + phone claim → OTA from backend

See [OTA.md](OTA.md) for the full recovery flow.
