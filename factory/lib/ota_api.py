import json
import mimetypes
import os
import urllib.error
import urllib.request
from pathlib import Path


def _api_json(method: str, url: str, admin_key: str, body: dict | None = None) -> dict:
    data = None
    headers = {"X-Ota-Admin-Key": admin_key, "Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=120) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def _multipart(fields: dict[str, str], files: dict[str, Path]) -> tuple[bytes, str]:
    boundary = f"----BoiteFactory{os.getpid()}{id(fields)}"
    lines: list[bytes] = []

    for name, value in fields.items():
        lines.append(f"--{boundary}\r\n".encode())
        lines.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        lines.append(f"{value}\r\n".encode())

    for name, path in files.items():
        mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        lines.append(f"--{boundary}\r\n".encode())
        lines.append(
            f'Content-Disposition: form-data; name="{name}"; filename="{path.name}"\r\n'.encode()
        )
        lines.append(f"Content-Type: {mime}\r\n\r\n".encode())
        lines.append(path.read_bytes())
        lines.append(b"\r\n")

    lines.append(f"--{boundary}--\r\n".encode())
    body = b"".join(lines)
    content_type = f"multipart/form-data; boundary={boundary}"
    return body, content_type


def upload_release(
    base_url: str,
    admin_key: str,
    version: str,
    firmware_path: Path,
    assets_zip: Path | None = None,
    notes: str = "",
    channel: str = "stable",
    min_version: str = "",
) -> dict:
    base = base_url.rstrip("/")
    url = f"{base}/api/v1/updates/upload"
    fields = {"version": version, "channel": channel}
    if notes:
        fields["notes"] = notes
    if min_version:
        fields["min_version"] = min_version
    files = {"firmware": firmware_path}
    if assets_zip is not None:
        files["assets"] = assets_zip
    body, content_type = _multipart(fields, files)
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "X-Ota-Admin-Key": admin_key,
            "Accept": "application/json",
            "Content-Type": content_type,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {"error": raw}
        raise RuntimeError(f"HTTP {e.code}: {payload.get('error', raw)}") from e


def publish_release(base_url: str, admin_key: str, release_id: int, notify_fleet: bool = False) -> dict:
    base = base_url.rstrip("/")
    url = f"{base}/api/v1/updates/releases/{release_id}/publish"
    return _api_json("POST", url, admin_key, {"notify": notify_fleet})
