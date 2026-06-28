# Lucarne library analysis (animation, memory, gaps)

Repo: `C:\Users\Puparia\Documents\GitHub\Lucarne` (v0.1.x). Lovebox consumes Lucarne as Arduino library + Studio export headers.

## Animation pipeline (current)

```
Screen::draw()
  └─ iconAnimSnapCapture()     // snapshot widget rect from framebuffer
  └─ Icon::draw()              // frame 0 via iconAnimDrawInitial or SD draw

UI::update() each loop
  └─ iconAnimPatchScreen()     // if delay elapsed: blit ready OR restore+redraw
       └─ display(x,y,w,h)     // partial SPI flush per icon
```

**Requirements for fast path:**

- `BufferMode::Full` + `canPeekPixel()` + PSRAM/internal framebuffer
- `snapEnsureReady()` succeeded (all `ready[i]` allocated)
- SD frames in cache for `sdBuildDisplayFrame()`
- `_animLookup` registered (exported anim icons)

## Memory constants (code, not docs)

| Pool | Size | File |
|------|------|------|
| Framebuffer | panelW×panelH×2 | `LucarneDisplay.cpp` |
| SD cache cap | **2 MB** | `LucarneImageLoader.cpp` |
| SD slots | 32 | same |
| Anim snap slots | **6 icons max** | `LucarneIconDraw.cpp` |
| Per-icon snap | w×h×2 | same |
| Per-icon ready[] | frameCount × w×h×2 | pre-allocated at once |
| Transition temp | 2× full frames (peak) | `LucarneDisplay.cpp` |

**Documentation drift:** `docs/SD.md` and `docs/RUNTIME.md` still say 384 KB SD cache — **update Lucarne docs to 2 MB**.

## Failure mode on N16R2 (why Lovebox feels ~1 fps)

1. `snapEnsureReady()` allocates `frameCount` buffers immediately.
2. 128×128 × 12 frames × 2 bytes ≈ 384 KB + 32 KB snap ≈ 416 KB per icon.
3. SD cache grows toward 2 MB cap in PSRAM.
4. Allocation fails → `buildAnimReady()` false → slow path:
   - `writeBufferRect` (restore underlay)
   - `drawImageAssetSd` or row streaming with SD seeks
   - partial flush
5. No Serial log on failure (silent).

## Export pipeline (Studio → device)

| Output | Role |
|--------|------|
| `Projet_icons.h` | Flash or SD path refs for anim/static icons |
| `*.rgb565` + `*.alpha` on SD | Raw frames |
| `Projet_setup.h` | SPI pins, `mountSdCard()` |
| `ImageStorage::Web` | **Exported only — no firmware loader** |

APNG → multi-frame via `fluent-emojis.js` / `export.js`.

## Gaps vs Lovebox product goals

| Goal | Lucarne status | Priority |
|------|----------------|----------|
| Multiple anim icons (3+) | Cap 6; memory bound on R2 | P0 hardware + P1 lazy alloc |
| Fluid 128×128 emoji | Ready cache | P0 |
| WiFi fetch emoji/image | Not implemented | P0 new module |
| ≤2 s first display after download | Needs cache + format | P1 |
| BLE + WiFi + anim | No guidance | P1 task pinning |
| External W25Q256 | Not implemented | P2 |
| `sdCacheWarmAnim()` | Never called from runtime | P0 one-line integration |
| Flash/RLE anim fast path | Falls back to slow draw | P2 |
| Batch partial flush | One SPI transaction per icon | P2 |

## Recommended Lucarne changes (ordered)

### P0 — unlock Lovebox on N16R8

1. **Lazy ready frames:** allocate `ready[i]` on first use; keep only current + next (+ LRU evict).
2. **Memory budget API:** `setAnimCacheBudget(bytes)`, `setSdCacheMaxBytes(bytes)` — auto-scale to detected PSRAM.
3. **Diagnostics:** Serial log when `snapEnsureReady` / `sdCacheLoadSlot` fails (once per boot per subsystem).
4. **Warm cache:** call `sdCacheWarmAnim(anim, 0)` in `iconAnimSnapCapture` or `UI::navigate` for visible SD anims.
5. **Web loader:** `LucarneAssetFetch.cpp` — HTTP GET → `/cache/{hash}` on SD → invalidate SD slot → warm cache.
6. **Fix docs:** SD.md cache size, alpha sidecars.

### P1 — product polish

7. **Batch dirty rect** in `iconAnimPatchScreen` (union of icon rects → single flush).
8. **Download manager task** on Core 0; queue jobs; UI reads only from cache.
9. **Studio export:** optional pre-composited `.dframe` (BE16 widget-sized) for static backgrounds under icon.
10. **`initStorage()`** in generated `Projet_setup.h` (dual SPI if configured).

### P2 — hardware options

11. **SD_MMC backend** for ESP-IDF builds.
12. **LittleFS on external flash** partition reader sharing `ImageStorage::Sd` path abstraction (`/assets` VFS).
13. **Internal DMA stripe flush** for PSRAM framebuffer (Espressif BSP pattern).

## API sketch: web asset sync

```cpp
struct AssetFetchJob {
    const char *url;
    const char *destPath;  // e.g. "/cache/e_1f496_f00.rgb565"
    void (*onDone)(bool ok);
};

void assetFetchQueue(const AssetFetchJob *job);
bool assetFetchPoll();  // call from loop, non-blocking
```

Lucarne UI calls `sdCacheEnsure` after file complete; icon ref can point to cache path.

## Testing checklist

- [ ] Boot log: PSRAM size ≥ 8 MB on target module
- [ ] After screen show: all anim `readyBuilt[i]` true within 2 loops
- [ ] `ESP.getFreePsram()` stable during anim (no leak)
- [ ] WiFi download 500 KB PNG pack < 2 s on local server
- [ ] Three anim icons same screen ≥ 12 fps effective

## Relation to Lovebox repo

Lovebox firmware project should pin:

- Lucarne version / git submodule
- Module: N16R8
- Partition: keep FAT for SD cache + assets
- This research pack under `docs/research/`
