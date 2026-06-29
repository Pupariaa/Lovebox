# Lovebox

Firmware and product research for the Lovebox device (ESP32-S3, Lucarne UI, animated emojis, WiFi/BLE).

## Research (recheck v2 — 2025-06-25)

Hardware and performance study for fluid animated UI, storage, and web asset sync. Cross-checked against Lucarne source and Espressif docs.

**[docs/research/README.md](docs/research/README.md)**

### Recheck highlights

- ~1 fps on N16R2: PSRAM exhaustion in `snapEnsureReady()` — not fixed by dual SPI alone.
- `sdCacheWarmAnim()` already in Lucarne — not called from runtime (P0 wire-up).
- Assets live on **microSD** (`SD.begin`); internal `ffat` partition is separate.
- Arduino SD SPI ~0.5–1 MB/s; 2 s fetch target applies to **LAN**.

## Related

- UI library: [Lucarne](https://github.com/Pupariaa/Lucarne)
- Arduino test sketch: `Test_lovebox_2` (local)

## Recommended hardware (summary)

- **ESP32-S3-WROOM-1-N16R8** (16 MB flash, 8 MB Octal PSRAM)
- ST7789 280×240, **microSD FAT** for assets (`/assets`, `/cache`)
- Lucarne Phase 1 firmware patches before PCB spin

See [docs/research/10-ACTION-PLAN.md](docs/research/10-ACTION-PLAN.md) for phased implementation.
