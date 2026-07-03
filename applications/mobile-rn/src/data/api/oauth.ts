import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { AppConfig, type OAuthProvider } from "@/config/AppConfig";
import { storeExternalTokens } from "./ApiClient";

export type OAuthResult =
  | { ok: true }
  | { ok: false; cancelled: boolean; error?: string };

function extractTokens(url: string): {
  access?: string;
  refresh?: string;
} {
  const parsed = Linking.parse(url);
  const params = parsed.queryParams ?? {};
  const access = typeof params.access_token === "string" ? params.access_token : undefined;
  const refresh = typeof params.refresh_token === "string" ? params.refresh_token : undefined;
  return { access, refresh };
}

export async function startOAuth(provider: OAuthProvider): Promise<OAuthResult> {
  const redirectUri = Linking.createURL(AppConfig.OAUTH_CALLBACK_PATH);
  const startUrl = `${AppConfig.API_BASE}/api/v1/auth/oauth/${provider}/start?app=native&redirect_uri=${encodeURIComponent(redirectUri)}`;

  try {
    const result = await WebBrowser.openAuthSessionAsync(startUrl, redirectUri);
    if (result.type === "cancel" || result.type === "dismiss") {
      return { ok: false, cancelled: true };
    }
    if (result.type === "success" && result.url) {
      const { access, refresh } = extractTokens(result.url);
      if (access && refresh) {
        await storeExternalTokens(access, refresh);
        return { ok: true };
      }
      return { ok: false, cancelled: false, error: "Tokens manquants dans la reponse OAuth" };
    }
    return { ok: false, cancelled: false, error: "Connexion OAuth interrompue" };
  } catch (e) {
    return {
      ok: false,
      cancelled: false,
      error: e instanceof Error ? e.message : "Erreur OAuth",
    };
  }
}
