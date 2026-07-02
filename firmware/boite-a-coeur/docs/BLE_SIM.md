# BLE simulator

`firmware/boite-a-coeur/ble-sim/` is a local Flask app for development: BLE scan/connect, WiFi provisioning, LAN discovery, and BACM message send — without a mobile app.

## Requirements

- Python 3.10+
- Bluetooth adapter supported by [Bleak](https://github.com/hbldh/bleak) (Windows 10+, macOS, Linux)
- Device powered and in provisioning or idle on the same LAN (for messages)

## Install and run

```bash
cd firmware/boite-a-coeur/ble-sim
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
python app.py
```

Open **http://127.0.0.1:8765**

## Lucarne editor assets

The message composer embeds Lucarne editor scripts (icons, packing). Resolve path:

1. **Default:** sibling checkout `../Lucarne/editor` (from Lovebox repo root: `Lovebox/../Lucarne/editor`)
2. **Override:** set environment variable `LUCARNE_EDITOR` to the editor directory

```
set LUCARNE_EDITOR=C:\path\to\Lucarne\editor
```

The app serves files under `/lucarne/<path>`. If the directory is missing, the composer returns 404.

## API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | Web UI |
| GET | `/api/status` | BLE connection state and logs |
| POST | `/api/scan` | BLE scan (`timeout`, `show_all`) |
| POST | `/api/connect` | Connect by BLE address |
| POST | `/api/disconnect` | Disconnect |
| POST | `/api/provision` | Write WiFi creds (`ssid`, `password`, `format`: `pipe` or `newline`) |
| GET | `/api/discover` | Scan LAN for boxes (`GET :8080/info`) |
| POST | `/api/send-message` | POST BACM body to box (`?ip=` or JSON `ip`) |

## Typical workflow

1. Put the box in BLE mode (`lost_connection` or first-setup WiFi step).
2. Scan and connect in the UI.
3. Provision WiFi; wait for the box to join the network.
4. **Discover** finds devices reporting name, uuid, and IP.
5. Compose a message and **Send** — forwards to `http://<ip>:8080/message`.

## BLE filters

Scan filters by service UUID or name hints (`bac`, `boite`, `coeur`, `boiteacoeur`). Enable **show all** to list every peripheral.

## Files

| Path | Role |
| --- | --- |
| `app.py` | Flask routes |
| `ble_manager.py` | Async Bleak wrapper |
| `static/` | UI, `message_pack.js`, composer |
