# Action plan and decisions

Consolidated roadmap from research pack (recheck 2025-06-25). Goal: fluid multi-icon UI, web assets, WiFi/BLE, ≤2 s fetch LAN, minimal limits.

## Decision log (recommended defaults)

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | MCU **ESP32-S3-WROOM-1-N16R8** | 8 MB Octal PSRAM required for Lucarne anim cache + WiFi |
| D2 | Keep **microSD FAT** v1 | Lucarne mature path; field updates; distinct from internal `ffat` |
| D3 | Defer **W25Q256** to v2 optional | SD sufficient; does not fix PSRAM |
| D4 | Defer **dual SPI** to v2 PCB | PSRAM fix first; marginal alone |
| D5 | Plan **SDMMC 1-bit** on v2 PCB | Best storage $/MB/s vs Arduino SPI SD |
| D6 | Implement **Lucarne P0** in library repo | Product-agnostic; Lovebox consumes |
| D7 | **HTTP asset worker** in Lovebox firmware | Server coupling stays in product repo |
| D8 | Do **not** migrate to LVGL short-term | Lucarne + Studio export already invested |
| D9 | Wire **`sdCacheWarmAnim` first** | API exists; highest ROI 1-line patch |

## Phase 0 — Validate (1–2 days)

**Hardware**

- [ ] Confirm module variant (`ESP.getPsramSize()` — expect 8388608 for R8)
- [ ] If R2: swap one prototype to N16R8 for A/B

**Firmware diagnostics sketch**

- [ ] PSRAM total/free at boot, after `WiFi.begin()`, after first screen draw
- [ ] Internal heap free (`heap_caps_get_free_size(MALLOC_CAP_INTERNAL)`)
- [ ] SD mount + `sdImageLastFail()` / `sdImageLastPath()`
- [ ] Time partial flush 128×128 (`micros()` around `display(x,y,128,128)`)
- [ ] Log whether `buildAnimReady` succeeds (temporary hook or Serial in Lucarne fork)

**Exit criteria:** N16R8 shows ready-cache path; fps visibly > 10 on one 128×128 icon.

## Phase 1 — Lucarne P0 (library, ~1 week)

| Order | Task | File(s) | Notes |
|-------|------|---------|-------|
| **1** | Call `sdCacheWarmAnim(anim, 0)` | `LucarneIconDraw.cpp` | In `iconAnimSnapCapture` — API already in `LucarneImageLoader.cpp` |
| 2 | Lazy `ready[i]` allocation | `LucarneIconDraw.cpp` | Drop all-at-once `snapEnsureReady` prealloc |
| 3 | PSRAM budget config | `LucarneImageLoader.cpp`, `LucarneIconDraw.cpp` | Scale SD cache vs anim cache by `ESP.getPsramSize()` |
| 4 | Failure logging | same | Serial once if alloc fails |
| 5 | Batch partial flush | `LucarneIconDraw.cpp` | Union dirty rect in `iconAnimPatchScreen` |
| 6 | Fix docs 384 KB → 2 MB | `docs/SD.md`, `docs/RUNTIME.md` | Lucarne repo |

**Exit criteria:** 3 anim icons 128×128 on N16R8 smooth; no SD read in steady state.

## Phase 2 — Web assets (Lovebox firmware + Lucarne, ~1–2 weeks)

| Task | Owner | Notes |
|------|-------|-------|
| HTTP GET → SD worker | Lovebox | Non-blocking, **Core 0** |
| Write `*.tmp` + rename | Lovebox | FAT wear + atomic update |
| Manifest parser | Lovebox | JSON minimal |
| Cache paths `/cache/` | Lovebox + Studio | Hash in filename |
| UI hook after fetch | Lovebox | `ui.invalidate()` + warm cache |
| TLS + cert bundle | Lovebox | `WiFiClientSecure` |
| WAN > 2 s | Lovebox | Placeholder icon until download complete |

**Exit criteria:** New emoji from server ≤ 2 s **LAN**; cached reboot instant.

## Phase 3 — WiFi/BLE product hardening (~1 week)

- [ ] BLE provisioning (WiFi creds) — pause heavy download
- [ ] Pin download + NimBLE Core 0, UI Core 1; `CONFIG_SW_COEXIST_ENABLE`
- [ ] Avoid asset sync during Lucarne screen transitions (`delay()` blocking)
- [ ] Soak test 24 h anim + periodic manifest poll
- [ ] OTA firmware without wiping `/cache/` on microSD
- [ ] Optional: `CONFIG_SPIRAM_TRY_ALLOCATE_WIFI_LWIP`

## Phase 4 — Hardware v2 (optional PCB)

- [ ] SDMMC 1-bit routing (10k pull-ups CLK/CMD/D0)
- [ ] Display on FSPI dedicated
- [ ] Optional W25Q256 for factory pack
- [ ] Thermal test N16R8 in enclosure; PSRAM ECC if > 65 °C ambient

## Lucarne API additions (spec)

```cpp
void setSdCacheMaxBytes(size_t bytes);
void setAnimReadyBudget(size_t bytes);
void sdCacheWarmAnim(const IconAnimAsset *anim, uint8_t maxFrames = 0);

bool assetFetchBegin(const char *url, const char *destPath);
AssetFetchState assetFetchPoll();
```

Note: `sdCacheWarmAnim` **already implemented** — only integration + budget APIs needed.

## Risk register

| Risk | Mitigation |
|------|------------|
| R8 65 °C limit in hot enclosure | Thermal test; PSRAM ECC (−512 KB) or non-anim SKU |
| PSRAM fragmentation | Lazy alloc + cap; `releaseSdImageCache()` on screen change |
| WiFi blocking UI | Strict async fetch Core 0; no HTTP in `loop()` |
| Lucarne transition `delay()` | Defer sync during navigate; P2 non-blocking transition |
| Lucarne / Lovebox version skew | Submodule or pinned release tag |
| Fake N16R8 modules | LCSC/Mouser; verify PSRAM at boot |
| 2 s fetch on slow WAN | Placeholder icon; background download |
| SD SPI mis-wiring | MISO 10k; benchmark read; IDFGH-16909 checks |
| IDF 5.x SD SPI regression | Benchmark after core upgrade |
| Partition confusion (`ffat` vs SD) | Document in product README; assets on microSD only |

## What we explicitly will not do (scope control)

- Full LVGL migration
- On-device APNG decode
- ESP32-P4 platform for v1
- Unlimited anim icons without memory budget
- Bluetooth Classic audio
- Octal PSRAM 120 MHz in production v1
- Rely on internal `app3M_fat9M` for Lucarne emoji assets without `FFat` port

## Next immediate steps

1. Flash boot diagnostic on current board (PSRAM size, flush timing).
2. If ≤ 2 MB PSRAM: order N16R8 dev board.
3. Lucarne repo: wire `sdCacheWarmAnim` in `iconAnimSnapCapture` (first P0 patch).
4. Lucarne repo: lazy ready alloc + budget API (remaining P0).

## Document index

See [README.md](README.md) for full research pack.
