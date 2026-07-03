import * as SecureStore from "expo-secure-store";

const ACCESS_KEY = "bac_access";
const REFRESH_KEY = "bac_refresh";

let accessCache: string | null = null;
let refreshCache: string | null = null;
let loaded = false;

export const tokenStorage = {
  async load(): Promise<void> {
    if (loaded) return;
    accessCache = await SecureStore.getItemAsync(ACCESS_KEY);
    refreshCache = await SecureStore.getItemAsync(REFRESH_KEY);
    loaded = true;
  },
  getAccessToken(): string | null {
    return accessCache;
  },
  getRefreshToken(): string | null {
    return refreshCache;
  },
  async setAccessToken(token: string): Promise<void> {
    accessCache = token;
    await SecureStore.setItemAsync(ACCESS_KEY, token);
  },
  async setRefreshToken(token: string): Promise<void> {
    refreshCache = token;
    await SecureStore.setItemAsync(REFRESH_KEY, token);
  },
  async clear(): Promise<void> {
    accessCache = null;
    refreshCache = null;
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};
