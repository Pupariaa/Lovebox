from pathlib import Path

from .config import ARDUINO15

PATCH_MARKER = "// BAC custom CDC interface name"
ORIGINAL_LINE = '  uint8_t str_index = tinyusb_add_string_descriptor("TinyUSB CDC");'
PATCHED_BLOCK = """extern "C" const char *bac_usb_cdc_interface_name(void);

static uint16_t load_cdc_descriptor(uint8_t *dst, uint8_t *itf) {
  uint8_t str_index = tinyusb_add_string_descriptor(bac_usb_cdc_interface_name());"""


def find_usbcdc_cpp() -> Path:
    hardware_root = ARDUINO15 / "packages" / "esp32" / "hardware" / "esp32"
    if not hardware_root.exists():
        raise FileNotFoundError(f"esp32 hardware package not found: {hardware_root}")
    matches = sorted(hardware_root.glob("*/cores/esp32/USBCDC.cpp"), reverse=True)
    if not matches:
        raise FileNotFoundError(f"USBCDC.cpp not found under {hardware_root}")
    return matches[0]


def is_patched(text: str) -> bool:
    return PATCH_MARKER in text or "bac_usb_cdc_interface_name" in text


def apply_usbcdc_patch() -> Path:
    path = find_usbcdc_cpp()
    original = path.read_text(encoding="utf-8")
    if is_patched(original):
        print(f"USBCDC.cpp already patched: {path}")
        return path

    needle = "static uint16_t load_cdc_descriptor(uint8_t *dst, uint8_t *itf) {\n" + ORIGINAL_LINE
    if needle not in original:
        raise RuntimeError(
            f"USBCDC.cpp layout changed; cannot patch automatically: {path}\n"
            "See https://github.com/espressif/arduino-esp32/issues/11394"
        )

    updated = original.replace(
        needle,
        PATCH_MARKER + "\n" + PATCHED_BLOCK,
        1,
    )
    backup = path.with_suffix(".cpp.bac-backup")
    if not backup.exists():
        backup.write_text(original, encoding="utf-8")
    path.write_text(updated, encoding="utf-8")
    print(f"patched USBCDC.cpp: {path}")
    return path
