# Lovebox product architecture (target)

Combines hardware research + Lucarne capabilities into a coherent v1/v2 design.

## Product constraints

| Constraint | Target |
|------------|--------|
| Display | ST7789 280×240 (or 240×280 rotated) |
| Anim | Multiple Fluent emojis, scale 4 (~128×128), alpha |
| Network | WiFi HTTP(S) asset sync; BLE for setup |
| Latency | New sticker visible ≤ **2 s** after server push (after first cache: instant) |
| Quality | Export resolution = display resolution (no runtime upscale) |
| Cost | Consumer Lovebox; module BOM sensitive |

## System diagram

```
                    ┌─────────────────────────────────────┐
                    │           Cloud / Server             │
                    │  manifest.json + binary assets       │
                    └──────────────┬──────────────────────┘
                                   │ HTTPS (WiFi)
                    ┌──────────────▼──────────────────────┐
                    │         ESP32-S3 N16R8               │
                    │  ┌────────────┐  ┌─────────────────┐ │
                    │  │ Download   │  │ Lucarne UI      │ │
                    │  │ task (C0)  │  │ loop (C1)       │ │
                    │  └─────┬──────┘  └────────┬────────┘ │
                    │        │ write              │ blit   │
                    │  ┌─────▼──────────────────────▼──────┐ │
                    │  │  FAT microSD  /assets /cache      │ │
                    │  └─────┬─────────────────────────────┘ │
                    │        │ sdCache (PSRAM)               │
                    │  ┌─────▼─────────────────────────────┐ │
                    │  │  Anim ready frames (PSRAM)          │ │
                    │  └─────┬─────────────────────────────┘ │
                    │        │ SPI                           │
                    │  ┌─────▼─────┐                         │
                    │  │ ST7789    │                         │
                    │  └───────────┘                         │
                    │  BLE (NimBLE) provisioning           │
                    └───────────────────────────────────────┘
```

## Storage tiers

| Tier | Medium | Content | Lifetime |
|------|--------|---------|----------|
| 0 | Internal flash 16 MB | Firmware, OTA, NVS, WiFi creds | Permanent |
| 1 | PSRAM 8 MB | Framebuffer, SD decode cache, anim ready buffers | Runtime |
| 2 | microSD FAT | `/assets/` shipped + `/cache/` downloaded | Persistent |
| 3 | Server | Source of truth for emoji packs | External |

Optional tier 2b: **W25Q256** factory pack (see `03-W25Q256-EXTERNAL-FLASH.md`) if card slot removed.

## Asset lifecycle

1. **Factory:** SD card or flash image with default emoji set + manifest.
2. **Provisioning (BLE):** WiFi credentials + server URL + box ID.
3. **Sync:** Device GET `manifest.json` → compare hashes → download changed files to `/cache/`.
4. **Display:** Lucarne icon refs point to `/cache/...` or `/assets/...`; warm SD + ready caches on screen enter.
5. **Eviction:** LRU on SD cache slots; keep manifest pinned set.

## Manifest example

```json
{
  "version": 3,
  "assets": [
    {
      "id": "emoji:1f496",
      "type": "anim",
      "frames": 12,
      "files": ["/cache/e_1f496_00.rgb565", "..."],
      "hash": "sha256:..."
    }
  ]
}
```

Studio export generates compatible IDs matching `Projet_icons.h`.

## Multi-icon screen

Assume home screen: 1 large anim emoji + 2 small static + background image (SD).

| Element | PSRAM budget (128×128 anim ×12) |
|---------|----------------------------------|
| Framebuffer | 131 KB |
| Background (full screen SD draw once) | in SD cache ~134 KB |
| Anim icon ready set | ~416 KB |
| 2 static icons | minimal if flash |
| SD cache headroom | ~1–2 MB |
| **Total** | fits in **8 MB**; fails on **2 MB** |

## WiFi + BLE coexistence rules

1. **Do not** run synchronous HTTP in `loop()`.
2. Download worker lower priority than `iconAnimPatchScreen` during active anim screen.
3. Pause sync during BLE provisioning window (user-facing).
4. Use **`WiFi.setSleep(false)`** during large transfer if latency critical (power trade-off).
5. Keep TLS session reuse for small manifest polls.

## Quality (non-pixelated)

1. Export emoji at **native display size** (scale 4 = 128 px source for 128 px widget).
2. Use alpha sidecar (already in Lucarne SD path).
3. Avoid Lucarne `drawIconFit` upscaling beyond export scale.
4. Studio preview resolution = device resolution.

## v1 vs v2 hardware

| Feature | v1 (now) | v2 (PCB spin) |
|---------|----------|---------------|
| MCU | N16R8 | N16R8 |
| Storage bus | SPI SD shared with display | SDMMC 1-bit + display FSPI |
| External flash | — | Optional W25Q256 |
| Temp | Indoor | Validate 65 °C limit R8 |

## Limits (explicit)

| Limit | Reason |
|-------|--------|
| ~6 simultaneous optimized anim icons | Lucarne `kMaxAnimSnaps` |
| 65 °C ambient on N16R8 | Espressif module spec |
| 2 s fetch assumes local CDN / reasonable WiFi | WAN variability |
| 32 MB fixed catalog without SD | W25Q256 size cap |
| No BT Classic audio | S3 limitation |

## Success criteria (acceptance)

- [ ] Three 128×128 anim icons on one screen: visually smooth (≥12 fps perceived)
- [ ] WiFi manifest sync 1 MB: < 2 s on LAN
- [ ] BLE provisioning does not corrupt anim playback after reconnect
- [ ] 24 h soak: no PSRAM exhaustion / reboot
