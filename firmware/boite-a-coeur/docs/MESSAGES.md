# Messages (BACM v1)

Incoming love messages are binary **BACM** blobs received over HTTP, parsed into RAM, and rendered full-screen on the 280×240 display.

## HTTP API

Server: `BacMessageServer` on port **8080** (started when WiFi is connected and app is idle).

| Endpoint | Method | Response |
| --- | --- | --- |
| `/ping` | GET | `ok` |
| `/info` | GET | JSON: `name`, `uuid`, `ip`, `w`, `h`, `port` |
| `/message` | POST | Binary BACM body (max 2 MiB) |

### POST /message

Accepts:

- Raw body (`Content-Type: application/octet-stream` or `text/plain`)
- Multipart upload with field `message` (used by ble-sim)

On success the device queues the payload; `BacMessageStore::loadFromBinary()` validates and allocates. UI switches to `new_message` when idle.

## BACM v1 layout

Little-endian unless noted.

| Offset | Size | Field |
| --- | --- | --- |
| 0 | 4 | Magic `BACM` |
| 4 | 2 | Version (`1`) |
| 6 | 2 | Width (`280`) |
| 8 | 2 | Height (`240`) |
| 10 | 1 | Layer count (max 8) |
| 11 | 1 | Reserved (`0`) |
| 12 | W×H×2 | Background RGB565 |
| … | 16 × N | Layer headers |
| … | variable | Layer pixel data |

### Layer header (16 bytes)

| Offset | Field |
| --- | --- |
| 0 | Type: `0` = static, `1` = animated |
| 1 | FPS (animation only; default 12 if 0) |
| 2–3 | X position |
| 4–5 | Y position |
| 6–7 | Width |
| 8–9 | Height |
| 10–11 | Frame count |
| 12–15 | Data size (bytes) |

Static layers: one RGB565 bitmap (`w × h × 2`). Animated layers: `frameCount` frames concatenated.

## Rendering

`BacMessageRenderer` draws background then layers in order. Animation advances by FPS timing. The overlay runs in `loop()` via `BacApp::drawMessageOverlay()` on screen `message_opened`.

## Composer (ble-sim)

`ble-sim/static/message_pack.js` builds BACM from HTML canvas elements:

- Fixed canvas 280×240
- Background fill + optional static/animated layers
- `packMessage()` emits the binary buffer

Send via the ble-sim UI (**Discover** → select IP → **Send**) or directly:

```bash
curl -X POST --data-binary @message.bacm http://<box-ip>:8080/message
```

## Memory

Payloads up to **2 097 152** bytes. Allocation prefers PSRAM when available (`heap_caps_malloc` with `MALLOC_CAP_SPIRAM`).

## User flow

1. Message arrives → `new_message` notification screen
2. User tap → `message_opened` (firmware screen in `BacScreens.h`)
3. Touch navigates back to `idle`

Messages received during `FirstSetup`, `WifiBoot`, or `Settings` are stored but do not change screen until those modes end.
