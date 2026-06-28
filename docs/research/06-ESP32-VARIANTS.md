# ESP32 variant selection for Lovebox

Sources: Espressif product lines, [BLEFYI S3 vs C6](https://blefyi.com/compare/esp32-c6-vs-esp32-s3/), DroneBot Workshop 2026 guide, circuitlabs variant table.

## Requirements recap

- Color SPI display 280×240, animated icons, photos
- WiFi (fetch assets from server) + BLE (provisioning / companion)
- Fluid UI, ≤2 s asset fetch
- Cost-sensitive consumer product

## Candidates

### ESP32-S3 (recommended)

| Pro | Con |
|-----|-----|
| Dual-core 240 MHz, mature Arduino/Lucarne stack | WiFi 4 only |
| Native USB CDC | No Bluetooth Classic (A2DP) |
| AI vector ops (unused today) | Last major Xtensa line |
| N16R8: 8 MB Octal PSRAM | R8 temp max 65 °C |
| BLE 5.0 | |

**Verdict:** default choice for Lovebox.

### ESP32 (classic, e.g. WROOM-32)

| Pro | Con |
|-----|-----|
| Bluetooth Classic + BLE | Less RAM, no Octal PSRAM on common modules |
| Cheaper legacy modules | Weaker for 280×240 full buffer + WiFi + anim |
| Huge ecosystem | Not recommended for new Lovebox design |

### ESP32-S2

No BLE. Disqualified for BLE + WiFi product.

### ESP32-C3 (RISC-V, single-core)

| Pro | Con |
|-----|-----|
| Lower cost | Single core 160 MHz |
| BLE 5 | No PSRAM on typical modules |
| WiFi 4 | Weak for Lucarne full framebuffer + anim |

Disqualified for animated color UI at target quality.

### ESP32-C6

| Pro | Con |
|-----|-----|
| WiFi 6, BLE 5.3, Matter/Thread | Single core 160 MHz |
| Lower power | **No RGB/SPI LCD peripheral focus** |
| Good for smart home hub | Lucarne not ported; anim would suffer |

Use C6 for **gateway**, not Lovebox display device.

### ESP32-P4

| Pro | Con |
|-----|-----|
| 400 MHz dual-core, H.264, MIPI/RGB LCD | **No integrated WiFi/BT** — companion chip required |
| Huge PSRAM options | Overkill cost/complexity for Lovebox |

Future platform if product grows to video; not v1.

### ESP32-H2

802.15.4 only, no WiFi. Disqualified.

## WiFi + BLE concurrency

ESP32-S3 runs WiFi stack + NimBLE on same chip:

- Download assets on **Core 0** (WiFi task) with HTTP client; write SD.
- UI loop **Core 1** (`loop` / `ui.update`) — avoid blocking HTTP in `loop()`.
- During anim playback, **pause large downloads** or throttle to keep SPI/CPU for flush.
- BLE provisioning sessions: short; OK overlapping idle UI.

Arduino ESP32 3.x supports `xTaskCreatePinnedToCore` for download worker.

## Module SKU decision

| SKU | Lovebox v1 |
|-----|------------|
| N8R2 | Reject |
| N16R2 | Accept only for cost-limited SKU with reduced anim |
| **N16R8** | **Primary SKU** |
| N16R16VA7 | Overkill unless 16 MB PSRAM needed (many simultaneous HD assets) |

## Long-term roadmap

1. **Now:** ESP32-S3 N16R8 + Lucarne optimizations.
2. **If Matter hub needed:** separate C6 border router — not merged into display MCU.
3. **If video Lovebox:** evaluate P4 + C6 WiFi companion — new architecture.
