import socket
import json
import os
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from ble_manager import BleManager

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
LOVEBOX_ROOT = ROOT.parent.parent.parent
_default_editor = LOVEBOX_ROOT.parent / "Lucarne" / "editor"
LUCARNE_EDITOR = Path(os.environ.get("LUCARNE_EDITOR", str(_default_editor))).resolve()

app = Flask(__name__, static_folder=str(STATIC), static_url_path="")
ble = BleManager()


@app.get("/")
def index():
    return send_from_directory(STATIC, "index.html")


@app.get("/lucarne/<path:subpath>")
def lucarne_assets(subpath):
    if not LUCARNE_EDITOR.is_dir():
        return jsonify({"error": "Lucarne editor not found"}), 404
    return send_from_directory(LUCARNE_EDITOR, subpath)


@app.get("/api/status")
def status():
    return jsonify(ble.get_status())


@app.post("/api/scan")
def scan():
    body = request.get_json(silent=True) or {}
    timeout = float(body.get("timeout", 12))
    timeout = max(5.0, min(timeout, 30.0))
    show_all = bool(body.get("show_all", False))
    try:
        devices = ble.scan(timeout, show_all=show_all)
        return jsonify({"ok": True, "devices": devices})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.post("/api/connect")
def connect():
    body = request.get_json(silent=True) or {}
    address = (body.get("address") or "").strip()
    if not address:
        return jsonify({"ok": False, "error": "address required"}), 400
    try:
        ble.connect(address)
        return jsonify({"ok": True})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.post("/api/disconnect")
def disconnect():
    try:
        ble.disconnect()
        return jsonify({"ok": True})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.post("/api/provision")
def provision():
    body = request.get_json(silent=True) or {}
    ssid = body.get("ssid", "")
    password = body.get("password", "")
    fmt = body.get("format", "pipe")
    if fmt not in ("pipe", "newline"):
        fmt = "pipe"
    try:
        ble.provision(ssid, password, fmt)
        return jsonify({"ok": True})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


def _local_subnet():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        parts = ip.split(".")
        if len(parts) == 4:
            return ".".join(parts[:3])
    except OSError:
        pass
    return "192.168.1"


def _probe_box(ip, timeout=0.35):
    url = f"http://{ip}:8080/info"
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            data["ip"] = ip
            return data
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, OSError):
        return None


@app.get("/api/discover")
def discover():
    subnet = _local_subnet()
    ips = [f"{subnet}.{i}" for i in range(1, 255)]
    found = []
    with ThreadPoolExecutor(max_workers=48) as pool:
        futures = {pool.submit(_probe_box, ip): ip for ip in ips}
        for fut in as_completed(futures):
            row = fut.result()
            if row:
                found.append(row)
    found.sort(key=lambda x: x.get("name") or x.get("ip") or "")
    return jsonify({"ok": True, "devices": found, "subnet": subnet})


@app.post("/api/send-message")
def send_message():
    ip = (request.args.get("ip") or request.headers.get("X-Box-Ip") or "").strip()
    if not ip:
        body = request.get_json(silent=True) or {}
        ip = (body.get("ip") or "").strip()
    if not ip:
        return jsonify({"ok": False, "error": "ip required"}), 400
    raw = request.get_data()
    if not raw:
        return jsonify({"ok": False, "error": "empty body"}), 400
    boundary = "BacMsgBoundary"
    prefix = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="message"; filename="message.bacm"\r\n'
        f"Content-Type: application/octet-stream\r\n\r\n"
    ).encode("utf-8")
    suffix = f"\r\n--{boundary}--\r\n".encode("utf-8")
    payload = prefix + raw + suffix
    url = f"http://{ip}:8080/message"
    try:
        req = urllib.request.Request(
            url,
            data=payload,
            method="POST",
            headers={
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "Content-Length": str(len(payload)),
            },
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            out = resp.read().decode("utf-8", errors="replace")
            return jsonify({"ok": True, "response": out, "bytes": len(raw)})
    except urllib.error.HTTPError as exc:
        err = exc.read().decode("utf-8", errors="replace")
        return jsonify({"ok": False, "error": err or str(exc)}), exc.code
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8765, debug=False, threaded=True)
