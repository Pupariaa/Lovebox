# Winbond W25Q256JVFIQ (256 Mbit / 32 MB external NOR)

Sources: [Winbond W25Q256JV product page](https://www.winbond.com/hq/product/code-storage-flash-memory/serial-nor-flash/index.html?__locale=en&partNo=W25Q256JV), ESP-IDF [SPI Flash API](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/storage/spi_flash.html), [external FAT example](https://github.com/espressif/esp-idf/tree/master/examples/storage/fatfs/ext_flash).

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

## vs microSD for Lovebox assets

| Criterion | W25Q256 on PCB | microSD |
|-----------|----------------|---------|
| BOM | ~USD 1.2–2.5 @ 100 pcs | socket + card |
| Capacity | Fixed 32 MB | GB scale |
| Field swap | Reflash / OTA asset pack | User replaces card |
| Bus | Extra SPI (or shared) | SPI or SDMMC |
| Speed | High sequential read in Quad | SPI SD slower |
| Filesystem | LittleFS / FAT via ESP-IDF | FAT native Arduino |

**Use W25Q256 when:** assets are **factory-defined** or updated by OTA asset partition; you want no moving parts and predictable read latency.

**Use SD when:** users or server push **large libraries** of photos/emojis; need >32 MB.

**Hybrid (recommended product):** W25Q256 optional for **factory emoji pack** + SD for **user/server cache**. Or SD-only to minimize BOM (Lovebox v1).

## ESP32 integration

ESP-IDF supports W25Q256 explicitly in SPI flash driver chip list.

Typical bring-up:

1. `esp_flash_init()` on second SPI bus (SPI2/SPI3).
2. `esp_partition_register_external()` — label e.g. `assets`, subtype `ESP_PARTITION_SUBTYPE_DATA_LITTLEFS` or FAT.
3. Mount LittleFS or FAT; serve files to Lucarne via same path API as SD.

**Important:** External flash is **not** encrypted by ESP32 flash encryption (only internal flash). Asset encryption needs app-layer if required.

**Pin budget (Quad SPI):** CS, CLK, MOSI(DI), MISO(DO), WP, HOLD — 6 signals + 3.3 V. Can share CLK/MOSI/MISO with display if separate CS and compatible mode; **bandwidth contention** same as SD case.

## Capacity planning (32 MB)

| Content | Size estimate |
|---------|----------------|
| Lucarne firmware + OTA (internal 16 MB) | stays on module flash |
| 50 anim × 12 frames × 48 KB (128×128 RGB565+alpha) | ~29 MB |
| Static images + manifest | remaining |

32 MB external flash fits a **curated** emoji set, not an open gallery. SD remains needed for open-ended library.

## Lucarne today

- `ImageStorage::Sd` implemented.
- `ImageStorage::Web` and `ImageStorage::Psrav` exported from Studio but **no runtime loader**.
- External W25Q256 would map to new backend `ImageStorage::ExternalFlash` or unified VFS layer reading `/assets/...` from LittleFS regardless of physical medium.

## Cost note

W25Q256JVFIQ tray pricing often **USD 1.5–3** at 100 pcs (distributor dependent). Cheaper than industrial SD card but adds PCB area and SMT line. N16R8 module already includes 16 MB internal flash — external 32 MB is for **asset volume**, not replacing module flash.

## Decision matrix

| Strategy | When |
|----------|------|
| SD only | Lowest dev risk; matches current Lucarne + Lovebox |
| W25Q256 only | Closed product, fixed catalog, no card slot |
| Internal 16 MB flash partition | Small bootstrap UI + download rest to SD |
| W25Q256 + SD | Premium: fast factory load + expandable cache |
