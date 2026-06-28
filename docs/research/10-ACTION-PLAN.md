# Action plan and decisions

Consolidated roadmap from research pack. Goal: fluid multi-icon UI, web assets, WiFi/BLE, ≤2 s fetch, minimal limits.

## Decision log (recommended defaults)

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | MCU **ESP32-S3-WROOM-1-N16R8** | 8 MB Octal PSRAM required for Lucarne anim cache + WiFi |
| D2 | Keep **microSD FAT** v1 | Lucarne mature path; field updates |
| D3 | Defer **W25Q256** to v2 optional | SD sufficient; saves BOM |
| D4 | Defer **dual SPI** to v2 PCB | PSRAM fix first; marginal alone |
| D5 | Plan **SDMMC 1-bit** on v2 PCB | Best storage $/MB/s |
| D6 | Implement **Lucarne P0** in library repo | Product-agnostic; Lovebox consumes |
| D7 | **HTTP asset worker** in Lovebox firmware | Server coupling stays in product repo |
| D8 | Do **not** migrate to LVGL short-term | Lucarne + Studio export already invested |

## Phase 0 — Validate (1–2 days)

**Hardware**

- [ ] Confirm module variant on existing boards (`ESP.getPsramSize()`)
- [ ] If R2: swap one prototype to N16R8 for A/B

**Firmware**

- [ ] Sync latest Lucarne to Arduino libraries (include `iconAnimDrawInitial` fix)
- [ ] Add boot diagnostics sketch: PSRAM free, SD mount, `sdImageLastFail()`
- [ ] Measure: one 128×128 anim — log whether `buildAnimReady` succeeds each frame

**Exit criteria:** N16R8 prototype shows ready-cache path; fps visibly > 10 on one icon.

## Phase 1 — Lucarne P0 (library, ~1 week)

| Task | File(s) | Notes |
|------|---------|-------|
| Lazy `ready[i]` allocation | `LucarneIconDraw.cpp` | Drop all-at-once `snapEnsureReady` prealloc |
| PSRAM budget config | `LucarneImageLoader.cpp`, `LucarneIconDraw.cpp` | Scale SD cache vs anim cache by `ESP.getPsramSize()` |
| Call `sdCacheWarmAnim` on snap | `LucarneIconDraw.cpp` | All frames prefetched to SD cache |
| Failure logging | same | Serial once if alloc fails |
| Batch partial flush | `LucarneIconDraw.cpp` | Union dirty rect |
| Fix docs 384 KB → 2 MB | `docs/SD.md`, `docs/RUNTIME.md` | |

**Exit criteria:** 3 anim icons 128×128 on N16R8 smooth without SD read in steady state (logic analyzer or Serial timing).

## Phase 2 — Web assets (Lovebox firmware + Lucarne, ~1–2 weeks)

| Task | Owner | Notes |
|------|-------|-------|
| `LucarneAssetFetch` HTTP → SD | Lucarne or Lovebox | Non-blocking, Core 0 task |
| Manifest parser | Lovebox | JSON minimal |
| Cache paths `/cache/` | Lovebox + Studio | Hash in filename |
| UI hook: refresh icon after fetch | Lovebox | `ui.invalidate()` + warm cache |
| TLS + cert bundle | Lovebox | ESP32 Arduino WiFiClientSecure |

**Exit criteria:** Push new emoji from server; device shows ≤ 2 s LAN; cached reboot instant.

## Phase 3 — WiFi/BLE product hardening (~1 week)

- [ ] BLE provisioning (WiFi creds only) — pause heavy download
- [ ] Pin download task Core 0, UI Core 1
- [ ] Soak test 24 h anim + periodic manifest poll
- [ ] OTA firmware without wiping `/cache/` partition on SD

## Phase 4 — Hardware v2 (optional PCB)

- [ ] SDMMC 1-bit routing
- [ ] Display on FSPI dedicated
- [ ] Optional W25Q256 for factory pack
- [ ] Verify N16R8 thermal in enclosure (< 65 °C ambient spec)

## Lucarne API additions (spec)

```cpp
void setSdCacheMaxBytes(size_t bytes);
void setAnimReadyBudget(size_t bytes);
void sdCacheWarmAnim(const IconAnimAsset *anim, uint8_t maxFrames = 0);

bool assetFetchBegin(const char *url, const char *destPath);
AssetFetchState assetFetchPoll();
```

## Risk register

| Risk | Mitigation |
|------|------------|
| R8 65 °C limit in hot enclosure | Thermal test; keep R2 only for non-anim SKU |
| PSRAM fragmentation | Lazy alloc + cap; `releaseSdImageCache()` on screen change |
| WiFi blocking UI | Strict async fetch |
| Lucarne / Lovebox version skew | Submodule or pinned release tag |
| Fake N16R8 modules | Buy LCSC/Mouser; verify PSRAM size at boot |
| 2 s fetch on slow WAN | Show placeholder icon; background download |

## What we explicitly will not do (scope control)

- Full LVGL migration
- On-device APNG decode
- ESP32-P4 platform for v1
- Unlimited anim icons without memory budget
- Bluetooth Classic audio

## Next immediate step for you

1. Flash boot diagnostic on current board (PSRAM size).
2. If ≤ 2 MB: order N16R8 module dev board.
3. Apply Lucarne Phase 1 in GitHub Lucarne repo (separate from this research commit).

## Document index

See [README.md](README.md) for full research pack.
