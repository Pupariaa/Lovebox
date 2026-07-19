import { Linking, PermissionsAndroid, Platform } from "react-native";

export type WifiSsidStatus =
  | "ok"
  | "not_on_wifi"
  | "location_denied"
  | "location_blocked"
  | "unavailable";

export async function requestWifiSsidPermission(): Promise<WifiSsidStatus> {
  if (Platform.OS === "android") {
    const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    if (granted) return "ok";
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    if (result === PermissionsAndroid.RESULTS.GRANTED) return "ok";
    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return "location_blocked";
    return "location_denied";
  }

  try {
    const Location = await import("expo-location");
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === "granted") return "ok";
    return "location_denied";
  } catch {
    return "unavailable";
  }
}

export function openAppSettings(): void {
  void Linking.openSettings();
}

function normalizeSsid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const ssid = value.trim();
  if (!ssid || ssid === "<unknown ssid>" || ssid === "SSID") return null;
  return ssid;
}

export async function getCurrentWifiSsid(): Promise<{ ssid: string | null; status: WifiSsidStatus }> {
  try {
    const NetInfo = await import("@react-native-community/netinfo");
    const state = await NetInfo.default.fetch();
    if (state.type !== "wifi" || !state.isConnected) {
      return { ssid: null, status: "not_on_wifi" };
    }

    if (Platform.OS === "ios" || Platform.OS === "android") {
      const perm = await requestWifiSsidPermission();
      if (perm !== "ok") {
        return { ssid: null, status: perm };
      }
      const refreshed = await NetInfo.default.fetch();
      const ssid = normalizeSsid(
        refreshed.details && "ssid" in refreshed.details ? refreshed.details.ssid : null,
      );
      return { ssid, status: ssid ? "ok" : "unavailable" };
    }

    const ssid = normalizeSsid(state.details && "ssid" in state.details ? state.details.ssid : null);
    return { ssid, status: ssid ? "ok" : "unavailable" };
  } catch {
    return { ssid: null, status: "unavailable" };
  }
}

export function wifiSsidStatusMessage(status: WifiSsidStatus): string {
  switch (status) {
    case "not_on_wifi":
      return "Connecte ton téléphone au WiFi 2,4 GHz de ta box, ou saisis le réseau manuellement.";
    case "location_denied":
      return "Autorise la localisation pour détecter le nom du réseau WiFi connecté.";
    case "location_blocked":
      return "La localisation est bloquée. Ouvre les réglages pour autoriser la détection du WiFi.";
    case "unavailable":
      return "Impossible de lire le nom du réseau. Saisis-le manuellement ou scanne le QR WiFi.";
    default:
      return "";
  }
}
