# Cost vs performance trade-offs

Pricing indicative — distributor MOQ 100–650 pcs, 2025–2026 (LCSC, FindChips, JLC). Verify before BOM lock.

**Recheck:** 2025-06-25

## Module cost delta (ESP32-S3-WROOM-1)

| Module | Flash | PSRAM | ~Unit @ 100 | ~Unit @ 650+ | Anim + WiFi fit |
|--------|-------|-------|-------------|--------------|-----------------|
| N16R2 | 16 MB | 2 MB Q | USD 3.7–4.8 | USD 3.4–3.5 | **Poor** multi-anim |
| N16R8 | 16 MB | 8 MB O | USD 4.3–5.5 | USD 3.8–4.1 | **Good** |
| N8R2 | 8 MB | 2 MB Q | USD 3.5–4.5 | lower | **Reject** new design |

**Incremental cost N16R2 → N16R8:** approximately **USD +0.30 to +0.80** per unit at production volumes.

**ROI:** avoids support burden of "laggy emoji" on R2; higher perceived value; cheaper than second MCU or impossible external PSRAM.

**Hidden cost of staying on N16R2 for anim SKU:** support tickets, returns, firmware workarounds that cannot fix 2 MB ceiling — exceeds USD 0.80/unit quickly.

## Storage options

| Option | Extra BOM | Capacity | Best for |
|--------|-----------|----------|----------|
| microSD socket only | +USD 0.20–0.40 | GB | User/server expandable library |
| W25Q256 | +USD 1.5–2.5 | 32 MB fixed | Factory-preloaded catalog |
| Both | +USD 2–3 | Hybrid | Premium SKU |
| Internal `ffat` only | USD 0 | ~9 MB on 16 MB flash | Too small; **not** Lucarne SD path |

**Recommendation:** **SD slot only** for Lovebox v1. W25Q256 only if eliminating card slot — **does not replace N16R8**.

## PSRAM ECC (no BOM, firmware cost)

| Option | Cost | Benefit |
|--------|------|---------|
| N16R8 standard | USD 0 | 8 MB PSRAM, 65 °C max |
| N16R8 + `CONFIG_SPIRAM_ECC_ENABLE` | Dev time + rebuild | 85 °C max, **−512 KB** PSRAM, slower |

Use ECC only for hot-enclosure SKU — not default indoor Lovebox.

## Software cost (engineering time vs hardware)

| Investment | Effect | $ |
|------------|--------|---|
| N16R8 module swap | Immediate PSRAM headroom | Low hardware |
| Lucarne P0 (warm cache wire + lazy ready + budget API) | Fixes root cause | Medium dev |
| Dual SPI PCB | Marginal unless SD-bound | Medium PCB |
| SDMMC 1-bit PCB | Faster sync | Medium PCB |
| Move to LVGL | Rewrite UI | **High** — avoid |

Cheapest **system** path: **N16R8 + Lucarne P0** (no PCB spin).

First firmware patch with highest ROI: **wire `sdCacheWarmAnim` in `iconAnimSnapCapture`** (API already exists).

## Performance per dollar (ranked)

1. **N16R8** — highest impact / lowest effort
2. **Lucarne lazy ready + warm cache wire + budget API** — firmware only
3. **SD SPI 40 MHz + MISO 10k pull-up** — firmware + PCB review
4. **SDMMC 1-bit** — PCB + firmware port
5. **Dual SPI** — PCB + wiring
6. **W25Q256** — BOM + bring-up; **does not fix PSRAM anim**
7. **ESP32-P4** — wrong economics for v1

## SKU strategy

| SKU | Module | Storage | Target |
|-----|--------|---------|--------|
| Lovebox Core | N16R8 | microSD | Standard animated emoji |
| Lovebox Lite (optional) | N16R2 | microSD | Static only / 1 small anim — **risky** |
| Lovebox Plus (optional) | N16R8 | microSD + W25Q256 | Factory pack + online updates |
| Lovebox Hot (optional) | N16R8 + PSRAM ECC | microSD | Enclosure > 65 °C ambient |

Avoid marketing "animated stickers" on Lite (R2).

## Total incremental BOM for recommended upgrade

From N16R2 + shared SPI SD (baseline) to **recommended v1**:

| Item | Delta |
|------|-------|
| N16R8 vs N16R2 | +USD 0.30–0.80 |
| Firmware Lucarne P0 | engineering only |
| **Total hardware delta** | **< USD 1** |

## Limits on cost cutting

Do **not** cut:

- PSRAM below 8 MB for animated Lovebox
- MISO pull-up / SD wiring (phantom "slow SD" → false software debugging)
- Export below widget size (pixelation)
- Assuming `app3M_fat9M` replaces microSD for Lucarne assets

Acceptable cuts:

- Consumer vs industrial SD card
- Defer W25Q256 and dual SPI to v2
- Dual OTA partition if USB-only update (not recommended retail)
