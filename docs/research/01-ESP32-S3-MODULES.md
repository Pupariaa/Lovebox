# ESP32-S3-WROOM-1: N8R2, N16R2, N16R8

Sources: [Espressif ESP32-S3-WROOM-1 datasheet](https://documentation.espressif.com/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf), [RIOT ESP32-S3 doc](https://github.com/RIOT-OS/RIOT/blob/master/cpu/esp32/doc_esp32s3.doc.md).

## Naming convention

| Suffix | Meaning |
|--------|---------|
| **N8 / N16** | Integrated **Quad SPI flash**: 8 MB or 16 MB |
| **R2 / R8** | Integrated **PSRAM**: 2 MB (Quad SPI) or 8 MB (Octal SPI) |
| Chip inside | R2 modules use **ESP32-S3R2**; R8 use **ESP32-S3R8** |

Example: **ESP32-S3-WROOM-1-N16R8** = 16 MB flash + 8 MB Octal PSRAM + PCB antenna.

## Comparison table (your three candidates)

| Variant | Flash | PSRAM | PSRAM type | Temp range | SoC | Lovebox fit |
|---------|-------|-------|------------|------------|-----|-------------|
| **N8R2** | 8 MB QSPI | 2 MB | Quad SPI | −40…+85 °C | ESP32-S3R2 | Poor: flash tight + PSRAM bottleneck |
| **N16R2** | 16 MB QSPI | 2 MB | Quad SPI | −40…+85 °C | ESP32-S3R2 | OK flash, **PSRAM bottleneck** for anim |
| **N16R8** | 16 MB QSPI | 8 MB | **Octal SPI** | −40…+65 °C | ESP32-S3R8 | **Recommended** for multi anim + WiFi |

### N8R2 limits

- 8 MB flash with typical Lovebox partition (`app3M_fat9M_16MB` style) leaves little room for dual OTA + asset partition without custom CSV.
- Same **2 MB PSRAM** ceiling as N16R2.
- Only choose if BOM forces lowest module cost **and** UI is minimal (one small static icon, no web cache).

### N16R2 limits

- 16 MB flash matches current Arduino partition schemes and OTA headroom.
- **2 MB PSRAM** is the binding constraint for Lucarne today:
  - Full framebuffer 280×240 ≈ **131 KB**
  - SD cache cap in Lucarne: **2 MB** (competes for same pool)
  - One 128×128 anim icon, 12 frames: snap 32 KB + ready buffers **384 KB** ≈ **416 KB/icon**
  - Three such icons ≈ **1.25 MB** before SD cache — **does not fit** with 2 MB total PSRAM

### N16R8 advantages

- **8× PSRAM** vs R2: room for framebuffer + SD cache + several anim icons' ready frames.
- **Octal PSRAM** (8 data lines): higher bandwidth than Quad R2; Espressif and community benchmarks show smoother full-frame work (Seeed LVGL workshop: 7–9 fps → 30 fps with Octal PSRAM + tuning).
- **Trade-off:** max ambient **65 °C** vs 85 °C on R2. Fine for indoor Lovebox; avoid sealed outdoor enclosure without thermal check.
- **Pin note:** on R8 modules, **GPIO35/36/37** are bonded to Octal PSRAM — not available for GPIO.

## On-chip memory (all variants)

| Resource | Size |
|----------|------|
| Internal SRAM | **512 KB** (WiFi stack, DMA buffers, BT) |
| ROM | 384 KB |
| RTC SRAM | 16 KB |

PSRAM is **not** a second disk by default in Lucarne; it is **heap** (`MALLOC_CAP_SPIRAM`) for framebuffer, caches, and compositing buffers.

## SPI controllers (module-level)

| Host | Role |
|------|------|
| SPI0/SPI1 | Internal **flash + PSRAM** (not for user peripherals) |
| SPI2 (FSPI) | General peripherals, DMA |
| SPI3 (HSPI) | General peripherals, DMA |

Display + SD must use SPI2/SPI3 (or SDMMC), never SPI0/1.

## Verification at boot

```cpp
Serial.printf("Flash: %u MB\n", ESP.getFlashChipSize() / (1024 * 1024));
Serial.printf("PSRAM: %u KB total, %u KB free\n",
              ESP.getPsramSize() / 1024, ESP.getFreePsram() / 1024);
```

On genuine modules, expect **2097152** bytes PSRAM for R2 and **8388608** for R8.

## Decision

| If… | Use |
|-----|-----|
| Prototype already on N16R2, anim stutters | Move to **N16R8** before software tuning |
| Cost-sensitive, single 64×64 anim | N16R2 + reduced Lucarne memory caps may suffice |
| New design | **N16R8** default; do not spec N8R2 for animated Lovebox |
