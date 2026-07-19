# Hardware

Boite a coeur targets an ESP32 driving an ST7789 TFT with a single capacitive touch pad.

## Display

| Parameter | Value |
| --- | --- |
| Driver | ST7789 |
| Panel size | 240 x 280 px (native) |
| Rotation | 1 (`Projet_setup.h`) |
| Logical size | 280 x 240 px (width x height after rotation) |
| Colour order | RGB |
| Invert | `true` |
| SPI clock | 40 MHz, mode 3 |
| Backlight | GPIO 38 via A03401 (P-channel MOSFET, likely AO3401 class) — **not enabled in firmware yet** (`pins.bl = -1`) |

Hardware audit pending on a real board (continuity GPIO 38 → A03401 → panel, polarity). Until then, `BacBacklight` and NVS `bl_level` are implemented but have no physical effect. PWM dimming is not wired; when enabled, `backlight_level` maps to off at 0 and on above 0.

## GPIO (from `Projet_setup.h`)

| Signal | GPIO |
| --- | --- |
| CS | 16 |
| DC | 15 |
| RST | 8 |
| BL | 38 |
| MOSI | 18 |
| MISO | not used (-1) |
| SCLK | 17 |

SPI bus init: `SPI.begin(17, -1, 18, 17)` — SCLK 17, MISO unused, MOSI 18, CS 17 in `begin()` (display CS uses pin 16 via `DisplayPins`).

### Backlight path (audit BaC-S3-v1)

```
ESP32 GPIO38 --> A03401 gate (via resistor network)
A03401 drain --> panel backlight LED+
A03401 source --> GND
```

Expected behaviour: active-high GPIO drives the MOSFET ON. Confirm polarity on the production board before enabling PWM.

## Touch

| Parameter | Value |
| --- | --- |
| Pin | GPIO 1 (`TOUCH_PIN` in `boite-a-coeur.ino`) |
| API | ESP32 `touchRead()` |
| Filtering | Triple sample, median (`BacTouch`) |

Press detection uses calibrated thresholds in `BacApp` (`TOUCH_PRESS_MIN`, `TOUCH_RELEASE_MAX`, etc.). Touch is armed after delays on setup screens and disabled during early boot.

## Power / sleep

| NVS key | Default | Description |
| --- | --- | --- |
| `bl_level` | 100 | Backlight level 0-100 |
| `sleep_timeout` | 30 | Inactivity delay before sleep (seconds) |
| `disp_sleep` | true | Turn display off when sleeping |

Cloud long-poll and OTA remain active during display sleep.

## Storage

Internal FFat partition (`ffat` label). SD card support is compiled out (`LUCARNE_ENABLE_SD 0`).

## WiFi / BLE

ESP32 integrated radio. BLE advertises at low duty cycle in idle for app settings access; full-rate advert during provisioning.

## Serial debug

USB UART at 115200 baud. Touch samples log every 250 ms when `BacTouch` is passed to `BacApp::begin()`.
