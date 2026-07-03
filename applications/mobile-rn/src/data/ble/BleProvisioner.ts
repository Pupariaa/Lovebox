import { BleManager, Device, State, Subscription } from "react-native-ble-plx";
import { AppConfig } from "@/config/AppConfig";
import {
  base64ToFirstByte,
  base64ToString,
  stringToBase64,
} from "@/util/base64";

export type BleDeviceItem = {
  name: string;
  address: string;
};

export type BleBoxIdentity = {
  deviceName: string;
  serialNumber: string | null;
  uuid: string | null;
};

export const BleProvStatus = {
  IDLE: 0,
  CONNECTING: 1,
  OK: 2,
  FAIL: 3,
} as const;

const NAME_HINTS = ["bac", "boite", "coeur", "boiteacoeur", "lovebox"];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isUsableBleDeviceName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  return trimmed.toLowerCase() !== "boiteacoeur";
}

export function parseBleBoxIdentity(raw: string): BleBoxIdentity | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parts = trimmed.split("|");
  const name = (parts[0] ?? "").trim();
  const serial = (parts[1] ?? "").trim() || null;
  const uuid = (parts[2] ?? "").trim() || null;
  if (!isUsableBleDeviceName(name)) return null;
  return { deviceName: name, serialNumber: serial, uuid };
}

function matchesBox(device: Device): boolean {
  const uuids = device.serviceUUIDs ?? [];
  if (uuids.some((u) => u.toLowerCase() === AppConfig.BLE_SERVICE_UUID.toLowerCase())) {
    return true;
  }
  const name = (device.name ?? device.localName ?? "").toLowerCase();
  if (!name) return false;
  return NAME_HINTS.some((hint) => name.includes(hint));
}

export class BleProvisioner {
  private manager = new BleManager();
  private device: Device | null = null;
  private identity: BleBoxIdentity | null = null;

  async ensurePoweredOn(timeoutMs = 8000): Promise<void> {
    const state = await this.manager.state();
    if (state === State.PoweredOn) return;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        sub.remove();
        reject(new Error("Bluetooth desactive"));
      }, timeoutMs);
      const sub = this.manager.onStateChange((next) => {
        if (next === State.PoweredOn) {
          clearTimeout(timer);
          sub.remove();
          resolve();
        }
      }, true);
    });
  }

  async scan(timeoutMs = 12000): Promise<BleDeviceItem[]> {
    await this.ensurePoweredOn();
    const found = new Map<string, BleDeviceItem>();
    return new Promise<BleDeviceItem[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.manager.stopDeviceScan();
        resolve(Array.from(found.values()));
      }, timeoutMs);

      this.manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
        if (error) {
          clearTimeout(timer);
          this.manager.stopDeviceScan();
          reject(error);
          return;
        }
        if (!device || !matchesBox(device)) return;
        found.set(device.id, {
          name: device.name ?? device.localName ?? "BoiteACoeur",
          address: device.id,
        });
      });
    });
  }

  async connect(address: string, deviceName: string): Promise<void> {
    const device = await this.manager.connectToDevice(address, { timeout: 30000 });
    await device.discoverAllServicesAndCharacteristics();
    this.device = device;
    this.identity = await this.readIdentity(device, deviceName);
    await delay(600);
  }

  private async readIdentity(device: Device, fallbackName: string): Promise<BleBoxIdentity | null> {
    try {
      const char = await device.readCharacteristicForService(
        AppConfig.BLE_SERVICE_UUID,
        AppConfig.BLE_DEVICE_INFO_CHAR_UUID,
      );
      if (char.value) {
        const parsed = parseBleBoxIdentity(base64ToString(char.value));
        if (parsed) return parsed;
      }
    } catch {
      // fall through to fallback name
    }
    if (isUsableBleDeviceName(fallbackName)) {
      return { deviceName: fallbackName.trim(), serialNumber: null, uuid: null };
    }
    return null;
  }

  boxIdentity(): BleBoxIdentity | null {
    return this.identity;
  }

  private async writeChar(charUuid: string, payload: string, maxBytes: number): Promise<void> {
    if (!this.device) throw new Error("not connected");
    const bytes = stringToBase64(payload);
    if (payload.length > maxBytes) {
      throw new Error("payload too large");
    }
    try {
      await this.device.writeCharacteristicWithResponseForService(
        AppConfig.BLE_SERVICE_UUID,
        charUuid,
        bytes,
      );
    } catch {
      await this.device.writeCharacteristicWithoutResponseForService(
        AppConfig.BLE_SERVICE_UUID,
        charUuid,
        bytes,
      );
    }
  }

  async sendWifiCredentials(ssid: string, password: string): Promise<void> {
    await this.writeChar(AppConfig.BLE_WIFI_CHAR_UUID, `${ssid}|${password}`, 127);
    await delay(250);
  }

  async sendDeviceConfig(displayName: string, locale: string, region: string): Promise<void> {
    await this.writeChar(
      AppConfig.BLE_CONFIG_CHAR_UUID,
      `${displayName.trim()}|${locale.trim()}|${region.trim()}`,
      191,
    );
  }

  async awaitWifiResult(timeoutMs = 90000): Promise<boolean> {
    if (!this.device) throw new Error("not connected");
    const device = this.device;
    return new Promise<boolean>((resolve, reject) => {
      let settled = false;
      let subscription: Subscription | null = null;

      const finish = (value: boolean | null, error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearInterval(poll);
        subscription?.remove();
        if (error) reject(error);
        else resolve(value ?? false);
      };

      const handleStatus = async (status: number) => {
        if (status === BleProvStatus.FAIL) {
          finish(false);
        } else if (status === BleProvStatus.OK) {
          const ok = await this.confirmOk(device);
          finish(ok);
        }
      };

      const timer = setTimeout(() => finish(false), timeoutMs);

      subscription = device.monitorCharacteristicForService(
        AppConfig.BLE_SERVICE_UUID,
        AppConfig.BLE_WIFI_STATUS_CHAR_UUID,
        (error, char) => {
          if (error) {
            finish(null, error);
            return;
          }
          if (char?.value) void handleStatus(base64ToFirstByte(char.value));
        },
      );

      const poll = setInterval(async () => {
        try {
          const char = await device.readCharacteristicForService(
            AppConfig.BLE_SERVICE_UUID,
            AppConfig.BLE_WIFI_STATUS_CHAR_UUID,
          );
          if (char.value) await handleStatus(base64ToFirstByte(char.value));
        } catch {
          // ignore transient read errors while polling
        }
      }, 400);
    });
  }

  private async confirmOk(device: Device): Promise<boolean> {
    try {
      await delay(800);
      const char = await device.readCharacteristicForService(
        AppConfig.BLE_SERVICE_UUID,
        AppConfig.BLE_WIFI_STATUS_CHAR_UUID,
      );
      return char.value ? base64ToFirstByte(char.value) === BleProvStatus.OK : true;
    } catch {
      return true;
    }
  }

  async disconnect(): Promise<void> {
    const device = this.device;
    this.device = null;
    if (device) {
      await this.manager.cancelDeviceConnection(device.id).catch(() => undefined);
    }
  }
}
