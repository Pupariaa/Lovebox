import json
import random
import re
from datetime import datetime, timezone
from pathlib import Path

from .config import DEVICES_DIR, REGISTRY

ALPHABET_DIGITS = "23456789"
ALPHABET_LETTER = "abcdefghjkmnpqrstuvwxyz"


def load_registry() -> dict:
    if REGISTRY.exists():
        return json.loads(REGISTRY.read_text(encoding="utf-8"))
    return {"boxes": [], "next_suffix": 2325}


def save_registry(data: dict) -> None:
    REGISTRY.write_text(json.dumps(data, indent=2), encoding="utf-8")


def semester() -> str:
    return "1" if datetime.now().month <= 6 else "2"


def build_identity(suffix: int) -> tuple[str, str]:
    letter = random.choice(ALPHABET_LETTER)
    device_name = f"BaCxs32{letter}{suffix:04d}"
    year = datetime.now().year
    serial = f"{device_name.upper()}{year:04d}R{semester()}"
    return device_name, serial


def generate_uuid() -> str:
    return "".join(str(random.randint(0, 9)) for _ in range(128))


def user_txt_content(device_name: str, serial: str, uuid: str) -> str:
    year = datetime.now().year
    return (
        f"device_name: {device_name}\n"
        f"factory_device_name: {device_name}\n"
        f"display_name: {device_name}\n"
        f"serial_number: {serial}\n"
        f"ssid:\n"
        f"psw:\n"
        f"configured: 0\n"
        f"uuid: {uuid}\n"
        f"locale: fr\n"
        f"build_year: {year}\n"
        f"build_semester: {semester()}\n"
        f"hw_revision: BaC-S3-v1\n"
        f"api_url: https://boite-a-coeur.techalchemy.fr\n"
        f"api_secret:\n"
        f"region:\n"
        f"old_boot_status:\n"
    )


def write_device_file(serial: str, content: str) -> Path:
    DEVICES_DIR.mkdir(parents=True, exist_ok=True)
    path = DEVICES_DIR / f"{serial}.user.txt"
    path.write_text(content, encoding="utf-8")
    return path


def load_device_file(serial: str) -> dict:
    path = DEVICES_DIR / f"{serial}.user.txt"
    if not path.exists():
        raise FileNotFoundError(f"device file not found: {path}")
    identity = parse_user_txt(path.read_text(encoding="utf-8"))
    identity["serial_number"] = identity.get("serial_number") or serial
    return identity


def merge_runtime_config(base: dict, runtime: dict) -> dict:
    merged = dict(base)
    for key in (
        "ssid",
        "psw",
        "api_secret",
        "api_url",
        "region",
        "locale",
        "display_name",
        "configured",
        "claimed",
    ):
        val = runtime.get(key)
        if val is not None and str(val).strip() != "":
            merged[key] = str(val).strip()
    return merged


def parse_user_txt(text: str) -> dict:
    out: dict = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or ":" not in line:
            continue
        key, val = line.split(":", 1)
        out[key.strip()] = val.strip()
    return out


def create_new_identity(suffix: int | None = None) -> dict:
    data = load_registry()
    use_suffix = suffix if suffix is not None else int(data.get("next_suffix", 2325))
    device_name, serial = build_identity(use_suffix)
    if any(b.get("serial_number") == serial for b in data["boxes"]):
        raise SystemExit(f"serial already in registry: {serial}")
    uuid = generate_uuid()
    content = user_txt_content(device_name, serial, uuid)
    device_path = write_device_file(serial, content)
    entry = {
        "device_name": device_name,
        "serial_number": serial,
        "uuid": uuid,
        "built_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "batch": datetime.now().strftime("%Y-%m"),
        "device_file": f"factory/devices/{serial}.user.txt",
    }
    data["boxes"].append(entry)
    data["next_suffix"] = use_suffix + 1
    save_registry(data)
    return entry


def find_registry_entry(serial: str) -> dict | None:
    data = load_registry()
    for box in data["boxes"]:
        if box.get("serial_number", "").upper() == serial.upper():
            return box
    return None


def record_provision(serial: str, record: dict) -> None:
    data = load_registry()
    for box in data["boxes"]:
        if box.get("serial_number", "").upper() == serial.upper():
            history = box.setdefault("provision_history", [])
            history.append(record)
            box["last_firmware_version"] = record.get("firmware_version")
            box["last_provisioned_at"] = record.get("provisioned_at")
            save_registry(data)
            return
    save_registry(data)
