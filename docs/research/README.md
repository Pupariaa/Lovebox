# Lovebox hardware and UI performance research

Research pack for building a fluid Lovebox-class product: animated Fluent emojis, WiFi/BLE, web asset sync, Lucarne UI on ESP32-S3 + ST7789.

**Initial research:** 2025-06-25  
**Recheck (Lucarne code + Espressif sources):** 2025-06-25 v2  
**Scope:** ESP32-S3 modules (N8R2, N16R2, N16R8), SD SPI, Winbond W25Q256, Lucarne runtime gaps, cost vs performance.

## Documents

| Document | Content |
|----------|---------|
| [01-ESP32-S3-MODULES.md](01-ESP32-S3-MODULES.md) | Datasheet summary, Octal PSRAM, PSRAM ECC, partitions |
| [02-SD-SPI-STORAGE.md](02-SD-SPI-STORAGE.md) | Arduino SD vs SDMMC, throughput recheck, 2 s budget |
| [03-W25Q256-EXTERNAL-FLASH.md](03-W25Q256-EXTERNAL-FLASH.md) | External NOR — does not fix PSRAM anim |
| [04-SPI-BUS-ARCHITECTURE.md](04-SPI-BUS-ARCHITECTURE.md) | Shared vs dual SPI, PSRAM flush penalty |
| [05-ANIMATED-UI-COMMUNITY.md](05-ANIMATED-UI-COMMUNITY.md) | Forums, core pinning, no overclock with RF |
| [06-ESP32-VARIANTS.md](06-ESP32-VARIANTS.md) | S3 vs classic ESP32 vs C6 vs P4 |
| [07-LUCARNE-ANALYSIS.md](07-LUCARNE-ANALYSIS.md) | Pipeline, slow/fast path, P0 patch order |
| [08-PRODUCT-ARCHITECTURE.md](08-PRODUCT-ARCHITECTURE.md) | Target Lovebox: microSD vs ffat, RF rules |
| [09-COST-PERFORMANCE.md](09-COST-PERFORMANCE.md) | BOM trade-offs, R2 support cost |
| [10-ACTION-PLAN.md](10-ACTION-PLAN.md) | Phased plan, risks, decisions |

## Executive summary (recheck v2)

### Three major corrections from code recheck

1. **PSRAM R2 exhaustion** — root cause of ~1 fps unchanged; budget tables now include **160×160** Studio max (`MAX_EXPORT_PX=160`), not only 128×128.
2. **`sdCacheWarmAnim()` exists but is not wired** — API in `LucarneImageLoader.cpp` L317; never called from `iconAnimSnapCapture`. First P0 patch is integration, not new API.
3. **SD throughput for Lucarne today** — Arduino `SD` SPI ~**0.5–1 MB/s** practical (not 1–3 MB/s); bad wiring → KB/s. Internal `app3M_fat9M` **≠** microSD assets.

### Root cause (~1 fps on N16R2)

Lucarne fast path needs PSRAM for: (1) framebuffer ~131 KB, (2) SD decode cache up to 2 MB, (3) per-icon snap + all `ready[]` frames allocated at once in `snapEnsureReady()`. On **2 MB PSRAM**, allocation fails silently → slow path every frame (SD + CPU blend + SPI flush).

### Recommended direction (unchanged, refined)

1. **Hardware:** **ESP32-S3-WROOM-1-N16R8** (~USD +0.30–0.80 vs N16R2).
2. **Firmware P0 (Lucarne):** wire `sdCacheWarmAnim` → lazy ready alloc → budget API → batch flush.
3. **Assets:** microSD FAT `/assets` + `/cache`; export `min(widgetSide, 160)` px.
4. **Network:** HTTP worker Core 0; UI Core 1; 2 s target = **LAN**; WAN = placeholder.

**Dual SPI / W25Q256:** deferred v2 — do not fix PSRAM anim alone.

## Primary references

- [ESP32-S3-WROOM-1 datasheet](https://documentation.espressif.com/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf)
- [ESP-IDF flash/PSRAM config](https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-guides/flash_psram_config.html)
- [ESP-IDF SD SPI host](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/sdspi_host.html)
- [IDFGH-16909 SD SPI throughput](https://github.com/espressif/esp-idf/issues/16909)
- [ESP-IDF RF coexistence](https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-guides/coexist.html)
- Lucarne: [github.com/Pupariaa/Lucarne](https://github.com/Pupariaa/Lucarne)
