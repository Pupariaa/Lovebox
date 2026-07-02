import asyncio
import platform
import threading
import time
from typing import Any

from bleak import BleakClient, BleakScanner
from bleak.exc import BleakDeviceNotFoundError, BleakError

SERVICE_UUID = "bac1c201-1fb5-459e-8fcc-c5c9c331914b"
CHAR_UUID = "bac1c202-36e1-4688-b7f5-ea07361b26a8"
NAME_HINTS = ("bac", "boite", "coeur", "boiteacoeur")


class BleManager:
    def __init__(self) -> None:
        self._loop = asyncio.new_event_loop()
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        self._client: BleakClient | None = None
        self._connected_address: str | None = None
        self._connected_name: str | None = None
        self._logs: list[dict[str, Any]] = []
        self._devices: list[dict[str, Any]] = []
        self._lock = threading.Lock()

    def _run_loop(self) -> None:
        asyncio.set_event_loop(self._loop)
        self._loop.run_forever()

    def _log(self, level: str, message: str) -> None:
        entry = {"ts": time.time(), "level": level, "message": message}
        with self._lock:
            self._logs.append(entry)
            if len(self._logs) > 200:
                self._logs = self._logs[-200:]

    def run(self, coro, timeout: float = 90.0):
        future = asyncio.run_coroutine_threadsafe(coro, self._loop)
        return future.result(timeout=timeout)

    def get_status(self) -> dict[str, Any]:
        with self._lock:
            connected = self._client is not None and self._client.is_connected
            return {
                "connected": connected,
                "address": self._connected_address,
                "name": self._connected_name,
                "service_uuid": SERVICE_UUID,
                "char_uuid": CHAR_UUID,
                "devices": list(self._devices),
                "logs": list(self._logs),
            }

    @staticmethod
    def _device_matches(name: str, uuids: list[str], show_all: bool) -> bool:
        if show_all:
            return True
        svc = SERVICE_UUID.lower()
        norm_uuids = [u.lower() for u in uuids if u]
        if svc in norm_uuids:
            return True
        low = (name or "").lower()
        if not low:
            return False
        return any(h in low for h in NAME_HINTS)

    @staticmethod
    def _merge_device(
        found: dict[str, dict[str, Any]],
        address: str,
        name: str | None,
        rssi: int | None,
        uuids: list[str] | None,
    ) -> None:
        entry = found.get(address)
        clean_name = (name or "").strip()
        clean_uuids = list(uuids or [])
        if entry:
            if clean_name and (not entry.get("name") or entry["name"] == address):
                entry["name"] = clean_name
            if rssi is not None:
                entry["rssi"] = rssi
            prev = entry.get("service_uuids") or []
            for u in clean_uuids:
                if u and u not in prev:
                    prev.append(u)
            entry["service_uuids"] = prev
            return
        found[address] = {
            "address": address,
            "name": clean_name or address,
            "rssi": rssi,
            "service_uuids": clean_uuids,
        }

    async def _scan(self, timeout: float, show_all: bool) -> list[dict[str, Any]]:
        self._log("info", f"Scan started ({timeout:.0f}s)")
        found: dict[str, dict[str, Any]] = {}
        svc_lower = SERVICE_UUID.lower()

        def on_detect(device, adv) -> None:
            uuids = list(adv.service_uuids or [])
            name = adv.local_name or device.name or ""
            self._merge_device(found, device.address, name, adv.rssi, uuids)

        scanner = BleakScanner(detection_callback=on_detect)
        await scanner.start()
        await asyncio.sleep(timeout)
        await scanner.stop()

        try:
            discovered = await BleakScanner.discover(timeout=2.0, return_adv=True)
            for address, (_device, adv) in discovered.items():
                uuids = list(adv.service_uuids or [])
                name = adv.local_name or _device.name or ""
                self._merge_device(found, address, name, adv.rssi, uuids)
        except Exception as exc:
            self._log("info", f"Discover pass: {exc}")

        try:
            filtered = await BleakScanner.discover(
                timeout=3.0, service_uuids=[SERVICE_UUID], return_adv=True
            )
            for address, (_device, adv) in filtered.items():
                uuids = list(adv.service_uuids or [])
                if svc_lower not in [u.lower() for u in uuids]:
                    uuids.append(SERVICE_UUID)
                name = adv.local_name or _device.name or ""
                self._merge_device(found, address, name, adv.rssi, uuids)
        except Exception as exc:
            self._log("info", f"Service filter scan: {exc}")

        devices = []
        for entry in found.values():
            name = entry.get("name") or entry["address"]
            uuids = entry.get("service_uuids") or []
            if self._device_matches(name, uuids, show_all):
                devices.append(entry)

        devices.sort(key=lambda d: d.get("rssi") if d.get("rssi") is not None else -999, reverse=True)
        with self._lock:
            self._devices = devices
        self._log("info", f"Scan done: {len(devices)} device(s)")
        if not devices and not show_all:
            self._log(
                "info",
                "No Boite a Coeur found — box on first_p3 or lost_connection? Try Show all devices.",
            )
        return devices

    def scan(self, timeout: float = 12.0, show_all: bool = False) -> list[dict[str, Any]]:
        return self.run(self._scan(timeout, show_all))

    async def _disconnect(self) -> None:
        if self._client and self._client.is_connected:
            try:
                await self._client.disconnect()
            except BleakError:
                pass
        self._client = None
        self._connected_address = None
        self._connected_name = None
        self._log("info", "Disconnected")

    def disconnect(self) -> None:
        self.run(self._disconnect())

    async def _find_char(self, client: BleakClient, char_uuid: str):
        target = char_uuid.lower()
        for _ in range(24):
            services = client.services
            if services:
                for service in services:
                    for char in service.characteristics:
                        if char.uuid.lower() == target:
                            return char
            await asyncio.sleep(0.25)
        tree = []
        for service in client.services:
            for char in service.characteristics:
                tree.append(f"{service.uuid} / {char.uuid}")
        if tree:
            self._log("error", "GATT: " + "; ".join(tree))
        else:
            self._log("error", "GATT empty after connect")
        return None

    async def _connect(self, address: str) -> None:
        await self._disconnect()
        self._log("info", f"Connecting to {address}")
        client = BleakClient(address, timeout=30.0)
        try:
            await client.connect()
            if not client.is_connected:
                raise RuntimeError("BLE connect returned but link is down")
            if platform.system() == "Windows":
                await asyncio.sleep(0.8)
            char = await self._find_char(client, CHAR_UUID)
            if not char:
                raise RuntimeError(
                    f"Provisioning characteristic missing — wrong firmware or box not in provisioning mode"
                )
            self._client = client
            self._connected_address = address
            with self._lock:
                for d in self._devices:
                    if d["address"] == address:
                        self._connected_name = d.get("name")
                        break
            self._log("info", f"Connected to {self._connected_name or address}")
        except BleakDeviceNotFoundError as exc:
            try:
                await client.disconnect()
            except BleakError:
                pass
            raise RuntimeError(
                "Device not reachable — rescan, stay on first_p3, move PC closer, disable phone BLE to box"
            ) from exc
        except Exception:
            try:
                await client.disconnect()
            except BleakError:
                pass
            raise

    def connect(self, address: str) -> None:
        self.run(self._connect(address))

    async def _provision(self, ssid: str, password: str, fmt: str) -> None:
        if not self._client or not self._client.is_connected:
            raise RuntimeError("Not connected")
        ssid = ssid.strip()
        password = password.strip()
        if not ssid:
            raise RuntimeError("SSID is required")
        if fmt == "newline":
            payload = f"{ssid}\n{password}".encode("utf-8")
        else:
            payload = f"{ssid}|{password}".encode("utf-8")
        char = await self._find_char(self._client, CHAR_UUID)
        if not char:
            raise RuntimeError("Characteristic lost after connect")
        try:
            await self._client.write_gatt_char(char, payload, response=False)
        except BleakError:
            await self._client.write_gatt_char(char, payload, response=True)
        self._log("info", f"WiFi credentials sent ({fmt}) ssid={ssid}")

    def provision(self, ssid: str, password: str, fmt: str = "pipe") -> None:
        self.run(self._provision(ssid, password, fmt))
