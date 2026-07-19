# Factory provisioning

One-command production flash with full traceability.

**Documentation complete (FR)** : [`GUIDE.fr.md`](GUIDE.fr.md) — versionnage, release OTA, modes factory, test USB, depannage.

## First-time setup

```powershell
cd factory
.\setup_tools.ps1
pip install -r requirements.txt
```

Requires **arduino-cli** in PATH and **Lucarne** library (sibling repo or Arduino libraries folder).

## Release OTA (no device)

Build, upload to server, publish **without fleet notify**. Trigger updates per device yourself.

```powershell
$env:OTA_ADMIN_KEY = "your-key"
python factory\release.py --version 1.0.22 --set-version --upload --publish
python factory\ota_device.py --serial BACXS32P10052026R2 --release-id 42 --force
```

Options: `--with-assets` (FFAT zip), `--notes`, `--channel`, `--min-version`. Local archive only: omit `--upload`.

## Provision a new device

```powershell
python factory\provision.py --new --port COM5
```

## Re-flash existing device (modes)

```powershell
python factory\provision.py --list-modes
python factory\provision.py --serial SERIAL --port COM5 --mode update
python factory\provision.py --serial SERIAL --port COM5 --mode reset-same-ids
python factory\provision.py --serial SERIAL --port COM5 --mode reset-new-ids
```

| Mode | Description |
|------|-------------|
| `update` | Firmware only; NVS + FFAT + WiFi/claim preserved |
| `reset-same-ids` | Full flash; same serial + uuid; factory NVS defaults |
| `reset-new-ids` | Full flash; same serial; new uuid; factory NVS defaults |

Legacy: `--firmware-only` equals `--mode update`.

### Full reflash keeping runtime config

```powershell
python factory\provision.py --serial SERIAL --port COM5 --runtime-config runtime.txt
```

## What gets flashed (full provision)

| Partition | Content |
|-----------|---------|
| app0 | Firmware (`BacFirmware.h` version from `factory/VERSION` or `--version`) |
| ffat | `data/assets/` + one-shot `user.txt` (migrated to NVS on first boot) |
| nvs | Factory identity + defaults (or merged runtime export) |

## Traceability

- Provision: `factory/archives/{SERIAL}/{timestamp}/`
- Release: `factory/releases/{VERSION}/{timestamp}/`
- Registry: `factory/registry.json`

```powershell
python factory\provision.py --list-devices
```

## Version

Edit `factory/VERSION` or pass `--version X.Y.Z`. Current: see `factory/VERSION`.

## USB debug / direct firmware test

See `firmware/boite-a-coeur/docs/USB_DEBUG.md` and `/public/bac-debug/`.
