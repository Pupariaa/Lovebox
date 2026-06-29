# Lovebox product architecture (target)

Combines hardware research + Lucarne capabilities into a coherent v1/v2 design.

**Recheck:** 2025-06-25

## Product constraints

| Constraint | Target |
|------------|--------|
| Display | ST7789 280×240 (or 240×280 rotated) |
| Anim | Multiple Fluent emojis; export `min(widgetSide, 160)` px |
| Network | WiFi HTTP(S) asset sync; BLE for setup |
| Latency | New sticker visible ≤ **2 s** LAN after server push (cached: instant) |
| Quality | Export resolution = display size (no runtime upscale) |
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
                    │        │ SPI (shared v1)               │
                    │  ┌─────▼─────┐                         │
                    │  │ ST7789    │                         │
                    │  └───────────┘                         │
                    │  BLE (NimBLE) provisioning           │
                    └───────────────────────────────────────┘
```

## Storage tiers (clarified)

| Tier | Medium | Content | Lucarne uses? |
|------|--------|---------|---------------|
| 0 | Internal flash 16 MB | Firmware, OTA, NVS, WiFi creds | Firmware only |
| 0b | Internal `ffat` 9 MB | Optional (Arduino `app3M_fat9M_16MB`) | **No** unless `FFat.begin()` |
| 1 | PSRAM 8 MB | Framebuffer, SD decode cache, anim ready | **Yes** — runtime hot |
| 2 | **microSD FAT** | `/assets/` shipped + `/cache/` downloaded | **Yes** — primary asset store |
| 3 | Server | Source of truth | External |

Optional tier 2b: **W25Q256** factory pack (see `03-W25Q256-EXTERNAL-FLASH.md`) — does not replace PSRAM.

**Important:** Selecting partition `app3M_fat9M_16MB` in Arduino IDE does **not** populate the microSD Lucarne reads via `SD.begin()`.

## Asset lifecycle

1. **Factory:** microSD with default emoji set + manifest (or flash SD image).
2. **Provisioning (BLE):** WiFi credentials + server URL + box ID.
3. **Sync:** GET `manifest.json` → compare hashes → download to `/cache/*.tmp` → rename.
4. **Display:** icon refs → `/cache/...` or `/assets/...`; **`sdCacheWarmAnim` + ready build on screen enter**.
5. **Eviction:** LRU on SD cache slots; pin manifest assets.

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

## Multi-icon screen — PSRAM budget

Home screen example: 1 large anim + 2 static + background (SD).

### 128×128 anim ×12 (typical scale 4)

| Element | PSRAM |
|---------|-------|
| Framebuffer | 131 KB |
| Background in SD cache | ~134 KB |
| 1× anim ready set | ~416 KB |
| 3× anim ready (stress) | ~1.25 MB |
| SD cache headroom | ~1–2 MB |
| **Total (3 anim)** | fits **8 MB**; fails **2 MB** |

### 160×160 anim ×12 (Studio max)

| Element | PSRAM |
|---------|-------|
| 1× anim ready set | ~665 KB |
| 3× anim ready | ~2.0 MB |
| + FB + SD cache | tight on 8 MB with 3 large anims — cap icon count or lazy evict |

## WiFi + BLE coexistence rules

1. **Do not** run synchronous HTTP in `loop()` (Core 1).
2. Download worker on **Core 0**; UI/display only on Core 1.
3. `CONFIG_SW_COEXIST_ENABLE=y`; limit BLE scan duty during heavy WiFi transfer.
4. Pause large sync during BLE provisioning window.
5. **`WiFi.setSleep(false)`** during large transfer if latency critical.
6. **Do not sync during Lucarne screen transitions** — `runTransition()` uses blocking `delay(16)`.
7. Enable `CONFIG_SPIRAM_TRY_ALLOCATE_WIFI_LWIP` to preserve internal SRAM for display DMA buffers.

## Quality (non-pixelated)

1. Studio computes `exportPx = min(widgetSide, 160)` per icon usage (`collectAnimIconUsage`).
2. Source APNG 256×256 rasterized once at export — no device upscale.
3. Alpha sidecar required for Fluent emojis (Lucarne SD path).
4. Studio preview resolution = device resolution.

## v1 vs v2 hardware

| Feature | v1 (now) | v2 (PCB spin) |
|---------|----------|---------------|
| MCU | N16R8 | N16R8 |
| Storage bus | SPI SD shared with display | SDMMC 1-bit + display FSPI |
| External flash | — | Optional W25Q256 |
| Temp | Indoor (< 65 °C) | Thermal test; PSRAM ECC if hot |

## Limits (explicit)

| Limit | Reason |
|-------|--------|
| ~6 simultaneous optimized anim icons | Lucarne `kMaxAnimSnaps` |
| 65 °C ambient on N16R8 (85 °C with ECC −512 KB) | Espressif module spec |
| 2 s fetch = **LAN** target | WAN needs placeholder UX |
| 32 MB fixed catalog without SD | W25Q256 size cap |
| 160×160 × many anim icons | PSRAM budget — lazy evict required |
| No BT Classic audio | S3 limitation |
| Internal `ffat` ≠ microSD assets | Partition confusion |

## Success criteria (acceptance)

- [ ] Three 128×128 anim icons: ≥12 fps perceived
- [ ] WiFi manifest sync 1 MB: < 2 s LAN
- [ ] BLE provisioning does not corrupt anim after reconnect
- [ ] 24 h soak: no PSRAM exhaustion / reboot
- [ ] Partial flush 128×128 logged < 15 ms (diagnostic sketch)
