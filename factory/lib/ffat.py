import binascii
import random
import struct
import subprocess
from pathlib import Path

WL_SECTOR = 4096
WL_STATE_HEADER = 64
WL_STATE_RECORD = 16
WL_CONFIG_HEADER = 48
WL_UPDATE_RATE = 16
WL_WR_SIZE = 16
WL_VERSION = 2
WL_TEMP_BUFFER = 32


def plain_fat_bytes(partition_size: int) -> int:
    total_sectors = partition_size // WL_SECTOR
    wl_state_size = WL_STATE_HEADER + WL_STATE_RECORD * total_sectors
    wl_state_sectors = (wl_state_size + WL_SECTOR - 1) // WL_SECTOR
    wl_sectors = 1 + 1 + wl_state_sectors * 2
    plain_sectors = total_sectors - wl_sectors
    if plain_sectors <= 0:
        raise ValueError(f"partition too small for wear leveling: {partition_size}")
    return plain_sectors * WL_SECTOR


def _wl_crc(data: bytes) -> int:
    return binascii.crc32(data, 0xFFFFFFFF) & 0xFFFFFFFF


def wrap_wl(plain: bytes, partition_size: int) -> bytes:
    plain_sectors = len(plain) // WL_SECTOR
    if len(plain) % WL_SECTOR != 0:
        raise ValueError("plain FAT image must be sector aligned")
    expected_plain = plain_fat_bytes(partition_size)
    if len(plain) != expected_plain:
        raise ValueError(f"plain FAT size {len(plain)} != expected {expected_plain}")

    total_sectors = partition_size // WL_SECTOR
    wl_state_size = WL_STATE_HEADER + WL_STATE_RECORD * total_sectors
    wl_state_sectors = (wl_state_size + WL_SECTOR - 1) // WL_SECTOR

    max_pos = plain_sectors + 1
    device_id = random.randint(0, 0xFFFFFFFF)
    state_header = struct.pack(
        "<8I28s",
        0,
        max_pos,
        0,
        0,
        WL_UPDATE_RATE,
        WL_SECTOR,
        WL_VERSION,
        device_id,
        b"\x00" * 28,
    )
    state_crc = struct.pack("<I", _wl_crc(state_header))
    state_sector = (state_header + state_crc).ljust(wl_state_sectors * WL_SECTOR, b"\xff")

    config_data = struct.pack(
        "<8I",
        0,
        partition_size,
        WL_SECTOR,
        WL_SECTOR,
        WL_UPDATE_RATE,
        WL_WR_SIZE,
        WL_VERSION,
        WL_TEMP_BUFFER,
    )
    config_crc = struct.pack("<I", _wl_crc(config_data))
    config_sector = (config_data + config_crc + struct.pack("<III", 0, 0, 0)).ljust(
        WL_SECTOR, b"\xff"
    )

    image = b"\xff" * WL_SECTOR + plain + state_sector + state_sector + config_sector
    if len(image) != partition_size:
        raise RuntimeError(f"WL image size {len(image)} != partition {partition_size}")
    return image


def build_ffat_image(mkfatfs: Path, data_dir: Path, output: Path, partition_size: int) -> None:
    if not mkfatfs.exists():
        raise FileNotFoundError(f"mkfatfs not found: {mkfatfs}")
    if not data_dir.is_dir():
        raise FileNotFoundError(f"data dir missing: {data_dir}")

    plain_size = plain_fat_bytes(partition_size)
    plain_tmp = output.with_suffix(".plain.bin")
    cmd = [
        str(mkfatfs),
        "-c",
        str(data_dir),
        "-s",
        str(plain_size),
        str(plain_tmp),
    ]
    print("ffat plain:", " ".join(cmd))
    subprocess.run(cmd, check=True)

    plain = plain_tmp.read_bytes()
    plain_tmp.unlink(missing_ok=True)
    wrapped = wrap_wl(plain, partition_size)
    output.write_bytes(wrapped)
    print(f"ffat wl: {output} ({len(wrapped)} bytes)")
