# Lucarne Studio export

UI screens, fonts, icons, and volume assets are authored in Lucarne Studio and exported into `firmware/boite-a-coeur/`.

## Project file

`firmware/boite-a-coeur/Lovebox.lucarne.json`

Key fields:

| Field | Value (Lovebox) |
| --- | --- |
| `name` | Lovebox |
| `deviceId` | `st7789_169` |
| `panelWidth` | 240 |
| `panelHeight` | 280 |
| `rotation` | 1 |

Open this file in Lucarne Studio (from the `../Lucarne` checkout: `editor/` or packaged app).

## Export outputs

Studio writes into the sketch folder:

| File | Contents |
| --- | --- |
| `Projet.h` | Screens, widgets, navigation, `projet::build()` |
| `Projet_fonts.h` | Font glyph data |
| `Projet_icons.h` | Icon references |
| `Projet_images.h` | Embedded images |
| `data/assets/...` | RGB565 / alpha assets on FFat |
| `data/VOLUME_MANIFEST.txt` | Upload checklist |
| `data/LucarneUserConfig.h` | Volume feature flags (keep in sync with sketch root) |

`Projet_setup.h` is hand-maintained (GPIO, SPI, mount). Do not overwrite it from Studio.

## Workflow

1. Edit UI in Studio against `Lovebox.lucarne.json`.
2. Export to `firmware/boite-a-coeur/`.
3. If assets changed, upload `data/` to FFat (**ESP32 Sketch Data Upload**).
4. Recompile and flash `boite-a-coeur.ino`.

## Partition alignment

Studio export assumes:

- Partition scheme: **16M Flash (3MB APP/9.9MB FATFS)**
- Volume label: `ffat`
- Nested paths under `/assets/` on the device

Mismatch between partition scheme and export causes missing icons or mount failures.

## Firmware-only screens

`message_opened` is defined in `BacScreens.h`, not in Studio. It hosts the BACM overlay. Other runtime screens (`new_message`, `idle`, etc.) are Studio screens referenced by name in `BacApp`.

## Screen names

Exported screens use stable `name` strings (e.g. `idle`, `settings_menu`). `BacApp` navigates by name — see [SCREENS.md](SCREENS.md). After renaming in Studio, update `BacApp` references if logic keys off a specific name.
