# Animated UI on ESP32: community and industry patterns

Research from Hackster GIF player, Seeed LVGL workshop, Espressif BSP performance notes, Arduino/LVGL forums.

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
| Octal vs Quad PSRAM | large gain for full-frame buffers (Seeed: 7–9 fps → 30 fps) |

## Pattern 3: LVGL + partial buffer + DMA internal SRAM

LVGL forum (WT32-SC01Plus):

- Two buffers sized `width * height / 10`, allocated **`MALLOC_CAP_INTERNAL | MALLOC_CAP_DMA`** early in `setup()`.
- Enable DMA on flush callback; call `lv_disp_flush_ready()` only after DMA completes.
- **Small internal DMA buffers beat large PSRAM buffers** for SPI LCD throughput.

Lucarne differs: full-screen buffer + dirty rect. Valid on N16R8; consider hybrid (internal DMA stripe for flush) as future optimization.

## Pattern 4: Espressif BSP performance doc takeaways

From `esp_lvgl_port/docs/performance.md`:

- Framebuffer in **internal SRAM** faster than PSRAM for RGB/SPI panels.
- Tuning order: compiler `-O2`/perf → CPU 240 MHz → flash QIO 120 MHz → PSRAM 120 MHz → LCD SPI clock → buffer size.
- Weighted FPS often << average FPS when UI is partial updates.

## Pattern 5: What **not** to do

- Stream GIF decode + TFT draw per pixel on shared SPI (Arduino forum: Guru errors, flicker).
- Rely on `millis()`-based frame index jumping multiple frames after lag (Lucarne fixed: sequential stepping).
- Allocate all anim frame buffers at once on 2 MB PSRAM (Lucarne `snapEnsureReady` — fails silently).

## Applicable to Lovebox + Lucarne

| Practice | Status in Lucarne | Action |
|----------|-------------------|--------|
| 8 MB PSRAM module | Hardware choice | Spec **N16R8** |
| Pre-baked display frames | Partial (`ready[]`) | Lazy alloc + warm all frames on screen show |
| Partial display refresh | Yes (`iconAnimPatchScreen`) | Batch dirty rects |
| SD cache before anim | `sdCacheWarmAnim` exists | Call from UI on screen enter |
| Web download | Missing | New module |
| Export cooked frames from Studio | Not yet | Optional `.dframe` blob per anim frame |

## Target UX metrics (product)

| Metric | Target |
|--------|--------|
| Anim icon @ 128×128 | ≥ 15 fps effective (42 ms/frame × 12 ≈ 500 ms loop) |
| New asset from WiFi | ≤ **2 s** for typical 500 KB pack (cached thereafter) |
| Screen transition | ≤ 300 ms |
| Visual quality | No nearest-neighbor upscale beyond export scale; use Studio export scale = display scale |

## References

- [Hackster: ESP32-S3 GIF player](https://www.hackster.io/dsnindustries/i-build-gif-player-with-esp32s3-ili9341-sd-card-25f5a2)
- [Seeed: XIAO ESP32-S3 LVGL animation workshop](https://wiki.seeedstudio.com/round_display_animation_workshop/)
- [Espressif BSP LVGL performance.md](https://github.com/espressif/esp-bsp/blob/master/components/esp_lvgl_port/docs/performance.md)
- [LVGL forum: slow drawing ESP32-S3](https://forum.lvgl.io/t/slow-drawing-esp32s3-wt32-sc01plus/13816)
- [Arduino forum: GIF on ILI9341](https://forum.arduino.cc/t/how-to-output-gif-image-on-ili-9341/1388735)
