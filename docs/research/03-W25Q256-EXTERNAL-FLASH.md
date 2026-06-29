# Winbond W25Q256JVFIQ (256 Mbit / 32 MB external NOR)

Sources: [Winbond W25Q256JV product page](https://www.winbond.com/hq/product/code-storage-flash-memory/serial-nor-flash/index.html?__locale=en&partNo=W25Q256JV), ESP-IDF [SPI Flash API](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/storage/spi_flash.html), [external FAT example](https://github.com/espressif/esp-idf/tree/master/examples/storage/fatfs/ext_flash).

**Recheck:** 2025-06-25

## Part summary

| Parameter | Value |
|-----------|-------|
| Density | 256 Mbit = **32 MB** |
| Interface | Standard / Dual / **Quad SPI** |
| Max clock | **133 MHz** (Quad); continuous read up to ~66 MB/s theoretical |
| Supply | 2.7–3.6 V |
| Package (FIQ) | 16-pin SOIC 300 mil (+ `/RESET` pin) |
| Temp | −40…+85 °C (FIQ grade) |
| Endurance | min 100k erase cycles per sector |
| Organization | 4 KB sectors; 256-byte pages |

## Critical: W25Q256 does not fix PSRAM animation bottleneck

Lucarne anim fast path needs **PSRAM** for:

- Full framebuffer (~131 KB)
- SD decode cache (up to 2 MB)
- Per-icon `ready[]` composited frames (416–665 KB per icon)

External NOR flash improves **asset read latency** and removes the SD card slot, but **does not replace PSRAM**. Faster storage alone leaves Lovebox on the slow anim path if `snapEnsureReady()` fails on R2.

| Problem | W25Q256 helps? |
|---------|----------------|
| ~1 fps on N16R2 | **No** — need N16R8 + Lucarne P0 |
| Slow factory boot (preload catalog) | **Yes** — high sequential Quad read |
| No microSD socket (mechanical/sealing) | **Yes** |
| > 32 MB emoji library | **No** — need SD or server cache |

## vs microSD for Lovebox assets

| Criterion | W25Q256 on PCB | microSD |
|-----------|----------------|---------|
| BOM | ~USD 1.2–2.5 @ 100 pcs | socket + card |
| Capacity | Fixed 32 MB | GB scale |
| Field swap | Reflash / OTA asset pack | User replaces card |
| Bus | Extra SPI (or shared) | SPI or SDMMC |
| Speed | High sequential read in Quad | Arduino SPI SD ~0.5–1 MB/s |
| Filesystem | LittleFS / FAT via ESP-IDF | FAT native Arduino |

**Use W25Q256 when:** assets are **factory-defined** or updated by OTA asset partition; predictable read latency; no moving parts.

**Use SD when:** users or server push **large libraries**; need >32 MB; field updates without reflashing NOR.

**Hybrid:** W25Q256 factory pack + SD for `/cache/` downloads (premium SKU). **Lovebox v1:** SD-only (lowest dev risk).

## ESP32 integration

ESP-IDF supports W25Q256 in SPI flash driver chip list.

Typical bring-up:

1. `esp_flash_init()` on second SPI bus (SPI2/SPI3).
2. `esp_partition_register_external()` — label e.g. `assets`, subtype LittleFS or FAT.
3. Mount filesystem; expose paths Lucarne can read via new backend or unified VFS.

### Filesystem choice

| FS | Pros | Cons |
|----|------|------|
| **LittleFS** | Wear-friendly, good for NOR | Lucarne has no LittleFS backend today |
| **FAT** | Familiar, ESP-IDF example | Wear on NOR; needs wear levelling layer |

### Security

External flash is **not** encrypted by ESP32 flash encryption (internal flash only). Asset encryption requires application-layer if needed.

**Pin budget (Quad SPI):** CS, CLK, MOSI, MISO, WP, HOLD — 6 signals. Can share CLK/MOSI/MISO with display if separate CS; same bandwidth contention as SD.

## Capacity planning (32 MB)

| Content | Size estimate |
|---------|----------------|
| Firmware + OTA (internal 16 MB module flash) | stays on module |
| 50 anim × 12 frames × 48 KB (128×128 RGB565+alpha) | ~29 MB |
| 50 anim × 12 frames × 77 KB (160×160) | ~46 MB — **exceeds 32 MB** |
| Static images + manifest | remaining |

At **160×160 export**, 32 MB fits roughly **35 anim icons × 12 frames** — plan catalog size in Studio.

## Lucarne today

- `ImageStorage::Sd` implemented (microSD FAT).
- `ImageStorage::Web` exported from Studio — **no runtime loader**.
- External W25Q256 would need new backend or VFS layer mapping `/assets/...` regardless of physical medium.

## Cost note

W25Q256JVFIQ tray pricing often **USD 1.5–3** at 100 pcs. N16R8 module already includes 16 MB internal flash — external 32 MB is for **asset volume**, not replacing module flash or PSRAM.

## Decision matrix

| Strategy | When |
|----------|------|
| SD only | Lowest dev risk; matches current Lucarne + Lovebox v1 |
| W25Q256 only | Closed product, fixed catalog ≤32 MB, no card slot |
| Internal 16 MB flash partition | Small bootstrap UI + download rest to SD |
| W25Q256 + SD | Premium: fast factory load + expandable `/cache/` |
