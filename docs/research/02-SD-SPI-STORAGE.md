# SD card on ESP32: SPI mode, performance, cost

Sources: [ESP-IDF SD SPI host](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/sdspi_host.html), [ESP-IDF perf_benchmark](https://github.com/espressif/esp-idf/tree/master/examples/storage/perf_benchmark), [Arduino SD_MMC README](https://github.com/espressif/arduino-esp32/blob/master/libraries/SD_MMC/README.md), [IDFGH-16909 SD SPI regression](https://github.com/espressif/esp-idf/issues/16909).

**Recheck:** 2025-06-25

## Why SD for Lovebox

- **User-updatable** assets (emojis, photos) without reflashing.
- **Web download target:** HTTP body streams to files on FAT (`/assets/`, `/cache/`).
- Large capacity (GB) at low media cost.

Lucarne today uses Arduino **`SD`** + FAT paths like `/assets/img_xxx.rgb565` and `.alpha` sidecars — **not** the internal `ffat` partition from `app3M_fat9M_16MB`.

## Throughput: Lucarne path vs future SDMMC

| Mode | Stack | Typical read | Notes |
|------|-------|--------------|-------|
| **SPI SD** | Arduino `SD` @ 40 MHz | **0.5–1.0 MB/s** | IDFGH-16909; wiring-sensitive |
| **SPI SD (bad wiring)** | Arduino `SD` | **< 0.01 MB/s** | Missing MISO pull-up, small chunks |
| **SPI SD** | ESP-IDF SDSPI optimized | **~0.5–1.0 MB/s** | 4 KB+ chunks, pull-ups, CS tuning |
| **SDMMC 1-bit** | `SD_MMC.begin(..., true)` | **~2× SPI** | Arduino SD_MMC README |
| **SDMMC 4-bit** | ESP-IDF perf_benchmark | **4–16 MB/s** raw | Dedicated CLK/CMD/D0–D3 |

Do **not** assume Makerfabs ~8× SPI→SDIO in all builds. Arduino FAT + small reads + shared display bus often lands at the low end.

**Lovebox v1:** keep SPI SD if PCB fixed. **v2:** SDMMC 1-bit on dedicated pins; Lucarne needs `SD_MMC` or ESP-IDF VFS backend.

## SPI tuning checklist (Lucarne / Lovebox)

1. **Clock:** 20 MHz safe default; 40 MHz if wiring short and **10k pull-up on MISO** (and CMD/D0 for SDMMC).
2. **MISO pull-up:** weak or missing pull-up kills throughput; can drop to KB/s (IDFGH-16909).
3. **Read chunk size:** prefer sequential reads ≥ 4 KB when implementing HTTP→SD writer.
4. **Dedicated CS** for SD vs display; never assert both.
5. **Format:** FAT32; cluster size 16–32 KB for large sequential asset files.
6. **Download pattern:** write to `*.tmp`, then `rename()` — avoids partial files and reduces FAT wear.

## Diagnostic SD slow

| Symptom | Check |
|---------|-------|
| Anim stutters every frame | PSRAM ready path (see doc 07), not SD MHz alone |
| First load very slow, then OK | `sdCacheWarmAnim` not called; cold SD + no PSRAM cache |
| Always slow reads | `sdImageLastFail()`, MISO pull-up, scope SCLK/MISO |
| After IDF/Arduino upgrade | IDFGH-16909 — verify CS workaround, chunk size |

```cpp
SdImageFail f = sdImageLastFail();
const char *p = sdImageLastPath();
```

## Asset size math (Studio export)

From `fluent-emojis.js`: base `SIZE = 32`, scale ×4 → **128 px** typical; **`MAX_EXPORT_PX = 160`** caps export.

Source APNG Fluent (bignutty): **256×256**, rasterized to `exportPx` in Studio.

| Export size | 1 frame RGB565 | + alpha | 12-frame anim |
|-------------|----------------|---------|---------------|
| 128×128 | 32 KB | +16 KB | ~576 KB total |
| 160×160 | 51 KB | +26 KB | ~924 KB total |

Runtime cost is **not** file size alone — it is **SD read + PSRAM composite + SPI flush** unless Lucarne ready-cache hits.

## 2 s fetch budget (576 KB anim, LAN)

| Step | LAN typical | WAN |
|------|-------------|-----|
| HTTP(S) manifest | 50–200 ms | 200–800 ms |
| Download 576 KB | 300–800 ms | 1–4 s |
| Write FAT on SD (SPI) | 200–600 ms | same |
| `sdCacheWarmAnim` 12 frames | 100–400 ms | same |
| `snapEnsureReady` + frame 0 | 50–200 ms | same |
| **Total** | **< 2 s achievable** | **placeholder icon required** |

Bottleneck on v1 is often **WiFi + Arduino FAT write + small reads**, not SPI clock MHz alone.

## Cost (BOM, order-of-magnitude 2025–2026)

| Item | Unit cost @ 100–1000 pcs |
|------|--------------------------|
| MicroSD socket (push-push) | USD 0.15–0.40 |
| microSD 8 GB industrial | USD 2–5 (consumer cards cheaper, less reliable) |
| Passive pull-ups | negligible |

## Role in target architecture

```
Server ──HTTP──► FAT on microSD (/cache/) ──► Lucarne sdCache ──► PSRAM ready frames ──► display
```

| Tier | Medium | Role |
|------|--------|------|
| Internal flash | Firmware, OTA, NVS | Tier 0 |
| PSRAM | Framebuffer, sdCache, ready[] | Tier 1 (hot) |
| microSD FAT | `/assets/` + `/cache/` | Tier 2 (persistent warm) |
| Internal `ffat` (optional) | 9 MB if mounted | **Not Lucarne SD path today** |

## Limits

- SPI SD + SPI display: bus contention during **cache miss** and **HTTP download**, not during steady anim if PSRAM ready path works.
- FAT wear: avoid rewriting same file every second; temp + rename.
- Cards sleep: first read after idle adds latency; keep PSRAM cache hot.
- ESP-IDF 5.x SDSPI regressions possible — benchmark after core upgrade (IDFGH-16909).
