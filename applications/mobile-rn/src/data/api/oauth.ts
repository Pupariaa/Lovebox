import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { AppConfig, OAUTH_PROVIDERS, type OAuthProvider } from "@/config/AppConfig";
import { mapApiError, parseApiErrorMessage } from "./errors";
import { storeExternalTokens } from "./ApiClient";

export type OAuthResult =
  | { ok: true }
  | { ok: false; cancelled: boolean; error?: string; accountNotFound?: boolean };

export type OAuthIntent = "login" | "register";

let cachedProviders: OAuthProvider[] | null = null;
let authSessionPrimed = false;

function primeAuthSession(): void {
  if (authSessionPrimed) return;
  authSessionPrimed = true;
  WebBrowser.maybeCompleteAuthSession();
}

function extractCallback(url: string): {
  access?: string;
  refresh?: string;
  error?: string;
} {
  const parsed = Linking.parse(url);
  const params = parsed.queryParams ?? {};
  const access = typeof params.access_token === "string" ? params.access_token : undefined;
  const refresh = typeof params.refresh_token === "string" ? params.refresh_token : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;
  return { access, refresh, error };
}

export async function completeOAuthFromParams(params: {
  access_token?: string;
  refresh_token?: string;
  error?: string;
}): Promise<OAuthResult> {
  const error = params.error;
  if (error) {
    return {
      ok: false,
      cancelled: false,
      error: mapApiError(error),
      accountNotFound: error === "account_not_found",
    };
  }
  const access = params.access_token;
  const refresh = params.refresh_token;
  if (access && refresh) {
    await storeExternalTokens(access, refresh);
    return { ok: true };
  }
  return { ok: false, cancelled: false, error: "Tokens manquants dans la réponse OAuth." };
}

export async function fetchOAuthProviders(): Promise<OAuthProvider[]> {
  if (cachedProviders) return cachedProviders;
  try {
    const res = await fetch(`${AppConfig.API_BASE}/api/v1/auth/oauth/providers`);
    if (!res.ok) throw new Error("providers unavailable");
    const body = (await res.json()) as { providers?: string[] };
    const allowed = new Set<string>(OAUTH_PROVIDERS);
    cachedProviders = (body.providers ?? []).filter((p): p is OAuthProvider => allowed.has(p));
    return cachedProviders;
  } catch {
    return [];
  }
}

async function startWebOAuth(provider: OAuthProvider, intent: OAuthIntent): Promise<OAuthResult> {
  primeAuthSession();
  const redirectUri = Linking.createURL(AppConfig.OAUTH_CALLBACK_PATH);
  const startUrl = `${AppConfig.API_BASE}/api/v1/auth/oauth/${provider}/start?app=native&intent=${intent}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  try {
    const result = await WebBrowser.openAuthSessionAsync(startUrl, redirectUri);
    if (result.type === "cancel" || result.type === "dismiss") {
      return { ok: false, cancelled: true };
    }
    if (result.type === "success" && result.url) {
      const { access, refresh, error } = extractCallback(result.url);
      return completeOAuthFromParams({
        access_token: access,
        refresh_token: refresh,
        error,
      });
    }
    return { ok: false, cancelled: false, error: "Connexion OAuth interrompue." };
  } catch (e) {
    return {
      ok: false,
      cancelled: false,
      error: e instanceof Error ? mapApiError(e.message) : "Erreur OAuth.",
    };
  }
}

async function startNativeApple(intent: OAuthIntent): Promise<OAuthResult> {
  try {
    const AppleAuthentication = await import("expo-apple-authentication");
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      return startWebOAuth("apple", intent);
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.authorizationCode && !credential.identityToken) {
      return { ok: false, cancelled: false, error: "Identifiants Apple manquants." };
    }

    const payload: Record<string, unknown> = {
      code: credential.authorizationCode ?? "",
      id_token: credential.identityToken ?? "",
      intent,
    };
    const userPayload: Record<string, unknown> = {};
    if (credential.email) {
      userPayload.email = credential.email;
    }
    if (credential.fullName?.givenName) {
      userPayload.name = {
        firstName: credential.fullName.givenName,
        lastName: credential.fullName.familyName ?? "",
      };
    }
    if (Object.keys(userPayload).length > 0) {
      payload.user = userPayload;
    }

    const res = await fetch(`${AppConfig.API_BASE}/api/v1/auth/oauth/apple/native`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const error = parseApiErrorMessage(text);
      return {
        ok: false,
        cancelled: false,
        error,
        accountNotFound: res.status === 404 || error.includes("account_not_found"),
      };
    }
    const body = (await res.json()) as { access_token?: string; refresh_token?: string };
    if (!body.access_token || !body.refresh_token) {
      return { ok: false, cancelled: false, error: "Tokens manquants dans la réponse Apple." };
    }
    await storeExternalTokens(body.access_token, body.refresh_token);
    return { ok: true };
  } catch (e) {
    const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "";
    if (code === "ERR_REQUEST_CANCELED") {
      return { ok: false, cancelled: true };
    }
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("ExpoAppleAuthentication") || message.includes("native module")) {
      return startWebOAuth("apple", intent);
    }
    return {
      ok: false,
      cancelled: false,
      error: e instanceof Error ? mapApiError(e.message) : "Erreur Apple Sign In.",
    };
  }
}

export async function startOAuth(provider: OAuthProvider, intent: OAuthIntent = "login"): Promise<OAuthResult> {
  if (provider === "apple" && Platform.OS === "ios") {
    return startNativeApple(intent);
  }
  return startWebOAuth(provider, intent);
}
