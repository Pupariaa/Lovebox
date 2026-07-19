import { AppConfig } from "@/config/AppConfig";
import { tokenStorage } from "@/data/storage/tokenStorage";
import { ApiException, parseApiErrorMessage } from "./errors";
import type {
  AuthResponse,
  DeviceMeResponse,
  DeviceUpdateResponse,
  PairingCodeResponse,
  PairingStateResponse,
  PreviewResponse,
  SendMessageResponse,
  ReceivedMessagesResponse,
  SentMessagesResponse,
  UserProfileDto,
  UserProfileResponse,
} from "./models";

type JsonBody = Record<string, unknown>;

async function readError(res: Response): Promise<never> {
  const text = await res.text().catch(() => "");
  throw new ApiException(parseApiErrorMessage(text), res.status);
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${AppConfig.API_BASE}${path}`, init);
  if (res.status < 200 || res.status > 299) {
    return readError(res);
  }
  return (await res.json()) as T;
}

function jsonInit(method: string, body?: JsonBody, token?: string): RequestInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };
}

async function postAuth(
  path: string,
  email: string,
  password: string,
  extra?: JsonBody,
): Promise<AuthResponse> {
  const body = await requestJson<AuthResponse>(
    path,
    jsonInit("POST", { email: email.trim(), password, ...extra }),
  );
  await persistTokens(body);
  return body;
}

async function persistTokens(body: AuthResponse): Promise<void> {
  await tokenStorage.setAccessToken(body.access_token);
  await tokenStorage.setRefreshToken(body.refresh_token);
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return postAuth("/api/v1/auth/login", email, password);
}

export async function register(
  email: string,
  password: string,
  firstName: string,
): Promise<AuthResponse> {
  return postAuth("/api/v1/auth/register", email, password, {
    first_name: firstName.trim(),
  });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await requestJson<{ ok: boolean }>(
    "/api/v1/auth/forgot-password",
    jsonInit("POST", { email: email.trim() }),
  );
}

export async function refresh(): Promise<AuthResponse> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) throw new ApiException("Session expirée.", 401);
  const body = await requestJson<AuthResponse>(
    "/api/v1/auth/refresh",
    jsonInit("POST", { refresh_token: refreshToken }),
  );
  await persistTokens(body);
  return body;
}

export async function logout(): Promise<void> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (refreshToken) {
    await fetch(`${AppConfig.API_BASE}/api/v1/auth/logout`, {
      ...jsonInit("POST", { refresh_token: refreshToken }),
    }).catch(() => undefined);
  }
  await tokenStorage.clear();
}

export async function storeExternalTokens(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  await tokenStorage.setAccessToken(accessToken);
  await tokenStorage.setRefreshToken(refreshToken);
}

export async function clearLocalSession(): Promise<void> {
  await tokenStorage.clear();
}

async function authRequest<T>(block: (token: string) => Promise<T>): Promise<T> {
  let token = tokenStorage.getAccessToken();
  if (!token) throw new ApiException("Non connecté.", 401);
  try {
    return await block(token);
  } catch (e) {
    if (!(e instanceof ApiException) || e.status !== 401) throw e;
    try {
      await refresh();
    } catch (refreshError) {
      await clearLocalSession();
      throw refreshError;
    }
    token = tokenStorage.getAccessToken();
    if (!token) throw new ApiException("Session expirée.", 401);
    return block(token);
  }
}

export async function claimDevice(
  uuid: string,
  serialNumber: string,
): Promise<DeviceUpdateResponse> {
  return authRequest((token) =>
    requestJson<DeviceUpdateResponse>(
      "/api/v1/devices/claim",
      jsonInit("POST", { uuid: uuid.trim(), serial_number: serialNumber.trim() }, token),
    ),
  );
}

export async function getMyDevice(): Promise<DeviceMeResponse> {
  return authRequest((token) =>
    requestJson<DeviceMeResponse>("/api/v1/devices/me", jsonInit("GET", undefined, token)),
  );
}

export async function updateDevice(
  deviceId: number,
  patch: {
    displayName?: string | null;
    regionOverride?: string | null;
    locale?: string | null;
    backlightLevel?: number;
    sleepTimeoutSec?: number;
    displaySleepEnabled?: boolean;
  },
): Promise<DeviceUpdateResponse> {
  const body: JsonBody = {};
  if (patch.displayName !== undefined && patch.displayName !== null) body.display_name = patch.displayName;
  if (patch.regionOverride !== undefined && patch.regionOverride !== null) {
    body.region_override = patch.regionOverride;
  }
  if (patch.locale !== undefined && patch.locale !== null) {
    body.locale = patch.locale;
  }
  if (patch.backlightLevel !== undefined) body.backlight_level = patch.backlightLevel;
  if (patch.sleepTimeoutSec !== undefined) body.sleep_timeout_s = patch.sleepTimeoutSec;
  if (patch.displaySleepEnabled !== undefined) body.display_sleep_enabled = patch.displaySleepEnabled;
  return authRequest((token) =>
    requestJson<DeviceUpdateResponse>(
      `/api/v1/devices/${deviceId}`,
      jsonInit("PATCH", body, token),
    ),
  );
}

export async function unclaimDevice(deviceId: number): Promise<void> {
  await authRequest((token) =>
    requestJson<{ ok: boolean }>(
      `/api/v1/devices/${deviceId}/claim`,
      jsonInit("DELETE", undefined, token),
    ),
  );
}

export async function deleteDevice(deviceId: number): Promise<void> {
  await authRequest((token) =>
    requestJson<{ ok: boolean }>(
      `/api/v1/devices/${deviceId}`,
      jsonInit("DELETE", undefined, token),
    ),
  );
}

export async function getPairingState(): Promise<PairingStateResponse> {
  return authRequest((token) =>
    requestJson<PairingStateResponse>("/api/v1/pairings/me", jsonInit("GET", undefined, token)),
  );
}

export async function generatePairingCode(
  deviceId?: number | null,
): Promise<PairingCodeResponse> {
  const body = deviceId != null ? { device_id: deviceId } : undefined;
  return authRequest((token) =>
    requestJson<PairingCodeResponse>(
      "/api/v1/pairings/code/generate",
      jsonInit("POST", body, token),
    ),
  );
}

export async function acceptPairingCode(
  code: string,
  deviceId?: number | null,
): Promise<PairingStateResponse> {
  const body: JsonBody = { code: code.trim() };
  if (deviceId != null) body.device_id = deviceId;
  return authRequest((token) =>
    requestJson<PairingStateResponse>(
      "/api/v1/pairings/code/accept",
      jsonInit("POST", body, token),
    ),
  );
}

export async function unlinkPairing(pairingId: number): Promise<void> {
  await authRequest((token) =>
    requestJson<{ ok: boolean }>(
      `/api/v1/pairings/${pairingId}`,
      jsonInit("DELETE", undefined, token),
    ),
  );
}

export async function setPairingAlias(
  pairingId: number,
  alias: string | null,
): Promise<PairingStateResponse> {
  return authRequest((token) =>
    requestJson<PairingStateResponse>(
      `/api/v1/pairings/${pairingId}`,
      jsonInit("PATCH", { alias: alias && alias.trim() ? alias.trim() : null }, token),
    ),
  );
}

export async function getUserProfile(): Promise<UserProfileDto> {
  return authRequest(async (token) => {
    const res = await requestJson<UserProfileResponse>(
      "/api/v1/users/me",
      jsonInit("GET", undefined, token),
    );
    return res.user;
  });
}

export async function updateUserProfile(patch: {
  firstName?: string | null;
  lastName?: string | null;
  locale?: string | null;
  password?: string | null;
}): Promise<UserProfileDto> {
  const body: JsonBody = {};
  if (patch.firstName != null) body.first_name = patch.firstName;
  if (patch.lastName != null) body.last_name = patch.lastName;
  if (patch.locale != null) body.locale = patch.locale;
  if (patch.password != null) body.password = patch.password;
  return authRequest(async (token) => {
    const res = await requestJson<UserProfileResponse>(
      "/api/v1/users/me",
      jsonInit("PATCH", body, token),
    );
    return res.user;
  });
}

export async function migrateContactEmail(contactEmail: string): Promise<void> {
  await authRequest((token) =>
    requestJson<{ ok: boolean }>(
      "/api/v1/users/me/migrate-email",
      jsonInit("POST", { contact_email: contactEmail }, token),
    ),
  );
}

export async function setAccountPassword(password: string): Promise<UserProfileDto> {
  return authRequest(async (token) => {
    const res = await requestJson<UserProfileResponse>(
      "/api/v1/users/me/set-password",
      jsonInit("POST", { password }, token),
    );
    return res.user;
  });
}

export async function sendMessage(
  targetDeviceId: number,
  bacm: Uint8Array,
  scheduledAt?: string | null,
  ephemeral = false,
): Promise<SendMessageResponse> {
  const body = bacm.buffer.slice(bacm.byteOffset, bacm.byteOffset + bacm.byteLength);
  return authRequest((token) => {
    let query = `target_device_id=${targetDeviceId}`;
    if (scheduledAt && scheduledAt.trim().length > 0) {
      query += `&scheduled_at=${encodeURIComponent(scheduledAt.trim())}`;
    }
    if (ephemeral) {
      query += "&ephemeral=1";
    }
    return requestJson<SendMessageResponse>(`/api/v1/messages?${query}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
      },
      body,
    });
  });
}

export async function listSentMessages(page = 1): Promise<SentMessagesResponse> {
  return authRequest((token) =>
    requestJson<SentMessagesResponse>(
      `/api/v1/messages/sent?page=${page}`,
      jsonInit("GET", undefined, token),
    ),
  );
}

export async function listReceivedMessages(page = 1): Promise<ReceivedMessagesResponse> {
  return authRequest((token) =>
    requestJson<ReceivedMessagesResponse>(
      `/api/v1/messages/received?page=${page}`,
      jsonInit("GET", undefined, token),
    ),
  );
}

export async function getMessagePreview(id: number): Promise<string | null> {
  return authRequest(async (token) => {
    const res = await requestJson<PreviewResponse>(
      `/api/v1/messages/sent/${id}/preview`,
      jsonInit("GET", undefined, token),
    );
    return res.preview_base64 ?? null;
  });
}
