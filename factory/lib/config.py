from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
FACTORY_ROOT = REPO_ROOT / "factory"
SKETCH = REPO_ROOT / "firmware" / "boite-a-coeur"
DATA_DIR = SKETCH / "data"
ASSETS_DIR = DATA_DIR / "assets"
DEVICES_DIR = SKETCH / "factory" / "devices"
ARCHIVES_DIR = FACTORY_ROOT / "archives"
RELEASES_DIR = FACTORY_ROOT / "releases"
REGISTRY = FACTORY_ROOT / "registry.json"
VERSION_FILE = FACTORY_ROOT / "VERSION"
FW_HEADER = SKETCH / "BacFirmware.h"
BUILD_DIR = SKETCH / "build" / "esp32.esp32.esp32s3"

FQBN = (
    "esp32:esp32:esp32s3:UploadSpeed=921600,USBMode=default,CDCOnBoot=cdc,"
    "UploadMode=cdc,CPUFreq=240,FlashMode=qio,FlashSize=16M,"
    "PartitionScheme=app3M_fat9M_16MB,PSRAM=opi,LoopCore=1,EventsCore=1"
)

FFAT_OFFSET = 0x610000
FFAT_SIZE = 0x9E0000
NVS_OFFSET = 0x9000
NVS_SIZE = 0x5000

FLASH_MAP = {
    "bootloader": (0x0, "boite-a-coeur.ino.bootloader.bin"),
    "partitions": (0x8000, "boite-a-coeur.ino.partitions.bin"),
    "boot_app0": (0xE000, "boot_app0.bin"),
    "firmware": (0x10000, "boite-a-coeur.ino.bin"),
    "ffat": (FFAT_OFFSET, "ffat.bin"),
}

ARDUINO15 = Path.home() / "AppData" / "Local" / "Arduino15"
USBCDC_CPP = ARDUINO15 / "packages" / "esp32" / "hardware" / "esp32" / "3.3.10" / "cores" / "esp32" / "USBCDC.cpp"
ESPTOOL = ARDUINO15 / "packages" / "esp32" / "tools" / "esptool_py" / "5.3.0" / "esptool.exe"
BOOT_APP0 = ARDUINO15 / "packages" / "esp32" / "hardware" / "esp32" / "3.3.10" / "tools" / "partitions" / "boot_app0.bin"
MKFATFS = FACTORY_ROOT / "tools" / "bin" / "mkfatfs.exe"

LUCARNE_CANDIDATES = [
    REPO_ROOT.parent / "Lucarne",
    Path.home() / "Documents" / "GitHub" / "Lucarne",
    Path.home() / "Documents" / "Arduino" / "libraries" / "Lucarne",
]
