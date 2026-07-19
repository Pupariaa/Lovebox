import { BleManager, State } from "react-native-ble-plx";
import { Linking, PermissionsAndroid, Platform } from "react-native";

export type BleAccessState =
  | "ready"
  | "permission_denied"
  | "permission_blocked"
  | "bluetooth_off";

export type BleAccessStatus = {
  state: BleAccessState;
  canScan: boolean;
};

let manager: BleManager | null = null;

function getManager(): BleManager {
  if (!manager) manager = new BleManager();
  return manager;
}

async function checkAndroidPermissions(): Promise<BleAccessState> {
  const apiLevel =
    typeof Platform.Version === "number" ? Platform.Version : parseInt(String(Platform.Version), 10);

  if (apiLevel >= 31) {
    const scan = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
    const connect = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
    if (scan && connect) return "ready";
    return "permission_denied";
  }

  const location = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return location ? "ready" : "permission_denied";
}

async function requestAndroidPermissionsDetailed(): Promise<BleAccessState> {
  const apiLevel =
    typeof Platform.Version === "number" ? Platform.Version : parseInt(String(Platform.Version), 10);

  if (apiLevel >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    const scan = result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN];
    const connect = result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT];
    if (scan === PermissionsAndroid.RESULTS.GRANTED && connect === PermissionsAndroid.RESULTS.GRANTED) {
      return "ready";
    }
    if (scan === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN || connect === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      return "permission_blocked";
    }
    return "permission_denied";
  }

  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  if (granted === PermissionsAndroid.RESULTS.GRANTED) return "ready";
  if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return "permission_blocked";
  return "permission_denied";
}

async function checkBluetoothPoweredOn(): Promise<boolean> {
  try {
    const state = await getManager().state();
    return state === State.PoweredOn;
  } catch {
    return false;
  }
}

async function waitForBleState(timeoutMs = 4000): Promise<State> {
  const bleManager = getManager();
  const current = await bleManager.state();
  if (current !== State.Unknown && current !== State.Resetting) return current;
  return new Promise<State>((resolve) => {
    const timer = setTimeout(() => {
      subscription.remove();
      resolve(current);
    }, timeoutMs);
    const subscription = bleManager.onStateChange((next) => {
      if (next !== State.Unknown && next !== State.Resetting) {
        clearTimeout(timer);
        subscription.remove();
        resolve(next);
      }
    }, true);
  });
}

function iosStateToAccess(state: State): BleAccessStatus {
  switch (state) {
    case State.PoweredOn:
      return { state: "ready", canScan: true };
    case State.Unauthorized:
      return { state: "permission_blocked", canScan: false };
    case State.PoweredOff:
      return { state: "bluetooth_off", canScan: false };
    default:
      return { state: "bluetooth_off", canScan: false };
  }
}

export async function getBleAccessStatus(): Promise<BleAccessStatus> {
  if (Platform.OS === "ios") {
    return iosStateToAccess(await waitForBleState());
  }

  const perm = await checkAndroidPermissions();
  if (perm !== "ready") {
    return { state: perm, canScan: false };
  }

  const poweredOn = await checkBluetoothPoweredOn();
  if (!poweredOn) {
    return { state: "bluetooth_off", canScan: false };
  }

  return { state: "ready", canScan: true };
}

export async function ensureBleAccess(): Promise<BleAccessStatus> {
  if (Platform.OS === "ios") {
    return iosStateToAccess(await waitForBleState());
  }

  let perm = await checkAndroidPermissions();
  if (perm !== "ready") {
    perm = await requestAndroidPermissionsDetailed();
  }
  if (perm !== "ready") {
    return { state: perm, canScan: false };
  }

  const poweredOn = await checkBluetoothPoweredOn();
  if (!poweredOn) {
    return { state: "bluetooth_off", canScan: false };
  }

  return { state: "ready", canScan: true };
}

export function openAppSettings(): void {
  void Linking.openSettings();
}

export function bleAccessMessage(state: BleAccessState): string {
  switch (state) {
    case "permission_denied":
      return Platform.OS === "ios"
        ? "Autorise le Bluetooth pour cette app dans Réglages > Boîte à cœur."
        : "Autorise le Bluetooth et la localisation pour détecter ta boîte.";
    case "permission_blocked":
      return "Les autorisations Bluetooth sont bloquées. Ouvre les réglages de l'app pour les activer.";
    case "bluetooth_off":
      return "Active le Bluetooth sur ton téléphone, puis réessaie.";
    default:
      return "";
  }
}
