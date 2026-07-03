#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from lib.archive import archive_provision
from lib.build import (
    build_ffat_image,
    build_nvs_image,
    compile_sketch,
    flash_all,
    normalize_version,
    read_version,
    resolve_boot_app0,
    resolve_build_artifact,
)
from lib.identity import parse_user_txt
from lib.config import BUILD_DIR, DEVICES_DIR
from lib.identity import (
    create_new_identity,
    load_device_file,
    load_registry,
    user_txt_content,
)
from lib.ports import choose_port, list_serial_ports


def resolve_identity(args) -> tuple[dict, str]:
    if args.new:
        entry = create_new_identity(args.suffix)
        identity = {
            "device_name": entry["device_name"],
            "serial_number": entry["serial_number"],
            "uuid": entry["uuid"],
        }
        content = user_txt_content(identity["device_name"], identity["serial_number"], identity["uuid"])
        return identity, content
    if not args.serial:
        raise SystemExit("use --new or --serial SERIAL")
    identity = load_device_file(args.serial)
    if not identity.get("uuid"):
        raise SystemExit(f"uuid missing in device file for {args.serial}")
    content = (DEVICES_DIR / f"{args.serial}.user.txt").read_text(encoding="utf-8")
    return identity, content


def main() -> None:
    parser = argparse.ArgumentParser(description="Provision BoiteACoeur (build + flash + archive)")
    parser.add_argument("--new", action="store_true", help="Generate new device identity")
    parser.add_argument("--serial", help="Re-provision existing device by serial number")
    parser.add_argument("--suffix", type=int, help="Fixed suffix for --new")
    parser.add_argument("--port", help="Serial port (interactive if omitted)")
    parser.add_argument("--version", help="Firmware version (default: factory/VERSION)")
    parser.add_argument("--build-only", action="store_true", help="Build and archive without flashing")
    parser.add_argument("--skip-flash", action="store_true", help="Build + archive only")
    parser.add_argument("--list-ports", action="store_true", help="List serial ports and exit")
    parser.add_argument("--list-devices", action="store_true", help="List registry devices")
    args = parser.parse_args()

    if args.list_ports:
        for port in list_serial_ports():
            print(port)
        return

    if args.list_devices:
        data = load_registry()
        for box in data.get("boxes", []):
            last = box.get("last_firmware_version", "-")
            print(f"{box.get('serial_number')}  fw={last}  {box.get('device_name')}")
        return

    if not args.new and not args.serial:
        print("1. New device")
        print("2. Re-flash existing serial")
        choice = input("Choice [1]: ").strip() or "1"
        if choice == "2":
            args.serial = input("Serial number: ").strip()
            if not args.serial:
                raise SystemExit("serial required")
        else:
            args.new = True

    identity, user_txt = resolve_identity(args)
    serial = identity["serial_number"]
    try:
        version = normalize_version(args.version) if args.version else read_version()
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc
    print(f"device: {serial}")
    print(f"firmware: {version}")

    compile_sketch(version)

    ffat_bin = BUILD_DIR / "ffat.bin"
    build_ffat_image(ffat_bin)

    identity_fields = parse_user_txt(user_txt)
    identity_fields.setdefault("serial_number", serial)
    nvs_bin = BUILD_DIR / "nvs.bin"
    build_nvs_image(identity_fields, nvs_bin)

    artifacts = {
        "bootloader": resolve_build_artifact("boite-a-coeur.ino.bootloader.bin"),
        "partitions": resolve_build_artifact("boite-a-coeur.ino.partitions.bin"),
        "boot_app0": resolve_boot_app0(),
        "firmware": resolve_build_artifact("boite-a-coeur.ino.bin"),
        "nvs": nvs_bin,
        "ffat": ffat_bin,
    }

    port = choose_port(args.port) if not args.build_only and not args.skip_flash else (args.port or "N/A")
    archive_dir = archive_provision(serial, identity, version, port, artifacts, user_txt)
    print(f"archive: {archive_dir}")

    if args.build_only or args.skip_flash:
        print("build complete (no flash)")
        return

    flash_all(port, artifacts)
    print("provision complete")
    print(json.dumps({"serial_number": serial, "firmware_version": version, "archive": str(archive_dir)}, indent=2))


if __name__ == "__main__":
    main()
