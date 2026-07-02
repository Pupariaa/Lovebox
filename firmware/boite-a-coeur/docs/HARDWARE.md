# Hardware

Boîte à Cœur targets an ESP32 driving an ST7789 TFT with a single capacitive touch pad.

## Display

| Parameter | Value |
| --- | --- |
| Driver | ST7789 |
| Panel size | 240 × 280 px (native) |
| Rotation | 1 (`Projet_setup.h`) |
| Logical size | 280 × 240 px (width × height after rotation) |
| Colour order | RGB |
| Invert | `true` |
| SPI clock | 40 MHz, mode 3 |
| Backlight | Not wired (`bl = -1`) |

Message payloads (BACM) and the HTTP `/info` endpoint report `w: 280`, `h: 240`.

## GPIO (from `Projet_setup.h`)

| Signal | GPIO |
| --- | --- |
| CS | 16 |
| DC | 15 |
| RST | 8 |
| MOSI | 18 |
| MISO | not used (-1) |
| SCLK | 17 |

SPI bus init: `SPI.begin(17, -1, 18, 17)` — SCLK 17, MISO unused, MOSI 18, CS 17 in `begin()` (display CS uses pin 16 via `DisplayPins`).

## Touch

| Parameter | Value |
| --- | --- |
| Pin | **GPIO 1** (`TOUCH_PIN` in `boite-a-coeur.ino`) |
| API | ESP32 `touchRead()` |
| Filtering | Triple sample, median (`BacTouch`) |

Press detection uses calibrated thresholds in `BacApp` (`TOUCH_PRESS_MIN`, `TOUCH_RELEASE_MAX`, etc.). Touch is armed after delays on setup screens and disabled during early boot.

## Storage

Internal FFat partition (`ffat` label). SD card support is compiled out (`LUCARNE_ENABLE_SD 0`).

## WiFi / BLE

ESP32 integrated radio. BLE runs only during provisioning; coexistence prefers WiFi when connecting (`esp_coex_preference_set`).

## Serial debug

USB UART at **115200** baud. Touch samples log every 250 ms when `BacTouch` is passed to `BacApp::begin()`.
