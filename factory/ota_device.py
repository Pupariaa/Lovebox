#!/usr/bin/env python3
import argparse
import json
import os
import sys
import urllib.error
import urllib.request


def api_request(method: str, url: str, admin_key: str, body: dict | None = None) -> dict:
    data = None
    headers = {"X-Ota-Admin-Key": admin_key, "Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {"error": raw}
        raise SystemExit(f"HTTP {e.code}: {payload.get('error', raw)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Enqueue OTA for one device (admin API)")
    parser.add_argument("--base-url", default=os.environ.get("BAC_API_URL", "https://boite-a-coeur.techalchemy.fr"))
    parser.add_argument("--admin-key", default=os.environ.get("OTA_ADMIN_KEY", ""))
    parser.add_argument("--serial", help="Device serial number")
    parser.add_argument("--uuid", help="Device uuid")
    parser.add_argument("--device-id", type=int, help="Device database id")
    parser.add_argument("--release-id", type=int, help="Firmware release id (default: active published)")
    parser.add_argument("--force", action="store_true", help="Cancel open OTA and ignore version check")
    parser.add_argument("--lookup", action="store_true", help="Lookup only")
    args = parser.parse_args()

    if not args.admin_key:
        args.admin_key = input("OTA admin key: ").strip()
    if not args.admin_key:
        raise SystemExit("admin key required")

    base = args.base_url.rstrip("/")
    api = base + "/api/v1"

    ident = {}
    if args.serial:
        ident["serial_number"] = args.serial
    if args.uuid:
        ident["uuid"] = args.uuid
    if args.device_id:
        ident["device_id"] = args.device_id
    if not ident:
        raise SystemExit("provide --serial, --uuid, or --device-id")

    q = "&".join(f"{k}={urllib.request.quote(str(v))}" for k, v in ident.items())
    lookup = api_request("GET", f"{api}/updates/devices/lookup?{q}", args.admin_key)
    print(json.dumps(lookup, indent=2))
    if args.lookup:
        return

    body = dict(ident)
    if args.release_id:
        body["release_id"] = args.release_id
    if args.force:
        body["force"] = True

    result = api_request("POST", f"{api}/updates/devices/notify", args.admin_key, body)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
