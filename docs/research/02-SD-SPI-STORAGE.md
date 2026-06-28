# SD card on ESP32: SPI mode, performance, cost

Sources: [ESP-IDF SD SPI host](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/sdspi_host.html), [ESP-IDF perf_benchmark](https://github.com/espressif/esp-idf/tree/master/examples/storage/perf_benchmark), [Makerfabs SPI vs SDIO](https://www.makerfabs.com/blog/post/sd-card-spi-vs-sdio-mode), [ESP-IDF sdspi example](https://github.com/espressif/esp-idf/tree/master/examples/storage/sd_card/sdspi).

## Why SD for Lovebox

- **User-updatable** assets (emojis, photos) without reflashing.
- **Web download target:** HTTP body streams to files on FAT (`/assets/`, `/cache/`).
- Large capacity (GB) at low media cost.

Lucarne already uses Arduino `SD` + FAT paths like `/assets/img_xxx.rgb565` and `.alpha` sidecars.

## SPI vs SDMMC (1-bit / 4-bit)

| Mode | GPIOs | Typical read (ESP32-S3) | Notes |
|------|-------|-------------------------|-------|
| **SPI** | 4 (+ optional WP/HOLD) | ~1–3 MB/s practical Arduino | Shares bus with display; 20–40 MHz clock |
| **SDMMC 1-bit** | CLK, CMD, D0 (+ power) | ~3–8 MB/s | Espressif benchmark ~4 MB/s raw 16 KB blocks @ 40 MHz |
| **SDMMC 4-bit** | + D1–D3 | ~10–25 MB/s | Best for video; needs 6 dedicated pins |

Makerfabs measured ~**2.4 s** for 1 MB SPI vs ~**0.3 s** read SDIO 1-bit on ESP32-S3 class boards (~**8×** faster read).

**Lovebox recommendation:** keep SPI if PCB is fixed; plan **SDMMC 1-bit** on next PCB spin if asset sync >2 s matters. Lucarne would need an ESP-IDF or `SD_MMC` backend (not only Arduino `SD`).

## SPI tuning checklist

1. **Clock:** 20 MHz default-safe; 40 MHz if wiring short and 10k pull-up on **MISO**.
2. **MISO pull-up:** weak or missing pull-up kills throughput (ESP-IDF docs); measure recovery cycles or add 10k to 3.3 V.
3. **Dedicated CS** for SD vs display; never assert both.
4. **Avoid** sharing SPI with aggressive `wait_for_miso` workarounds unless bus is SD-only.
5. **Format:** FAT32; cluster size 16–32 KB for large sequential files.

## Asset size math (Fluent emoji scale 4, 128×128 source)

| Asset | Raw on SD | With alpha sidecar |
|-------|-----------|-------------------|
| 1 frame RGB565 | 32 KB | +16 KB alpha |
| 12-frame anim | 384 KB | ~576 KB |
| 10 anims | ~5.8 MB | fits easily on 8 GB card |

Runtime cost is **not** file size alone — it is **decode + composite + SPI flush** unless Lucarne ready-cache hits.

## Cost (BOM, order-of-magnitude 2025–2026)

| Item | Unit cost @ 100–1000 pcs |
|------|--------------------------|
| MicroSD socket (push-push) | USD 0.15–0.40 |
| microSD 8 GB industrial | USD 2–5 (consumer cards cheaper, less reliable) |
| Passive pull-ups | negligible |

SD wins for **field updates** and **unbounded** library size. Cost is socket + card, not controller.

## Role in target architecture

```
Server ──HTTP──► FAT on SD (/cache/) ──► Lucarne sdCache ──► PSRAM ready frames ──► display
```

SD is **tier-2 storage** (warm). PSRAM is **tier-1** (hot frames for animation). Internal flash is **tier-0** (firmware, config, optional bootstrap assets).

## Limits

- SPI SD + SPI display: bus time adds up during **cache miss**, not during steady anim if PSRAM ready path works.
- FAT wear: avoid rewriting same file every second; download to temp + rename.
- Cards sleep: first read after idle adds latency; keep cache in PSRAM.
