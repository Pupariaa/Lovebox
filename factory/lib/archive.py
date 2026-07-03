import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from .config import ARCHIVES_DIR, REPO_ROOT
from .identity import record_provision


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def archive_provision(
    serial: str,
    identity: dict,
    version: str,
    port: str,
    artifacts: dict[str, Path],
    user_txt_content: str,
) -> Path:
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_dir = ARCHIVES_DIR / serial / ts
    out_dir.mkdir(parents=True, exist_ok=True)

    copied: dict[str, str] = {}
    for name, src in artifacts.items():
        if not src.exists():
            continue
        dst = out_dir / src.name
        shutil.copy2(src, dst)
        copied[name] = src.name

    (out_dir / "identity.json").write_text(json.dumps(identity, indent=2), encoding="utf-8")
    (out_dir / "user.txt").write_text(user_txt_content, encoding="utf-8")

    manifest = {
        "serial_number": serial,
        "device_name": identity.get("device_name"),
        "uuid": identity.get("uuid"),
        "firmware_version": version,
        "provisioned_at": ts,
        "port": port,
        "fqbn": "esp32:esp32:esp32s3:app3M_fat9M_16MB",
        "artifacts": copied,
        "sha256": {name: sha256_file(out_dir / fname) for name, fname in copied.items()},
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    record_provision(
        serial,
        {
            "provisioned_at": ts,
            "firmware_version": version,
            "archive_dir": str(out_dir.relative_to(REPO_ROOT)).replace("\\", "/"),
            "port": port,
            "manifest": str((out_dir / "manifest.json").name),
        },
    )
    return out_dir
