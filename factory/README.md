# Factory provisioning

One-command production flash with full traceability.

## First-time setup

```powershell
cd factory
.\setup_tools.ps1
pip install -r requirements.txt
```

Requires **arduino-cli** in PATH and **Lucarne** library (sibling repo or Arduino libraries folder).

## Provision a new device

```powershell
python factory\provision.py --new
```

Interactive: picks serial port, generates identity, compiles firmware, builds FFAT, flashes everything, archives binaries.

Or explicit:

```powershell
python factory\provision.py --new --port COM5 --version 1.0.1
```

## Re-flash existing device

```powershell
python factory\provision.py --serial BACXS32W23262026R2 --port COM5
```

### Firmware update without losing WiFi / claim

Full provision rewrites NVS (`configured`, `claimed`, WiFi, `api_secret` reset). For dev firmware updates on an already configured box:

```powershell
python factory\provision.py --serial BACXS32P10052026R2 --port COM120 --firmware-only
python factory\provision.py --serial BACXS32A10062026R2 --port COM82 --firmware-only
```

Only the app partition at `0x10000` is written; NVS and FFAT stay intact.

### Full reflash while keeping runtime config

On the device serial monitor, run `export config` and save the output to a file. Then:

```powershell
python factory\provision.py --serial BACXS32P10052026R2 --port COM120 --runtime-config runtime.txt
```

Factory identity (`uuid`, serial) comes from `factory/devices/{SERIAL}.user.txt`; WiFi, secrets, and claim flags are taken from the export file.

## What gets flashed

| Partition | Content |
|-----------|---------|
| app0 | Firmware (`BacFirmware.h` version from `factory/VERSION` or `--version`) |
| ffat | `data/assets/` + one-shot `user.txt` (migrated to NVS on first boot) |
| nvs | Written by device on boot after migration |

## Traceability

Each provision creates:

```
factory/archives/{SERIAL}/{timestamp}/
  manifest.json       device + version + sha256
  identity.json
  user.txt
  boite-a-coeur.ino.bin
  ffat.bin
  bootloader / partitions / boot_app0
```

`factory/registry.json` tracks all devices and `provision_history`.

List devices:

```powershell
python factory\provision.py --list-devices
```

## OTA test on one device

CLI:

```powershell
set OTA_ADMIN_KEY=your-key
python factory\ota_device.py --serial BACXS32W23262026R2 --force
python factory\ota_device.py --serial BACXS32W23262026R2 --lookup
```

Admin UI: `/public/updates/` section **Test device**.

## Version bump

Edit `factory/VERSION` before provision, or pass `--version X.Y.Z`. Current release: **1.0.10**.

## Build without flash

```powershell
python factory\provision.py --new --build-only
```
