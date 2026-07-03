import csv
import subprocess
import sys
import tempfile
from pathlib import Path

from .config import NVS_SIZE

NVS_KEYS = {
    "nvs_init": ("u8", "1"),
    "device_name": ("string", ""),
    "display_name": ("string", ""),
    "serial_number": ("string", ""),
    "uuid": ("string", ""),
    "locale": ("string", "fr"),
    "build_year": ("string", ""),
    "build_semester": ("string", ""),
    "hw_revision": ("string", ""),
    "api_url": ("string", "https://boite-a-coeur.techalchemy.fr"),
    "configured": ("u8", "0"),
    "claimed": ("u8", "0"),
    "ssid": ("string", ""),
    "psw": ("string", ""),
    "api_secret": ("string", ""),
    "region": ("string", ""),
}


def _identity_rows(identity: dict) -> list[tuple[str, str, str]]:
    device_name = identity.get("device_name") or identity.get("display_name") or ""
    display_name = identity.get("display_name") or device_name
    rows: list[tuple[str, str, str]] = []
    values = {
        "nvs_init": "1",
        "device_name": device_name,
        "display_name": display_name,
        "serial_number": identity.get("serial_number", ""),
        "uuid": identity.get("uuid", ""),
        "locale": identity.get("locale", "fr"),
        "build_year": identity.get("build_year", ""),
        "build_semester": identity.get("build_semester", ""),
        "hw_revision": identity.get("hw_revision", ""),
        "api_url": identity.get("api_url", "https://boite-a-coeur.techalchemy.fr"),
        "configured": str(identity.get("configured", "0")),
        "claimed": str(identity.get("claimed", "0")),
        "ssid": identity.get("ssid", ""),
        "psw": identity.get("psw", ""),
        "api_secret": identity.get("api_secret", ""),
        "region": identity.get("region", ""),
    }
    for key, (encoding, default) in NVS_KEYS.items():
        if len(key) > 15:
            continue
        val = values.get(key, default)
        if val == "" and encoding != "string":
            val = default
        rows.append((key, encoding, val))
    return rows


def build_nvs_image(identity: dict, output: Path) -> Path:
    if not identity.get("serial_number"):
        raise ValueError("serial_number required for NVS image")
    if not identity.get("uuid"):
        raise ValueError("uuid required for NVS image")
    rows = _identity_rows(identity)
    with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False, encoding="utf-8", newline="") as tmp:
        csv_path = Path(tmp.name)
        writer = csv.writer(tmp)
        writer.writerow(["key", "type", "encoding", "value"])
        writer.writerow(["bac", "namespace", "", ""])
        for key, encoding, value in rows:
            writer.writerow([key, "data", encoding, value])
    try:
        cmd = [
            sys.executable,
            "-m",
            "esp_idf_nvs_partition_gen",
            "generate",
            str(csv_path),
            str(output),
            hex(NVS_SIZE),
        ]
        print("nvs:", " ".join(cmd))
        subprocess.run(cmd, check=True)
    finally:
        csv_path.unlink(missing_ok=True)
    return output
