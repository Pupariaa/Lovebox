# Lucarne library analysis (animation, memory, gaps)

Repo: [Lucarne](https://github.com/Pupariaa/Lucarne) (v0.1.x). Lovebox consumes Lucarne as Arduino library + Studio export headers.

**Recheck:** 2025-06-25 (cross-checked against `LucarneIconDraw.cpp`, `LucarneImageLoader.cpp`, `LucarneDisplay.cpp`, `LucarneUI.cpp`, `fluent-emojis.js`)

## Animation pipeline (current)

```
Screen::draw()                          LucarneScreen.cpp
  └─ iconAnimSnapCapture(g, ic)         // snap widget rect; snapEnsureReady all frames
  └─ Icon::draw()                       // frame 0 via iconAnimDrawInitial

UI::update() each loop                  LucarneUI.cpp
  └─ iconAnimPatchScreen()              // per icon: blit ready OR slow path
       └─ display(x,y,w,h)             // partial SPI flush PER icon (no batch yet)
```

### Fast path requirements

- `BufferMode::Full` + `canPeekPixel()` + framebuffer allocated
- `snapEnsureReady()` succeeded — all `ready[i]` allocated at once (`LucarneIconDraw.cpp` L94–112)
- SD frames in PSRAM cache for `sdBuildDisplayFrame()` (`LucarneImageLoader.cpp` L344+)
- `_animLookup` registered (exported anim icons)

### Slow path (when ready alloc fails)

`iconAnimPatchScreen()` L248–256:

1. `writeBufferRect` — restore snap underlay from `slot->buf`
2. `drawAnimFrameFit` → SD read + CPU alpha blend into framebuffer
3. `display(x,y,w,h)` — partial SPI flush

No Serial log on failure (silent).

## Memory constants (code, not docs)

| Pool | Size | File |
|------|------|------|
| Framebuffer | panelW×panelH×2 (~131 KB @ 280×240) | `LucarneDisplay.cpp` |
| SD cache cap | **2 MB** | `LucarneImageLoader.cpp` L20 |
| SD slots | 32 | same |
| Anim snap slots | **6 icons max** (`kMaxAnimSnaps`) | `LucarneIconDraw.cpp` L38 |
| Per-icon snap | widget **w×h×2** (not iconDrawSizeFor) | `iconAnimSnapCapture` L268–297 |
| Per-icon ready[] | frameCount × **w×h×2** | pre-allocated in `snapEnsureReady` |
| Transition peak | 2× full frames via `allocFrame()` (~262 KB × 2) | `LucarneUI.cpp` L221–279 — **navigation only** |
| Display line buffer | maxDim×2 internal DMA | `LucarneDisplay.cpp` when FB in PSRAM |

**Documentation drift (Lucarne repo):** `docs/SD.md` and `docs/RUNTIME.md` still say **384 KB** SD cache — code uses **2 MB**. Fix in Lucarne Phase 1.

## PSRAM budget (Studio export)

From `fluent-emojis.js`: `SIZE=32`, scale ×4 → 128 px typical; **`MAX_EXPORT_PX=160`**.

| Widget | Ready ×12 | Snap | Total/icon |
|--------|-----------|------|------------|
| 128×128 | 384 KB | 32 KB | **416 KB** |
| 160×160 | 614 KB | 51 KB | **665 KB** |

SD cache slot footprint = **file resolution** (`aw×ah×2 + alpha`), not widget size. Composite scaling happens in `sdBuildDisplayFrame` CPU loop.

### Multi-icon on N16R2 (2 MB PSRAM)

| Items | Approx |
|-------|--------|
| Framebuffer | 131 KB |
| 3× ready 128×128 | 1.25 MB |
| SD cache (warm) | up to 2 MB cap — **competes** |
| **Result** | `snapEnsureReady` fails → slow path ~1 fps |

### Multi-icon on N16R8 (8 MB PSRAM)

| Items | Approx |
|-------|--------|
| Framebuffer + 3× ready 128×128 + SD cache headroom | ~3–4 MB |
| **Result** | fits with margin for WiFi buffers in PSRAM |

## Failure mode on N16R2 (why Lovebox feels ~1 fps)

1. `snapEnsureReady()` allocates all `ready[i]` immediately (L105–110).
2. Competes with 2 MB SD cache cap and 131 KB framebuffer in same PSRAM pool.
3. Allocation fails → `buildAnimReady()` false every frame.
4. Slow path: SD read + blend + per-icon SPI flush (~8–15 ms each @ 128×128).
5. **`sdCacheWarmAnim()` exists (L317) but is never called from `iconAnimSnapCapture`** — cold SD on every composite even when alloc succeeds partially.

## Export pipeline (Studio → device)

| Output | Role |
|--------|------|
| `Projet_icons.h` | Flash or SD path refs for anim/static icons |
| `*.rgb565` + `*.alpha` on SD | Raw frames at `exportPx` |
| `Projet_setup.h` | SPI pins, `mountSdCard()` |
| `ImageStorage::Web` | **Exported only — no firmware loader** |

APNG 256×256 → rasterized via `fluent-emojis.js` / export.

## Hot path detail: `buildAnimReady` + prefetch

`iconAnimPatchScreen()` L248–262:

- If `buildAnimReady(slot, anim, fi)` → `blitBufferRect` + `display()` — **fast**
- Prefetches **next** frame: `buildAnimReady(slot, anim, ni)` — good design, useless if `ready[]` never allocated

## Display flush bottleneck (secondary)

PSRAM framebuffer → `_bufferDmaSafe=false` → row copy to internal `_lineBuf` before SPI (`LucarneDisplay.cpp` L449–456).

Three anim icons × separate `display()` calls per `ui.update()` tick ≈ **24–45 ms** SPI overhead alone at 128×128.

## Gaps vs Lovebox product goals

| Goal | Lucarne status | Priority |
|------|----------------|----------|
| Multiple anim icons (3+) | Cap 6; memory bound on R2 | P0 hardware + P1 lazy alloc |
| Fluid 128×128 emoji | Ready cache | P0 |
| WiFi fetch emoji/image | Not implemented | P0 new module (Lovebox) |
| ≤2 s first display after download | Needs cache + warm + ready | P1 |
| BLE + WiFi + anim | No guidance in library | P1 task pinning (Lovebox) |
| External W25Q256 | Not implemented | P2 |
| `sdCacheWarmAnim()` | **API exists, not wired to runtime** | **P0 one-line integration** |
| Batch partial flush | One SPI transaction per icon | P1 |
| Transition blocking | `delay(16)` in `runTransition` | P2 non-blocking transition |

## Recommended Lucarne changes (ordered)

### P0 — unlock Lovebox on N16R8

| # | Patch | File |
|---|-------|------|
| 1 | Call `sdCacheWarmAnim(anim, 0)` in `iconAnimSnapCapture` | `LucarneIconDraw.cpp` |
| 2 | Lazy `ready[i]` — allocate current + next only; drop all-at-once prealloc | `LucarneIconDraw.cpp` |
| 3 | `setSdCacheMaxBytes` / `setAnimReadyBudget` scaled to `ESP.getPsramSize()` | `LucarneImageLoader.cpp`, `LucarneIconDraw.cpp` |
| 4 | Serial log once when `snapEnsureReady` / `sdCacheLoadSlot` fails | same |
| 5 | Union dirty rect + single `display()` in `iconAnimPatchScreen` | `LucarneIconDraw.cpp` |
| 6 | Fix docs 384 KB → 2 MB | `docs/SD.md`, `docs/RUNTIME.md` |

### P1 — product polish

7. **Web loader:** HTTP GET → `/cache/` on SD → warm cache (Lovebox or Lucarne module).
8. **Download manager** Core 0; UI Core 1 only touches display.
9. Studio optional pre-composited `.dframe` (BE16 widget-sized).
10. `initStorage()` in generated `Projet_setup.h` (dual SPI if configured).

### P2 — hardware options

11. **SD_MMC backend** for ESP-IDF builds.
12. LittleFS on external flash via unified VFS.
13. Internal DMA stripe flush for PSRAM framebuffer.

## API sketch: web asset sync

```cpp
struct AssetFetchJob {
    const char *url;
    const char *destPath;
    void (*onDone)(bool ok);
};

void assetFetchQueue(const AssetFetchJob *job);
bool assetFetchPoll();
```

After file complete: `sdCacheEnsure` + `sdCacheWarmAnim`; `ui.invalidate()`.

## Testing checklist

- [ ] Boot log: PSRAM size ≥ 8 MB on target module
- [ ] Log `ESP.getFreePsram()` before/after `WiFi.begin()`
- [ ] After screen show: `readyBuilt[i]` true within 2 loops (N16R8)
- [ ] Steady anim: no SD read (Serial timing or scope)
- [ ] Partial flush 128×128 measured (target < 15 ms)
- [ ] WiFi download 500 KB pack < 2 s LAN
- [ ] Three anim icons same screen ≥ 12 fps perceived

## Relation to Lovebox repo

Lovebox firmware should pin:

- Lucarne version / git submodule
- Module: **N16R8**
- Assets on **microSD FAT** (not internal `ffat` unless explicitly mounted)
- This research pack under `docs/research/`
