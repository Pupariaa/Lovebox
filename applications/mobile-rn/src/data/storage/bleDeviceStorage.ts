import * as SecureStore from "expo-secure-store";

const BLE_DEVICE_NAME_KEY = "bac_ble_device_name";
const BLE_DEVICE_ADDRESS_KEY = "bac_ble_address";

export type StoredBleDevice = {
  deviceName: string;
  address: string;
};

export async function loadStoredBleDevice(): Promise<StoredBleDevice | null> {
  const deviceName = await SecureStore.getItemAsync(BLE_DEVICE_NAME_KEY);
  const address = await SecureStore.getItemAsync(BLE_DEVICE_ADDRESS_KEY);
  if (!deviceName || !address) return null;
  return { deviceName, address };
}

export async function saveStoredBleDevice(deviceName: string, address: string): Promise<void> {
  await SecureStore.setItemAsync(BLE_DEVICE_NAME_KEY, deviceName);
  await SecureStore.setItemAsync(BLE_DEVICE_ADDRESS_KEY, address);
}

export async function clearStoredBleDevice(): Promise<void> {
  await SecureStore.deleteItemAsync(BLE_DEVICE_NAME_KEY);
  await SecureStore.deleteItemAsync(BLE_DEVICE_ADDRESS_KEY);
}
