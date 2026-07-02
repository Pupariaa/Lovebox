# Lovebox

Boîte à Cœur — connected gift box (ESP32 firmware, Android app, hardware research).

| Area | Path |
| --- | --- |
| **ESP32 firmware** | [`firmware/boite-a-coeur/`](firmware/boite-a-coeur/) |
| **Android app** | [`applications/android/v.0.1.0/`](applications/android/v.0.1.0/) |
| **Hardware research** | [`docs/research/`](docs/research/) |

## UI library

Firmware uses **[Lucarne](https://github.com/Pupariaa/Lucarne)** (separate repo). Clone both side by side:

```
Documents/GitHub/
├── Lucarne/     # UI library + Studio
└── Lovebox/     # this repo
```

Studio project: `firmware/boite-a-coeur/Lovebox.lucarne.json`

## Firmware quick start

See [firmware/boite-a-coeur/README.md](firmware/boite-a-coeur/README.md).

## Research

Hardware and performance study — [docs/research/README.md](docs/research/README.md).

## Recommended hardware (summary)

- ESP32 with PSRAM (e.g. ESP32-S3-WROOM-1-N16R8)
- ST7789 240×280, rotation 1 → logical 280×240
- FFat internal partition for Lucarne volume assets

See [docs/research/10-ACTION-PLAN.md](docs/research/10-ACTION-PLAN.md).
