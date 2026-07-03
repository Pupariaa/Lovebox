# Messages (BACM v1)

Incoming love messages are binary **BACM** blobs. They can arrive over **cloud long-poll** (production) or **local HTTP** (dev).

## Cloud path (production)

`BacCloudClient` long-polls `GET /api/v1/devices/poll` when WiFi is up.

1. Server returns BACM body with headers `X-Message-Id`, `X-Message-Bytes`, optional `X-Display-Duration-Sec` (ephemeral = 10).
2. Device validates BACM, sends `POST .../ack` (status **received** on server).
3. UI shows `new_message` (title **Message éphémère** when ephemeral).
4. User tap → `message_opened`, device sends `POST .../opened`.
5. User tap (normal) or 10 s timeout (ephemeral) → `POST .../seen`, back to `idle`.

While a message session is active, cloud poll is held but ack/opened/seen posts still flush. The next queued message is delivered only after **seen**.

Duplicate cloud deliveries of the same `message_id` are ignored client-side.

## Local HTTP path (dev)

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

## Composer

- **Mobile:** Skia scene editor in `applications/mobile-rn/`
- **ble-sim:** `ble-sim/static/message_pack.js` builds BACM from HTML canvas

Send via ble-sim (**Discover** → select IP → **Send**) or:

```bash
curl -X POST --data-binary @message.bacm http://<box-ip>:8080/message
```

## Memory

Payloads up to **2 097 152** bytes. Allocation prefers PSRAM (`heap_caps_malloc` with `MALLOC_CAP_SPIRAM`).

## User flow

| Step | Screen | Action |
| --- | --- | --- |
| 1 | `new_message` | Notification (ephemeral variant when `X-Display-Duration-Sec` set) |
| 2 | `message_opened` | Tap on `new_message` |
| 3 | `idle` | Tap to dismiss (normal) or auto after 10 s (ephemeral) |

Messages received during `FirstSetup`, `WifiBoot`, or `Settings` are stored but do not change screen until those modes end. Settings long-press is blocked during an active message session.
