# Boîte à Cœur — firmware

ESP32 firmware: Lucarne UI, touch, BLE WiFi provisioning, cloud messaging (BACM), local HTTP messages (dev).

**Current version:** 1.0.10 (`BacFirmware.h` / `factory/VERSION`).

**Dependency:** [Lucarne](https://github.com/Pupariaa/Lucarne) Arduino library (install separately).

## Quick start

1. Install Lucarne from `../Lucarne` or Library Manager.
2. Open `boite-a-coeur/` in Arduino IDE (`boite-a-coeur.ino`).
3. Edit UI in Studio with `Lovebox.lucarne.json` → export `Projet*.h` here.
4. Upload **`data/assets/`** to FFAT (nothing else in `data/` — see [factory/README.md](factory/README.md)).
5. Flash sketch.

## ble-sim (dev)

```bash
cd ble-sim
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

http://127.0.0.1:8765 — BLE provisioning + message composer.

Lucarne Studio assets: sibling checkout `../Lucarne/editor` or set `LUCARNE_EDITOR`.

## Docs

| File | Topic |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Modules, boot, messages |
| [docs/SETUP.md](docs/SETUP.md) | Build and flash |
| [factory/README.md](factory/README.md) | Device identity, FFAT vs NVS, recovery |
| [docs/HARDWARE.md](docs/HARDWARE.md) | Panel, GPIO |
| [docs/BLE_WIFI.md](docs/BLE_WIFI.md) | Provisioning |
| [docs/BLE_SIM.md](docs/BLE_SIM.md) | Flask simulator |
| [docs/MESSAGES.md](docs/MESSAGES.md) | BACM + composer |
| [docs/STUDIO.md](docs/STUDIO.md) | Lucarne export |
| [docs/SCREENS.md](docs/SCREENS.md) | Screen names |
