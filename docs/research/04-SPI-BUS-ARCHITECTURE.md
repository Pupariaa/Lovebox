# SPI bus architecture: shared vs dual

Sources: ESP32-S3-WROOM-1 datasheet §SPI; Lucarne `Display::begin(..., SPIClass *spi)`; ESP-IDF bus allocation docs.

## Current Lovebox / Lucarne wiring (typical)

Single shared SPI:

```
ESP32-S3 ── MOSI/SCLK ──┬── ST7789 (display CS)
                        └── microSD (SD CS)
```

Lucarne display accepts `SPIClass*`; Arduino `SD.begin(cs)` uses default `SPI` unless `SD.begin(cs, spi, freq)` is used.

## ESP32-S3 usable buses

| Bus | Arduino (ESP32 3.x) | Use |
|-----|---------------------|-----|
| SPI2 / FSPI | often `SPI` or `SPI2` | Display or SD |
| SPI3 / HSPI | `SPI1` / `SPI3` | Second peripheral |

Internal module flash + PSRAM sit on **SPI0** — invisible to application.

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
| Steady anim with PSRAM ready cache | **Minimal** (no SD traffic) |

## When dual bus does **not** help

- PSRAM exhausted → slow path every frame (CPU + SD + blend dominate).
- Full-screen redraw every `ui.update()` without patch path.
- WiFi download + anim on same CPU core without FreeRTOS prioritization.

Community consensus (LVGL forum, Espressif BSP performance doc):

- **DMA-capable internal SRAM** for flush buffers often beats large PSRAM buffers for SPI LCD.
- Lucarne uses full framebuffer in PSRAM — acceptable on **N16R8**; on R2 prefer smaller icons or band buffer mode (future).

## SDMMC alternative (not SPI)

Uses pins **CLK, CMD, D0** (1-bit) — does not share MOSI/SCLK with display at all. Strongest storage upgrade if GPIOs available. Requires `SD_MMC` or ESP-IDF VFS layer; Lucarne Arduino path today is SPI-only.

## Recommendation for Lovebox

| Phase | Bus |
|-------|-----|
| v1 prototype (existing PCB) | Shared SPI + **N16R8** + Lucarne memory fixes |
| v2 PCB | Display FSPI + **SDMMC 1-bit** for storage |
| Optional premium | Add W25Q256 on HSPI for factory asset pack |

Dual SPI is **nice-to-have**, not the primary fix.
