# SPI bus architecture: shared vs dual

Sources: ESP32-S3-WROOM-1 datasheet; Lucarne `Display::begin(..., SPIClass *spi)`; [ESP-IDF flash/PSRAM config](https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-guides/flash_psram_config.html).

**Recheck:** 2025-06-25

## Current Lovebox / Lucarne wiring (typical)

Single shared SPI:

```
ESP32-S3 ── MOSI/SCLK ──┬── ST7789 (display CS)
                        └── microSD (SD CS)
```

Lucarne display accepts `SPIClass*`; Arduino `SD.begin(cs)` uses default `SPI` unless `SD.begin(cs, spi, freq)`.

## ESP32-S3 usable buses

| Hardware | ESP-IDF | Arduino ESP32 3.x (typical) | Use |
|----------|---------|-------------------------------|-----|
| SPI2 | FSPI | `SPI` or `SPI2` | Display or SD |
| SPI3 | HSPI | `SPI1` or `SPI3` | Second peripheral |
| SPI0/1 | MSPI | (not exposed) | Module flash + PSRAM |

Pin mapping depends on **board variant** — verify `variants/<board>/pins_arduino.h` before dual-bus wiring.

Internal module flash + PSRAM share **MSPI** with the CPU cache. Large PSRAM memcpy during `sdBuildDisplayFrame()` or `snapshotFrame()` can contend with code fetch from flash — secondary effect vs SD SPI blocking.

## Dual-bus layout (recommended PCB v2)

```
FSPI:  Display (high priority, 40–80 MHz)
HSPI:  SD card (40 MHz) OR W25Q256 (80 MHz read)
```

Sketch pattern:

```cpp
SPIClass displaySpi(FSPI);
SPIClass storageSpi(HSPI);

displaySpi.begin(dispSclk, dispMiso, dispMosi, -1);
storageSpi.begin(sdSclk, sdMiso, sdMosi, -1);

display.begin(pins, options, buffer, &displaySpi);
SD.begin(sdCs, storageSpi, 40000000);
```

## When dual bus helps

| Scenario | Benefit |
|----------|---------|
| First anim loop (SD cache fill) | Display SPI not blocked by SD clocking |
| HTTP download to SD while showing static UI | Moderate |
| Steady anim with PSRAM ready cache | **Minimal** (no SD traffic on hot path) |

## When dual bus does **not** help

- PSRAM exhausted → slow path every frame (CPU + SD + blend dominate).
- Full-screen redraw every `ui.update()` without patch path.
- WiFi download + anim on same core without FreeRTOS prioritization.
- **N16R2 with 3 anim icons** — memory bound, not bus bound.

## Display flush: PSRAM framebuffer penalty

Lucarne allocates framebuffer in PSRAM when available (`LucarneDisplay.cpp`):

- `_bufferDmaSafe = false` when buffer is in PSRAM.
- `flushRegion()` copies **each row** to internal DMA `_lineBuf`, then SPI `writeBytes`.
- Partial 128×128 flush ≈ **8–15 ms** @ 40 MHz (setup + double copy), per icon, per frame step.

Dual SPI does not remove this penalty. Future P2: internal DMA stripe flush (Espressif BSP pattern).

Community consensus (LVGL forum, Espressif BSP performance doc):

- **DMA-capable internal SRAM** for flush buffers often beats large PSRAM buffers for SPI LCD throughput.
- Lucarne full framebuffer in PSRAM is acceptable on **N16R8**; batch partial flushes (P1) reduces SPI setup overhead.

## SDMMC alternative (not SPI)

Uses pins **CLK, CMD, D0** (1-bit) — does not share MOSI/SCLK with display. Strongest storage upgrade if GPIOs available.

```cpp
SD_MMC.setPins(clk, cmd, d0);
SD_MMC.begin("/sdcard", true);  // mode1bit = true
```

Requires `SD_MMC` or ESP-IDF VFS; Lucarne Arduino path today is SPI-only (`SD` library).

## Recommendation for Lovebox

| Phase | Bus |
|-------|-----|
| v1 prototype (existing PCB) | Shared SPI + **N16R8** + Lucarne memory fixes |
| v2 PCB | Display FSPI + **SDMMC 1-bit** for storage |
| Optional premium | W25Q256 on HSPI for factory asset pack |

Dual SPI is **nice-to-have**, not the primary fix for ~1 fps anim.
