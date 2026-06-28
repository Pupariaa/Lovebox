# Lovebox hardware and UI performance research

Research pack for building a fluid Lovebox-class product: animated Fluent emojis, WiFi/BLE, web asset sync, Lucarne UI on ESP32-S3 + ST7789.

**Date:** 2025-06-25  
**Scope:** ESP32-S3 modules (N8R2, N16R2, N16R8), SD SPI, Winbond W25Q256, Lucarne runtime gaps, cost vs performance.

## Documents

| Document | Content |
|----------|---------|
| [01-ESP32-S3-MODULES.md](01-ESP32-S3-MODULES.md) | Datasheet summary: N8R2, N16R2, N16R8 |
| [02-SD-SPI-STORAGE.md](02-SD-SPI-STORAGE.md) | SD on SPI vs SDIO, throughput, wiring, cost |
| [03-W25Q256-EXTERNAL-FLASH.md](03-W25Q256-EXTERNAL-FLASH.md) | External NOR flash as asset store |
| [04-SPI-BUS-ARCHITECTURE.md](04-SPI-BUS-ARCHITECTURE.md) | Shared vs dual SPI, ESP32-S3 bus map |
| [05-ANIMATED-UI-COMMUNITY.md](05-ANIMATED-UI-COMMUNITY.md) | Forums, LVGL, GIF players, lessons learned |
| [06-ESP32-VARIANTS.md](06-ESP32-VARIANTS.md) | S3 vs classic ESP32 vs C6 vs P4 |
| [07-LUCARNE-ANALYSIS.md](07-LUCARNE-ANALYSIS.md) | Current Lucarne memory/anim pipeline |
| [08-PRODUCT-ARCHITECTURE.md](08-PRODUCT-ARCHITECTURE.md) | Target Lovebox: WiFi, BLE, web assets, multi-icon |
| [09-COST-PERFORMANCE.md](09-COST-PERFORMANCE.md) | BOM trade-offs, recommended SKU |
| [10-ACTION-PLAN.md](10-ACTION-PLAN.md) | Phased plan, limits, decisions |

## Executive summary

**Root cause of ~1 fps today:** Lucarne's fast animation path needs PSRAM for (1) full framebuffer, (2) SD decode cache up to 2 MB, (3) per-icon snap + pre-composited "ready" frames. On **N16R2 / N8R2 (2 MB PSRAM)**, `snapEnsureReady()` often fails silently and every frame falls back to SD read + alpha blend + SPI flush.

**Cheapest high-impact hardware change:** **N16R2 → N16R8** (~USD 0.30–0.70/unit at volume). Keeps 16 MB flash for OTA + FAT partition; adds 8 MB Octal PSRAM.

**Dual SPI bus:** useful for warm-up and background downloads; **not** a substitute for PSRAM on the animation fast path.

**Web assets:** not implemented in Lucarne today. Plan: HTTP → SD cache partition → existing `sdCacheEnsure` / ready-frame builder; download during idle or before display.

**Recommended direction (cost-aware):**

1. BOM: **ESP32-S3-WROOM-1-N16R8**, ST7789 280×240, microSD (FAT) OR W25Q256 for factory-preloaded assets.
2. Firmware: Lucarne patches (lazy ready alloc, warm cache, web loader, memory budget API).
3. Asset pipeline: export **display-ready** anim frames (BE16 composite) to cut runtime CPU.
4. Network: WiFi download queue; BLE for provisioning only (avoid heavy BLE + anim on same core without task pinning).

## Primary references

- [ESP32-S3-WROOM-1 datasheet (Espressif)](https://documentation.espressif.com/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf)
- [ESP-IDF SD SPI host](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/sdspi_host.html)
- [ESP-IDF external flash + FAT example](https://github.com/espressif/esp-idf/tree/master/examples/storage/fatfs/ext_flash)
- [Winbond W25Q256JV datasheet](https://www.winbond.com/hq/product/code-storage-flash-memory/serial-nor-flash/index.html?__locale=en&partNo=W25Q256JV)
- Lucarne repo: `C:\Users\Puparia\Documents\GitHub\Lucarne`
