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
    flash_firmware_only,
    normalize_version,
    read_version,
    resolve_boot_app0,
    resolve_build_artifact,
)
from lib.config import BUILD_DIR, DEVICES_DIR
from lib.identity import (
    create_new_identity,
    ensure_registry_entry,
    factory_reset_fields,
    load_device_file,
    load_registry,
    merge_runtime_config,
    parse_user_txt,
    save_identity_fields,
    update_registry_uuid,
    user_txt_content,
)
from lib.ports import choose_port, list_serial_ports

MODES = {
    "update": "Firmware only (NVS + FFAT preserved, WiFi/claim kept)",
    "reset-same-ids": "Full flash, same serial + uuid, factory defaults in NVS",
    "reset-new-ids": "Full flash, same serial, new uuid, factory defaults in NVS",
}


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


def apply_runtime_config(identity_fields: dict, runtime_path: Path) -> dict:
    runtime = parse_user_txt(runtime_path.read_text(encoding="utf-8"))
    merged = merge_runtime_config(identity_fields, runtime)
    print(f"runtime config merged from {runtime_path}")
    return merged


def resolve_mode(args) -> str | None:
    if args.mode:
        return args.mode
    if args.firmware_only:
        return "update"
    return None


def prompt_mode() -> str:
    print("Provisioning mode:")
    for idx, (key, label) in enumerate(MODES.items(), start=1):
        print(f"  {idx}. {key} — {label}")
    choice = input("Choice [1]: ").strip() or "1"
    keys = list(MODES.keys())
    if choice.isdigit() and 1 <= int(choice) <= len(keys):
        return keys[int(choice) - 1]
    if choice in MODES:
        return choice
    raise SystemExit(f"invalid mode: {choice}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Provision BoiteACoeur (build + flash + archive)")
    parser.add_argument("--new", action="store_true", help="Generate new device identity")
    parser.add_argument("--serial", help="Re-provision existing device by serial number")
    parser.add_argument("--suffix", type=int, help="Fixed suffix for --new")
    parser.add_argument("--port", help="Serial port (interactive if omitted)")
    parser.add_argument("--version", help="Firmware version (default: factory/VERSION)")
    parser.add_argument("--build-only", action="store_true", help="Build and archive without flashing")
    parser.add_argument("--skip-flash", action="store_true", help="Build + archive only")
    parser.add_argument(
        "--mode",
        choices=list(MODES.keys()),
        help="update | reset-same-ids | reset-new-ids (existing device)",
    )
    parser.add_argument(
        "--firmware-only",
        action="store_true",
        help=argparse.SUPPRESS,
    )
    parser.add_argument(
        "--runtime-config",
        metavar="FILE",
        help="Merge WiFi/claim/secrets from exported user.txt before full flash",
    )
    parser.add_argument("--list-ports", action="store_true", help="List serial ports and exit")
    parser.add_argument("--list-devices", action="store_true", help="List registry devices")
    parser.add_argument("--list-modes", action="store_true", help="List provisioning modes")
    args = parser.parse_args()

    if args.list_modes:
        for key, label in MODES.items():
            print(f"{key}: {label}")
        return

    mode = resolve_mode(args)
    if mode == "update" and args.runtime_config:
        raise SystemExit("--runtime-config is not compatible with --mode update")
    if mode in ("reset-same-ids", "reset-new-ids") and args.runtime_config:
        raise SystemExit("use --runtime-config only for manual full reflash without --mode reset-*")

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
            if mode is None:
                mode = prompt_mode()
        else:
            args.new = True

    if args.serial and mode is None and not args.new:
        mode = prompt_mode()

    identity, user_txt = resolve_identity(args)
    serial = identity["serial_number"]
    try:
        version = normalize_version(args.version) if args.version else read_version()
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc
    print(f"device: {serial}")
    print(f"firmware: {version}")
    if mode:
        print(f"mode: {mode} — {MODES[mode]}")

    compile_sketch(version)
    firmware = resolve_build_artifact("boite-a-coeur.ino.bin")

    if mode == "update":
        port = choose_port(args.port) if not args.build_only and not args.skip_flash else (args.port or "N/A")
        artifacts = {"firmware": firmware}
        archive_dir = archive_provision(serial, identity, version, port, artifacts, user_txt, mode="update")
        print(f"archive: {archive_dir}")
        if args.build_only or args.skip_flash:
            print("build complete (no flash)")
            return
        flash_firmware_only(port, firmware)
        print("update complete (NVS/FFAT preserved)")
        print(json.dumps({"serial_number": serial, "firmware_version": version, "mode": mode, "archive": str(archive_dir)}, indent=2))
        return

    ffat_bin = BUILD_DIR / "ffat.bin"
    build_ffat_image(ffat_bin)

    identity_fields = parse_user_txt(user_txt)
    identity_fields.setdefault("serial_number", serial)

    if mode == "reset-same-ids":
        identity_fields = factory_reset_fields(identity_fields, new_uuid=False)
        save_identity_fields(serial, identity_fields)
        user_txt = (DEVICES_DIR / f"{serial}.user.txt").read_text(encoding="utf-8")
        identity["uuid"] = identity_fields["uuid"]
        ensure_registry_entry(serial, identity_fields)
    elif mode == "reset-new-ids":
        identity_fields = factory_reset_fields(identity_fields, new_uuid=True)
        save_identity_fields(serial, identity_fields)
        user_txt = (DEVICES_DIR / f"{serial}.user.txt").read_text(encoding="utf-8")
        identity["uuid"] = identity_fields["uuid"]
        update_registry_uuid(serial, identity_fields["uuid"])
        ensure_registry_entry(serial, identity_fields)
        print(f"new uuid: {identity_fields['uuid']}")
    elif args.runtime_config:
        runtime_path = Path(args.runtime_config)
        if not runtime_path.is_file():
            raise SystemExit(f"runtime config not found: {runtime_path}")
        identity_fields = apply_runtime_config(identity_fields, runtime_path)
        save_identity_fields(serial, identity_fields)
        user_txt = (DEVICES_DIR / f"{serial}.user.txt").read_text(encoding="utf-8")

    nvs_bin = BUILD_DIR / "nvs.bin"
    build_nvs_image(identity_fields, nvs_bin)

    artifacts = {
        "bootloader": resolve_build_artifact("boite-a-coeur.ino.bootloader.bin"),
        "partitions": resolve_build_artifact("boite-a-coeur.ino.partitions.bin"),
        "boot_app0": resolve_boot_app0(),
        "firmware": firmware,
        "nvs": nvs_bin,
        "ffat": ffat_bin,
    }

    port = choose_port(args.port) if not args.build_only and not args.skip_flash else (args.port or "N/A")
    archive_dir = archive_provision(
        serial, identity, version, port, artifacts, user_txt, mode=mode or "full"
    )
    print(f"archive: {archive_dir}")

    if args.build_only or args.skip_flash:
        print("build complete (no flash)")
        return

    flash_all(port, artifacts)
    print("provision complete")
    print(json.dumps({"serial_number": serial, "firmware_version": version, "mode": mode or "full", "archive": str(archive_dir)}, indent=2))


if __name__ == "__main__":
    main()
