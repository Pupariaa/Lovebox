# Lovebox

Boîte à Cœur — connected gift box (ESP32 firmware, cloud API, mobile apps, factory tooling).

| Area | Path |
| --- | --- |
| **ESP32 firmware** | [`firmware/boite-a-coeur/`](firmware/boite-a-coeur/) |
| **Cloud API + browser sim** | [`web/backend/`](web/backend/) |
| **Mobile app (Expo)** | [`applications/mobile-rn/`](applications/mobile-rn/) |
| **Factory provisioning** | [`factory/`](factory/) |
| **Legacy Android scaffold** | [`applications/android/v.0.1.0/`](applications/android/v.0.1.0/) |
| **Hardware research** | [`docs/research/`](docs/research/) |

## UI library

Firmware uses **[Lucarne](https://github.com/Pupariaa/Lucarne)** (separate repo). Clone both side by side:

```
Documents/GitHub/
├── Lucarne/     # UI library + Studio
└── Lovebox/     # this repo
```

Studio project: `firmware/boite-a-coeur/Lovebox.lucarne.json`

## Quick start

| Task | Doc |
| --- | --- |
| Flash / develop firmware | [firmware/boite-a-coeur/README.md](firmware/boite-a-coeur/README.md) |
| Provision a device | [factory/README.md](factory/README.md) |
| Run the API locally | [web/backend/README.md](web/backend/README.md) |
| Run the mobile app | [applications/mobile-rn/README.md](applications/mobile-rn/README.md) |

Current production firmware: **1.0.10** (`factory/VERSION`).

## Messaging (summary)

Users send BACM v1 binaries from the mobile app or browser sim. The backend queues messages per device; the ESP32 long-polls, shows `new_message`, then `message_opened` on tap. Receipts: **received** (device ack), **opened** (user tap), **seen** (dismiss). Ephemeral messages auto-dismiss after 10 seconds and are omitted from sent history.

Details: [firmware/boite-a-coeur/docs/MESSAGES.md](firmware/boite-a-coeur/docs/MESSAGES.md).

## Research

Hardware and performance study — [docs/research/README.md](docs/research/README.md).

## Recommended hardware (summary)

- ESP32 with PSRAM (e.g. ESP32-S3-WROOM-1-N16R8)
- ST7789 240×280, rotation 1 → logical 280×240
- FFat internal partition for Lucarne volume assets

See [docs/research/10-ACTION-PLAN.md](docs/research/10-ACTION-PLAN.md).
