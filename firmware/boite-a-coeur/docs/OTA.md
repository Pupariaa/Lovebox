# OTA (Boite a Coeur)

## Partition table

Board scheme: **`app3M_fat9M_16MB`**.

| Partition | Role |
|-----------|------|
| app0 / app1 | Firmware OTA dual-bank |
| nvs | User config (Preferences namespace `bac`) |
| ffat | `/assets/` only |

## Gating

OTA runs only when:

- Backend: device is **claimed** (`owner_user_id IS NOT NULL`)
- Firmware: `setupComplete()` = configured + WiFi + API secret + claimed cache
- Firmware: mode is **Idle** (blocked during first setup and settings)

After phone claim, backend enqueues OTA immediately; device picks it up on next command poll.

## Backend

- Admin UI: `https://<host>/public/updates/` (requires `X-Ota-Admin-Key` header, env `OTA_ADMIN_KEY`)
- Firmware: `firmware.bin`
- Assets: zip of **`assets/` only** → converted server-side to `assets.bacassets`
- Served at: `/updates/{version}/firmware.bin` and `assets.bacassets`

### FFAT policy (assets OTA)

1. Download pack once to `/ota/staging.baca` on FFAT
2. Verify SHA-256 against payload `assets_sha256`
3. If verify fails: delete staging, **existing `/assets/` untouched**
4. Wipe **`/assets/` tree only**
5. Install from local staging file (no second network download)
6. `FFat.end()` sync, remount volume, delete staging

### Zip upload rules

- Entries must start with `assets/`
- `user.txt` is rejected if present
- PHP builds `assets.bacassets` from the zip contents

### OTA command payload (all hash/size fields required on device)

```json
{
  "version": "1.0.1",
  "url": "https://.../firmware.bin",
  "sha256": "...",
  "size": 2518368,
  "assets_url": "https://.../assets.bacassets",
  "assets_sha256": "...",
  "assets_size": 8390000
}
```

Register response includes `claimed: true|false`. `firmware_update` is sent only when claimed.

## Firmware

- `BacUserConfig.h` — NVS config, one-shot migration from legacy `/user.txt`
- `BacOtaPayload.h` — parse and validate OTA payload
- `BacOta.h` — firmware slot update with Content-Length + SHA-256 verify (8 KB buffer)
- `BacAssetsOta.h` — staging download, wipe `/assets/`, offline install
- `BacTls.h` — CA bundle (compile with `BAC_DEV_INSECURE_TLS` for local dev only)
- Order: firmware first, then assets, reboot only if firmware changed
- Assets-only update: no reboot, return to idle
- OTA failure: `POST /commands/{id}/fail` (backend marks command failed after 10 min delivered timeout)

## Creating the assets zip

From `firmware/boite-a-coeur/data/`:

```bash
zip -r assets.zip assets/
```

Do not include `user.txt`, `VOLUME_MANIFEST.txt`, or other root files.

## Factory / device recovery (FFAT corrupted)

1. Flash firmware with this OTA/NVS build over USB
2. Upload FFAT `data/assets/` only (no `user.txt`)
3. BLE WiFi provision + phone claim
4. OTA runs from backend enqueue on claim (or admin “Renvoyer OTA”)

Legacy devices with `/user.txt` on FFAT: config migrates to NVS on first boot, then `user.txt` is removed.
