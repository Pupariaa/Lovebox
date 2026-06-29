# Animated UI on ESP32: community and industry patterns

Research from Hackster GIF player, Seeed LVGL workshop, Espressif BSP performance notes, ESP32-S3 WatchFace, Arduino/LVGL forums.

**Recheck:** 2025-06-25

## Pattern 1: Pre-decode to framebuffer (Lucarne direction)

**Idea:** Never decode PNG/APNG at runtime on device. Export RGB565 (+ alpha) on PC; on device composite once into **display-ready buffer**, then blit.

**Examples:**

- Lucarne `sdBuildDisplayFrame` + `blitBufferRect` + partial `display(x,y,w,h)`.
- AnimatedGIF `GIF_DRAW_COOKED` + frame buffer in PSRAM (Hackster ESP32-S3 GIF player, **requires 8 MB PSRAM** for smooth 30 fps on 320×240).

**Lesson:** Smooth anim = **zero decode on hot path**.

## Pattern 2: PSRAM size and type matter more than CPU MHz

| Setup | Typical result |
|-------|----------------|
| S3 **8 MB Octal PSRAM**, cooked frames | 24–30 fps GIF/UI (community) |
| S3 **2 MB Quad PSRAM**, stream from SD | 1–5 fps |
| CPU 160 → 240 MHz | modest gain vs memory path |
| Octal vs Quad PSRAM | large gain for full-frame work (Seeed: 7–9 fps → 30 fps) — **but** Lucarne adds SPI line-copy overhead from PSRAM FB |

**Do not overclock CPU with WiFi + BLE active:** ESP32-S3 WiFi MAC and BLE controller timing are tied to **80 MHz APB**. Overclocking CPU drags APB above stock and causes RF timing drift (documented in ESP32-S3 WatchFace project). Overclock is only safe with WiFi/BLE off.

## Pattern 3: LVGL + partial buffer + DMA internal SRAM

LVGL forum (WT32-SC01Plus):

- Two buffers sized `width * height / 10`, allocated **`MALLOC_CAP_INTERNAL | MALLOC_CAP_DMA`** early in `setup()`.
- Enable DMA on flush callback; call `lv_disp_flush_ready()` only after DMA completes.
- **Small internal DMA buffers beat large PSRAM buffers** for SPI LCD throughput.

Lucarne differs: full-screen buffer in PSRAM + dirty rect partial flush. Valid on N16R8; P2 hybrid: internal DMA stripe for flush while keeping PSRAM compositing buffers.

## Pattern 4: Espressif BSP performance doc takeaways

From `esp_lvgl_port/docs/performance.md`:

- Framebuffer in **internal SRAM** faster than PSRAM for RGB/SPI panels.
- Tuning order: compiler `-O2`/perf → CPU 240 MHz → flash QIO 80 MHz → PSRAM **80 MHz DDR** → LCD SPI clock → buffer size.
- **PSRAM 120 MHz Octal:** experimental only; temperature-sensitive — not for Lovebox v1 production.
- Weighted FPS often << average FPS when UI is partial updates.

## Pattern 5: Task pinning (ESP32-S3 WatchFace)

| Core | Runs | Why |
|------|------|-----|
| **Core 1** | `loop()` + Lucarne UI / display | UI must not block on network |
| **Core 0** | WiFi + HTTPS + NimBLE host | Long-blocking tasks off UI core |

Rules:

- Never call display/Lucarne draw from Core 0 network callbacks — set flags, UI loop reacts.
- BLE scan duty cycle ~50% if MQTT/WiFi latency matters (`CONFIG_SW_COEXIST_ENABLE` required).
- **`runTransition()` in Lucarne uses blocking `delay(16)`** — freezes entire loop including WiFi polling during ~220 ms transitions. Product firmware should avoid heavy sync during screen transitions.

## Pattern 6: What **not** to do

- Stream GIF decode + TFT draw per pixel on shared SPI (Arduino forum: Guru errors, flicker).
- Rely on `millis()`-based frame index jumping multiple frames after lag (Lucarne fixed: sequential stepping).
- Allocate all anim frame buffers at once on 2 MB PSRAM (`snapEnsureReady` — fails silently).
- Assume Octal PSRAM alone fixes fps without warm cache + ready path + SPI flush budget.

## Applicable to Lovebox + Lucarne

| Practice | Status in Lucarne | Action |
|----------|-------------------|--------|
| 8 MB PSRAM module | Hardware choice | Spec **N16R8** |
| Pre-baked display frames | Partial (`ready[]`) | Lazy alloc + call existing `sdCacheWarmAnim` |
| Partial display refresh | Yes (`iconAnimPatchScreen`) | Batch dirty rects (P1) |
| SD cache before anim | **`sdCacheWarmAnim` exists, not wired** | One-line call in `iconAnimSnapCapture` |
| Web download | Missing | New module Core 0 |
| Export cooked frames from Studio | Not yet | Optional `.dframe` blob per anim frame |

## Target UX metrics (product)

| Metric | Target |
|--------|--------|
| Anim icon @ 128×128 | ≥ 12–15 fps effective |
| Anim icon @ 160×160 (Studio max) | ≥ 10 fps; tighter SPI budget (~51 KB/flush) |
| New asset from WiFi | ≤ **2 s** LAN for ~500 KB pack; WAN = placeholder |
| Screen transition | ≤ 300 ms (watch Lucarne `delay()` blocking) |
| Visual quality | `exportPx = min(widgetSide, 160)`; no runtime upscale beyond export |

## References

- [Hackster: ESP32-S3 GIF player](https://www.hackster.io/dsnindustries/i-build-gif-player-with-esp32s3-ili9341-sd-card-25f5a2)
- [Seeed: XIAO ESP32-S3 LVGL animation workshop](https://wiki.seeedstudio.com/round_display_animation_workshop/)
- [Espressif BSP LVGL performance.md](https://github.com/espressif/esp-bsp/blob/master/components/esp_lvgl_port/docs/performance.md)
- [ESP32-S3 WatchFace](https://github.com/Neol00/ESP32-S3-WatchFace) — core pinning, no overclock with RF
- [ESP-IDF RF coexistence](https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-guides/coexist.html)
- [LVGL forum: slow drawing ESP32-S3](https://forum.lvgl.io/t/slow-drawing-esp32s3-wt32-sc01plus/13816)
