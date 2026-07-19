#!/usr/bin/env python3
import argparse
import json
import os
import shutil
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from lib.build import (
    build_ffat_image,
    compile_sketch,
    normalize_version,
    read_version,
    resolve_build_artifact,
)
from lib.config import ASSETS_DIR, BUILD_DIR, RELEASES_DIR, VERSION_FILE
from lib.ota_api import publish_release, upload_release


def zip_assets(output: Path) -> Path:
    if not ASSETS_DIR.exists():
        raise SystemExit(f"assets directory missing: {ASSETS_DIR}")
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(ASSETS_DIR.rglob("*")):
            if path.is_file():
                zf.write(path, path.relative_to(ASSETS_DIR).as_posix())
    return output


def archive_release(version: str, firmware: Path, ffat: Path | None, assets_zip: Path | None) -> Path:
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_dir = RELEASES_DIR / version / ts
    out_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(firmware, out_dir / "firmware.bin")
    if ffat is not None and ffat.exists():
        shutil.copy2(ffat, out_dir / "ffat.bin")
    if assets_zip is not None and assets_zip.exists():
        shutil.copy2(assets_zip, out_dir / "assets.zip")
    manifest = {
        "version": version,
        "built_at": ts,
        "firmware": "firmware.bin",
        "ffat": "ffat.bin" if ffat is not None else None,
        "assets_zip": "assets.zip" if assets_zip is not None else None,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return out_dir


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build OTA release (no device serial) and optionally upload to server"
    )
    parser.add_argument("--version", help="Release version (default: factory/VERSION)")
    parser.add_argument("--set-version", action="store_true", help="Write factory/VERSION before build")
    parser.add_argument("--with-assets", action="store_true", help="Build FFAT and zip assets for OTA upload")
    parser.add_argument("--upload", action="store_true", help="Upload firmware (+ assets) to OTA server")
    parser.add_argument(
        "--publish",
        action="store_true",
        help="Mark release published on server (no fleet notify; use ota_device.py per device)",
    )
    parser.add_argument("--notes", default="", help="Release notes for server")
    parser.add_argument("--channel", default="stable", help="Release channel")
    parser.add_argument("--min-version", default="", help="Minimum device firmware version")
    parser.add_argument("--base-url", default=os.environ.get("BAC_API_URL", "https://boite-a-coeur.fr"))
    parser.add_argument("--admin-key", default=os.environ.get("OTA_ADMIN_KEY", ""))
    args = parser.parse_args()

    try:
        version = normalize_version(args.version) if args.version else read_version()
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc

    if args.set_version or (args.version and not VERSION_FILE.exists()):
        VERSION_FILE.write_text(version + "\n", encoding="utf-8")
        print(f"factory/VERSION = {version}")

    print(f"release build: {version}")
    compile_sketch(version)
    firmware = resolve_build_artifact("boite-a-coeur.ino.bin")

    ffat_bin: Path | None = None
    assets_zip: Path | None = None
    if args.with_assets:
        ffat_bin = BUILD_DIR / "ffat.bin"
        build_ffat_image(ffat_bin)
        assets_zip = BUILD_DIR / "assets_upload.zip"
        zip_assets(assets_zip)
        print(f"assets zip: {assets_zip}")

    archive_dir = archive_release(version, firmware, ffat_bin, assets_zip)
    print(f"local archive: {archive_dir}")
    print(f"firmware: {firmware}")

    if not args.upload:
        print("build complete (local only)")
        print("next: python factory\\release.py --version", version, "--upload --publish")
        print("then:  python factory\\ota_device.py --serial SERIAL --release-id ID --force")
        return

    if not args.admin_key:
        args.admin_key = input("OTA admin key: ").strip()
    if not args.admin_key:
        raise SystemExit("admin key required (OTA_ADMIN_KEY)")

    upload_zip = assets_zip if args.with_assets and assets_zip else None
    result = upload_release(
        args.base_url,
        args.admin_key,
        version,
        firmware,
        upload_zip,
        notes=args.notes,
        channel=args.channel,
        min_version=args.min_version,
    )
    release = result.get("release") or {}
    release_id = release.get("id")
    print(json.dumps(result, indent=2))

    if args.publish:
        if not release_id:
            raise SystemExit("upload ok but release id missing")
        pub = publish_release(args.base_url, args.admin_key, int(release_id), notify_fleet=False)
        print(json.dumps(pub, indent=2))
        print(f"published release {release_id} (no fleet notify)")
        print(f"trigger OTA: python factory\\ota_device.py --serial SERIAL --release-id {release_id} --force")
    else:
        print(f"draft on server (id={release_id}). Publish with --publish or admin UI.")


if __name__ == "__main__":
    main()
