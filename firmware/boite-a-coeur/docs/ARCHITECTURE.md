# Architecture

Boîte à Cœur is an ESP32 firmware sketch under `firmware/boite-a-coeur/`. It renders UI with the [Lucarne](https://github.com/Pupariaa/Lucarne) Arduino library (installed from the sibling checkout at `../Lucarne`), handles capacitive touch, provisions WiFi over BLE, and receives RGB565 messages over HTTP.

## Entry point

`boite-a-coeur.ino` wires hardware and delegates runtime logic to `BacApp`:

1. Initialize display (`ST7789`), SPI, and Lucarne `UI` from generated `Projet*.h`.
2. Mount the FFat volume (`projet::initStorage()`).
3. Warm screen assets via `BacScreenCache` (splash first).
4. Call `BacApp::onCacheReady()` to branch into first setup, lost WiFi, or normal WiFi boot.
5. Each frame: `BacApp::tick()`, `ui.update()`, optional message overlay, `projet::update()`.

## Module map

| Module | Role |
| --- | --- |
| `Projet.h`, `Projet_setup.h`, `Projet_*.h` | Studio export: screens, widgets, pins, storage |
| `BacApp` | State machine, navigation, touch, WiFi/BLE lifecycle |
| `BacBle` | BLE GATT server for WiFi credential writes |
| `BacWifi` | STA connect, reconnect, link-loss detection |
| `BacUserConfig` | Persistent `user.txt` on FFat |
| `BacScreenCache` | Boot and lazy asset warming for screens |
| `BacTouch` | Median-filtered `touchRead()` on GPIO 1 |
| `BacTimeSync` | NTP + timezone offset via ip-api.com |
| `BacMessageStore` | Parse and hold BACM v1 payloads in RAM |
| `BacMessageServer` | HTTP server on port 8080 (`/ping`, `/info`, `/message`) |
| `BacMessageRenderer` | Draw message layers over the display buffer |
| `BacScreens` | Firmware-only screens (e.g. `message_opened`) |
| `LoveboxFramePacer` | Target 45 FPS frame timing |

## Operating modes

`BacApp` tracks a top-level `Mode`:

| Mode | When | Behaviour |
| --- | --- | --- |
| `Caching` | Boot, before cache ready | Screen cache warming |
| `FirstSetup` | `configured: 0` in `user.txt` | Onboarding screens P1–P4, BLE WiFi |
| `WifiBoot` | WiFi creds present at boot | Connect, NTP, then idle |
| `Idle` | Connected and ready | Home screen, message server, settings entry |
| `Lost` | No WiFi or link lost | `lost_connection` + BLE provisioning |
| `Settings` | Long-press from idle/lost | Settings menu tree |

First-time setup uses `FirstStep` (`P1` → `P2` → `P3` → WiFi connect → `P4` or error).

## Boot decision tree

```
onCacheReady()
├── not deviceConfigured → FirstSetup (P1)
├── no WiFi creds        → Lost + BLE on
└── WiFi creds           → WifiBoot → Idle (or Lost on failure)
```

## Message path

When WiFi is up and the device is idle:

1. `BacMessageServer` listens on `0.0.0.0:8080`.
2. `POST /message` receives a BACM binary (multipart or raw body).
3. Payload is queued and parsed by `BacMessageStore`.
4. UI navigates to `new_message`; user opens `message_opened`.
5. `BacMessageRenderer` composites background + layers each frame in `drawMessageOverlay()`.

Messages received during setup or settings are stored but do not interrupt those flows.

## BLE vs WiFi

BLE is used only for provisioning (SSID/password). It advertises on demand, shuts down after credentials are applied, and restarts in `Lost` mode. WiFi carries NTP, timezone lookup, and the message HTTP API.

## Generated vs hand-written code

Studio export produces `Projet.h`, `Projet_fonts.h`, `Projet_icons.h`, `Projet_images.h`, and volume assets under `data/`. Application logic lives in `Bac*.h` and is not overwritten by export.
