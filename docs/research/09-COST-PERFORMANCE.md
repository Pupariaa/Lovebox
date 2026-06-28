# Cost vs performance trade-offs

Pricing indicative — distributor MOQ 100–650 pcs, 2025–2026 (LCSC, FindChips, JLC). Verify before BOM lock.

## Module cost delta (ESP32-S3-WROOM-1)

| Module | Flash | PSRAM | ~Unit @ 100 | ~Unit @ 650+ | Anim + WiFi fit |
|--------|-------|-------|-------------|--------------|-----------------|
| N16R2 | 16 MB | 2 MB Q | USD 3.7–4.8 | USD 3.4–3.5 | **Poor** multi-anim |
| N16R8 | 16 MB | 8 MB O | USD 4.3–5.5 | USD 3.8–4.1 | **Good** |
| N8R2 | 8 MB | 2 MB Q | USD 3.5–4.5 | lower | **Reject** new design |

**Incremental cost N16R2 → N16R8:** approximately **USD +0.30 to +0.80** per unit at production volumes.

**ROI:** avoids support burden of "laggy emoji", returns higher perceived product value; cheaper than adding external PSRAM (impossible) or second MCU.

## Storage options

| Option | Extra BOM | Capacity | Best for |
|--------|-----------|----------|----------|
| microSD socket only | +USD 0.20–0.40 | GB | User/server expandable library |
| W25Q256 | +USD 1.5–2.5 | 32 MB fixed | Factory-preloaded catalog |
| Both | +USD 2–3 | Hybrid | Premium SKU |
| Internal flash only | USD 0 | ~9 MB FAT partition | Too small for rich emoji |

**Recommendation:** **SD slot only** for Lovebox v1 (matches current PCB + Lucarne). W25Q256 only if eliminating card slot for mechanical/sealing reasons.

## Software cost (engineering time vs hardware)

| Investment | Effect | $ |
|------------|--------|---|
| N16R8 module swap | Immediate PSRAM headroom | Low hardware |
| Lucarne P0 patches (lazy cache, warm, web fetch) | Fixes root cause on any HW | Medium dev |
| Dual SPI PCB | Marginal unless SD-bound | Medium PCB |
| SDMMC 1-bit PCB | Faster sync, less bus fight | Medium PCB |
| Move to LVGL | Rewrite UI layer | **High** — avoid |

Cheapest **system** path: **N16R8 + Lucarne P0** (no PCB spin).

## Performance per dollar (ranked)

1. **N16R8** — highest impact / lowest effort
2. **Lucarne lazy ready + warm cache + budget API** — free in firmware
3. **SD SPI 40 MHz + MISO pull-up** — free in firmware
4. **SDMMC 1-bit** — PCB + firmware port
5. **Dual SPI** — PCB + wiring
6. **W25Q256** — BOM + bring-up; does not fix PSRAM anim alone
7. **ESP32-P4** — wrong economics for v1

## SKU strategy

| SKU | Module | Storage | Target price positioning |
|-----|--------|---------|------------------------|
| Lovebox Core | N16R8 | SD | Standard animated emoji |
| Lovebox Lite (optional) | N16R2 | SD | Static emoji only / 1 small anim — **risky** |
| Lovebox Plus (optional) | N16R8 | SD + W25Q256 | Offline factory pack + online updates |

Avoid shipping Lite with marketing "animated stickers" — R2 will underperform.

## Total incremental BOM for recommended upgrade

From N16R2 + shared SPI SD (baseline) to **recommended v1**:

| Item | Delta |
|------|-------|
| N16R8 vs N16R2 | +USD 0.30–0.80 |
| Firmware Lucarne P0 | engineering only |
| **Total hardware delta** | **< USD 1** |

## Limits on "rentable" cost cutting

Do **not** cut:

- PSRAM below 8 MB for animated Lovebox
- MISO pull-up / SD wiring quality (causes phantom "slow SD")
- Export resolution below display size

Acceptable cuts:

- Industrial SD → consumer card (reliability trade)
- W25Q256 if SD-only strategy
- Dual OTA partition if USB-only update acceptable (not recommended retail)
