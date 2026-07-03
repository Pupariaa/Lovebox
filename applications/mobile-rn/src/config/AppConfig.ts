export const AppConfig = {
  API_BASE: "https://boite-a-coeur.techalchemy.fr",
  BLE_SERVICE_UUID: "bac1c201-1fb5-459e-8fcc-c5c9c331914b",
  BLE_WIFI_CHAR_UUID: "bac1c202-36e1-4688-b7f5-ea07361b26a8",
  BLE_WIFI_STATUS_CHAR_UUID: "bac1c203-36e1-4688-b7f5-ea07361b26a8",
  BLE_DEVICE_INFO_CHAR_UUID: "bac1c204-36e1-4688-b7f5-ea07361b26a8",
  BLE_CONFIG_CHAR_UUID: "bac1c205-36e1-4688-b7f5-ea07361b26a8",
  MSG_WIDTH: 280,
  MSG_HEIGHT: 240,
  DEV_WIFI_SSID: "freebox_MAISON",
  DEV_WIFI_PASSWORD: "2cc23402B",
  OAUTH_CALLBACK_SCHEME: "boiteacoeur",
  OAUTH_CALLBACK_PATH: "oauth-callback",
} as const;

export const OAUTH_PROVIDERS = ["google", "apple", "facebook"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];
