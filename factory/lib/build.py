import re
import shutil
import subprocess
from pathlib import Path

from .config import (
    BOOT_APP0,
    BUILD_DIR,
    DATA_DIR,
    ESPTOOL,
    FFAT_SIZE,
    FQBN,
    FW_HEADER,
    LUCARNE_CANDIDATES,
    MKFATFS,
    NVS_OFFSET,
    NVS_SIZE,
    SKETCH,
    VERSION_FILE,
)
from .ffat import build_ffat_image as build_wl_ffat_image
from .nvs_image import build_nvs_image


def read_version() -> str:
    if VERSION_FILE.exists():
        v = normalize_version(VERSION_FILE.read_text(encoding="utf-8"))
        return v
    return "1.0.0"


def normalize_version(raw: str) -> str:
    version = raw.strip().rstrip("\\").strip()
    if not re.fullmatch(r"\d+\.\d+\.\d+(?:[-+.\w]*)?", version):
        raise ValueError(f"invalid firmware version: {raw!r}")
    return version


def patch_firmware_version(version: str) -> str:
    version = normalize_version(version)
    original = FW_HEADER.read_text(encoding="utf-8")
    match = re.search(r'^#define BAC_FW_VERSION "([^"]*)"$', original, re.MULTILINE)
    if match and match.group(1) == version:
        return original
    if not re.search(r"^#define BAC_FW_VERSION ", original, re.MULTILINE):
        raise RuntimeError(f"BAC_FW_VERSION define not found in {FW_HEADER}")
    new_line = f'#define BAC_FW_VERSION "{version}"'
    updated = re.sub(
        r"^#define BAC_FW_VERSION .*$",
        new_line,
        original,
        count=1,
        flags=re.MULTILINE,
    )
    FW_HEADER.write_text(updated, encoding="utf-8")
    return original


def restore_firmware_version(original: str) -> None:
    FW_HEADER.write_text(original, encoding="utf-8")


def find_arduino_cli() -> Path:
    for name in ("arduino-cli", "arduino-cli.exe"):
        found = shutil.which(name)
        if found:
            return Path(found)
    for candidate in (
        Path(r"C:\Program Files\Arduino CLI\arduino-cli.exe"),
        Path.home() / "bin" / "arduino-cli.exe",
    ):
        if candidate.exists():
            return candidate
    raise FileNotFoundError("arduino-cli not found in PATH")


def find_lucarne() -> Path | None:
    for candidate in LUCARNE_CANDIDATES:
        if (candidate / "Lucarne.h").exists() or (candidate / "src" / "Lucarne.h").exists():
            return candidate
    return None


def compile_sketch(version: str) -> None:
    cli = find_arduino_cli()
    original = patch_firmware_version(version)
    try:
        cmd = [
            str(cli),
            "compile",
            "--fqbn",
            FQBN,
            "--build-path",
            str(BUILD_DIR),
            str(SKETCH),
        ]
        lucarne = find_lucarne()
        if lucarne:
            cmd.extend(["--library", str(lucarne)])
        print("compile:", " ".join(cmd))
        last_output = ""
        for attempt in range(2):
            result = subprocess.run(cmd, capture_output=True, text=True)
            output = (result.stdout or "") + (result.stderr or "")
            if output.strip():
                print(output.rstrip())
            if result.returncode == 0:
                return
            last_output = output
            if attempt == 0 and "reinitialized" in output.lower():
                print("arduino-cli instance stale, retrying compile...")
                continue
            break
        hint = ""
        if "reinitialized" in last_output.lower():
            hint = (
                "\nClose Arduino IDE and any serial monitor, then retry. "
                "If it persists: arduino-cli core update-index"
            )
        raise RuntimeError(
            f"arduino-cli compile failed (exit {result.returncode}){hint}\n{last_output.rstrip()}"
        )
    finally:
        restore_firmware_version(original)


def resolve_build_artifact(name: str) -> Path:
    path = BUILD_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"build artifact missing: {path}")
    return path


def resolve_boot_app0() -> Path:
    if BOOT_APP0.exists():
        return BOOT_APP0
    raise FileNotFoundError(f"boot_app0.bin not found: {BOOT_APP0}")


def stage_user_txt(content: str) -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / "user.txt"
    path.write_text(content, encoding="utf-8")
    return path


def cleanup_user_txt() -> None:
    path = DATA_DIR / "user.txt"
    if path.exists():
        path.unlink()


def build_ffat_image(output: Path) -> None:
    build_wl_ffat_image(MKFATFS, DATA_DIR, output, FFAT_SIZE)


def find_esptool() -> Path:
    if ESPTOOL.exists():
        return ESPTOOL
    found = shutil.which("esptool") or shutil.which("esptool.exe")
    if found:
        return Path(found)
    raise FileNotFoundError("esptool not found")


def read_flash_params() -> dict[str, str]:
    flash_args = BUILD_DIR / "flash_args"
    params = {"mode": "dio", "freq": "80m", "size": "16MB"}
    if not flash_args.exists():
        return params
    header = flash_args.read_text(encoding="utf-8").splitlines()[0]
    for key, pattern in (
        ("mode", r"--flash-mode\s+(\S+)"),
        ("freq", r"--flash-freq\s+(\S+)"),
        ("size", r"--flash-size\s+(\S+)"),
    ):
        match = re.search(pattern, header)
        if match:
            params[key] = match.group(1)
    return params


def flash_all(port: str, artifacts: dict[str, Path]) -> None:
    esptool = find_esptool()
    flash = read_flash_params()
    common = [
        str(esptool),
        "--chip",
        "esp32s3",
        "--port",
        port,
        "--baud",
        "921600",
        "--before",
        "default-reset",
        "--after",
        "hard-reset",
    ]
    args = common + [
        "write-flash",
        "-z",
        "--flash-mode",
        flash["mode"],
        "--flash-freq",
        flash["freq"],
        "--flash-size",
        flash["size"],
    ]
    order = ["bootloader", "partitions", "boot_app0", "firmware", "nvs", "ffat"]
    for key in order:
        if key not in artifacts:
            continue
        offset, _ = {
            "bootloader": (0x0, ""),
            "partitions": (0x8000, ""),
            "boot_app0": (0xE000, ""),
            "firmware": (0x10000, ""),
            "nvs": (NVS_OFFSET, ""),
            "ffat": (0x610000, ""),
        }[key]
        args.extend([hex(offset), str(artifacts[key])])
    print("flash:", " ".join(args))
    subprocess.run(args, check=True)
