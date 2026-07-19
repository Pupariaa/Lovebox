const Ble = (() => {
  const SERVICE = "bac1c201-1fb5-459e-8fcc-c5c9c331914b";
  const WIFI_CHAR = "bac1c202-36e1-4688-b7f5-ea07361b26a8";
  const STATUS_CHAR = "bac1c203-36e1-4688-b7f5-ea07361b26a8";
  const INFO_CHAR = "bac1c204-36e1-4688-b7f5-ea07361b26a8";

  const PROV_IDLE = 0;
  const PROV_OK = 2;
  const PROV_FAIL = 3;

  let device = null;
  let server = null;
  let identity = null;

  function supported() {
    return !!navigator.bluetooth;
  }

  async function requestDevice() {
    const optional = [SERVICE, "00001800-0000-1000-8000-00805f9b34fb"];
    return navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: optional,
    });
  }

  async function connect() {
    if (!supported()) throw new Error("Web Bluetooth unavailable (use Chrome or Edge on desktop)");
    device = await requestDevice();
    device.addEventListener("gattserverdisconnected", () => {
      server = null;
      identity = null;
    });
    server = await device.gatt.connect();
    try {
      await server.getPrimaryService(SERVICE);
    } catch (e) {
      await disconnect();
      throw new Error("Périphérique sans service Boîte à cœur. Choisissez la boîte en mode provisioning.");
    }
    identity = await readIdentity();
    return {
      name: device.name || identity?.deviceName || "Boite",
      identity,
    };
  }

  async function readIdentity() {
    const svc = await server.getPrimaryService(SERVICE);
    try {
      const info = await svc.getCharacteristic(INFO_CHAR);
      const val = await info.readValue();
      const raw = new TextDecoder().decode(val.buffer).trim();
      const parts = raw.split("|");
      const deviceName = (parts[0] || "").trim();
      const serialNumber = (parts[1] || "").trim() || null;
      const uuid = (parts[2] || "").trim() || null;
      if (deviceName && deviceName.toLowerCase() !== "boiteacoeur") {
        return { deviceName, serialNumber, uuid };
      }
    } catch (e) {
      console.log("info char read failed", e);
    }
    try {
      const gap = await server.getPrimaryService("00001800-0000-1000-8000-00805f9b34fb");
      const nameChar = await gap.getCharacteristic("00002a00-0000-1000-8000-00805f9b34fb");
      const val = await nameChar.readValue();
      const deviceName = new TextDecoder().decode(val.buffer).trim();
      if (deviceName && deviceName.toLowerCase() !== "boiteacoeur") {
        return { deviceName, serialNumber: null };
      }
    } catch (e) {
      console.log("gap name read failed", e);
    }
    const fallback = (device?.name || "").trim();
    if (fallback && fallback.toLowerCase() !== "boiteacoeur") {
      return { deviceName: fallback, serialNumber: null };
    }
    return null;
  }

  async function provisionWifi(ssid, password, onStatus) {
    if (!server?.connected) throw new Error("BLE not connected");
    const svc = await server.getPrimaryService(SERVICE);
    const wifi = await svc.getCharacteristic(WIFI_CHAR);
    const status = await svc.getCharacteristic(STATUS_CHAR);
    const cleanSsid = (ssid || "").trim();
    const cleanPass = (password || "").trim();
    const payload = `${cleanSsid}|${cleanPass}`;
    const data = new TextEncoder().encode(payload);
    if (data.length > 127) throw new Error("WiFi payload too large");
    await wifi.writeValue(data);
    onStatus?.("WiFi sent, waiting for box...");
    return waitForWifiStatus(status, onStatus);
  }

  function waitForWifiStatus(statusChar, onStatus) {
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        statusChar.removeEventListener("characteristicvaluechanged", onNotify);
        clearInterval(pollId);
        resolve(ok);
      };

      const onNotify = (event) => {
        const v = event.target.value.getUint8(0);
        if (v === PROV_OK) finish(true);
        if (v === PROV_FAIL) finish(false);
      };

      const pollId = setInterval(async () => {
        try {
          const val = await statusChar.readValue();
          const v = val.getUint8(0);
          if (v === PROV_OK) finish(true);
          if (v === PROV_FAIL) finish(false);
        } catch (_) {}
      }, 500);

      statusChar.startNotifications()
        .then(() => statusChar.addEventListener("characteristicvaluechanged", onNotify))
        .catch(() => {});

      setTimeout(() => {
        if (!done) {
          done = true;
          clearInterval(pollId);
          reject(new Error("WiFi timeout"));
        }
      }, 90000);
    });
  }

  async function disconnect() {
    identity = null;
    if (device?.gatt?.connected) device.gatt.disconnect();
    device = null;
    server = null;
  }

  function isConnected() {
    return !!(server?.connected);
  }

  function getIdentity() {
    return identity;
  }

  return {
    supported,
    connect,
    provisionWifi,
    disconnect,
    isConnected,
    getIdentity,
  };
})();
