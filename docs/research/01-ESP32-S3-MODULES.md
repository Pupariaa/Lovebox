# ESP32-S3-WROOM-1: N8R2, N16R2, N16R8

Sources: [Espressif ESP32-S3-WROOM-1 datasheet](https://documentation.espressif.com/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf), [ESP-IDF flash/PSRAM config](https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-guides/flash_psram_config.html), [ESP-IDF external RAM](https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-guides/external-ram.html).

**Recheck:** 2025-06-25 (Lucarne code + Espressif datasheet cross-check)

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

- 8 MB flash: **cannot** use Arduino `app3M_fat9M_16MB` partition as-is (requires 16 MB flash). Needs custom 8 MB CSV.
- Same **2 MB PSRAM** ceiling as N16R2.
- Only choose if BOM forces lowest module cost **and** UI is minimal (one small static icon, no web cache).

### N16R2 limits

- 16 MB flash matches Arduino OTA partition schemes (`app3M_fat9M_16MB` = 9 MB **internal** FFat, separate from microSD).
- **2 MB PSRAM** is the binding constraint for Lucarne today:

| Widget size | Ready 12 frames | Snap | Per icon |
|-------------|-----------------|------|----------|
| 128×128 (scale 4) | 384 KB | 32 KB | **~416 KB** |
| 160×160 (Studio max) | 614 KB | 51 KB | **~665 KB** |

- Full framebuffer 280×240 ≈ **131 KB**
- SD cache cap in Lucarne: **2 MB** (competes for same PSRAM pool)
- Three 128×128 icons ≈ **1.25 MB** ready alone + FB + SD cache → **does not fit** in 2 MB total PSRAM

### N16R8 advantages

- **8× PSRAM** vs R2: room for framebuffer + SD cache + several anim icons' ready frames.
- **Octal PSRAM** at **80 MHz DDR (DTR)**: higher MSPI bandwidth than Quad R2. Community LVGL benchmarks (Seeed workshop) show large gains for full-frame work, but Lucarne still has SPI flush and CPU composite limits — Octal alone does not guarantee 30 fps.
- **Trade-off:** max ambient **65 °C** vs 85 °C on R2. Fine for indoor Lovebox; validate sealed enclosure.
- **Pin note:** on R8 modules, **GPIO35/36/37** are bonded to Octal PSRAM — not available for GPIO.

## Octal vs Quad PSRAM (technical)

| Aspect | Quad R2 | Octal R8 |
|--------|---------|----------|
| Interface | STR, 4 data lines | **DTR**, 8 data lines |
| Default clock | 40–80 MHz SDR | **80 MHz DDR** (effective ~160 MHz data rate) |
| 120 MHz option | Quad 120 MHz stable | Octal 120 MHz **experimental** (IDF ≥ 5.1 + `CONFIG_IDF_EXPERIMENTAL_FEATURES`); sensitive to ±20 °C drift |
| Cache behavior | Same ESP-IDF rules | Accesses **> 32 KB** can miss CPU cache and fall back to raw PSRAM speed |

**Production recommendation:** stay at **80 MHz DDR** for Lovebox v1. Do not enable 120 MHz Octal PSRAM without temperature tuning and soak testing.

## PSRAM ECC (thermal extension for R8)

Datasheet: for R8/R16V modules, enabling **`CONFIG_SPIRAM_ECC_ENABLE`** raises max ambient from **65 °C to 85 °C**.

| Trade-off | Impact |
|-----------|--------|
| Usable PSRAM | **−1/16** (~512 KB lost on 8 MB module → ~7.5 MB effective) |
| Performance | Slower PSRAM transactions (ECC overhead) |
| Build | Requires Arduino-as-IDF or custom sdkconfig — **not** a simple IDE checkbox |

Use only if product must operate in hot enclosures (sun-facing window, sealed outdoor). Indoor Lovebox: standard N16R8 without ECC is sufficient.

## On-chip memory (all variants)

| Resource | Size |
|----------|------|
| Internal SRAM | **512 KB** (WiFi stack, DMA line buffers, BT) |
| ROM | 384 KB |
| RTC SRAM | 16 KB |

PSRAM is **heap** (`MALLOC_CAP_SPIRAM`) for Lucarne framebuffer, SD decode cache, and anim ready buffers — not a filesystem by default.

### WiFi + PSRAM coexistence

Enable **`CONFIG_SPIRAM_TRY_ALLOCATE_WIFI_LWIP`** (IDF) so WiFi/LwIP buffers prefer PSRAM, preserving internal SRAM for DMA (`_lineBuf` in Lucarne display flush). Log `ESP.getFreePsram()` before and after `WiFi.begin()` in diagnostics.

## SPI controllers (module-level)

| Host | Role |
|------|------|
| SPI0/SPI1 (MSPI) | Internal **flash + PSRAM** — shared cache domain with large PSRAM memcpy |
| SPI2 (FSPI) | General peripherals, DMA |
| SPI3 (HSPI) | General peripherals, DMA |

Display + SD must use SPI2/SPI3 (or SDMMC), never SPI0/1.

## Partition note (internal flash vs microSD)

| Medium | Arduino scheme | Used by Lucarne assets? |
|--------|----------------|-------------------------|
| Internal flash `ffat` | `app3M_fat9M_16MB` (9 MB FAT) | **No** unless sketch mounts `FFat` |
| microSD FAT | `SD.begin(cs)` | **Yes** — `/assets/*.rgb565` |

Selecting `app3M_fat9M_16MB` in Tools does **not** put emoji files on the SD card Lucarne reads.

## Verification at boot

```cpp
Serial.printf("Flash: %u MB\n", ESP.getFlashChipSize() / (1024 * 1024));
Serial.printf("PSRAM: %u KB total, %u KB free\n",
              ESP.getPsramSize() / 1024, ESP.getFreePsram() / 1024);
Serial.printf("Internal free: %u KB\n",
              heap_caps_get_free_size(MALLOC_CAP_INTERNAL) / 1024);
```

On genuine modules, expect **2097152** bytes PSRAM for R2 and **8388608** for R8.

## Decision

| If… | Use |
|-----|-----|
| Prototype already on N16R2, anim stutters | Move to **N16R8** before software tuning |
| Cost-sensitive, single 64×64 anim | N16R2 + reduced Lucarne memory caps may suffice |
| New design | **N16R8** default; do not spec N8R2 for animated Lovebox |
| Hot enclosure (> 65 °C ambient) | N16R8 + PSRAM ECC, or non-anim SKU on N16R2 |
