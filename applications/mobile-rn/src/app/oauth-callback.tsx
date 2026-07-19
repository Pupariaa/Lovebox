import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { completeOAuthFromParams } from "@/data/api/oauth";
import { useAppStore } from "@/store/appStore";
import { colors } from "@/theme/theme";

function paramString(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

export default function OAuthCallbackScreen() {
  const router = useRouter();
  const raw = useLocalSearchParams<{
    error?: string | string[];
    access_token?: string | string[];
    refresh_token?: string | string[];
  }>();
  const showSnackbar = useAppStore((s) => s.showSnackbar);
  const afterExternalLogin = useAppStore((s) => s.afterExternalLogin);

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
    let cancelled = false;
    (async () => {
      const result = await completeOAuthFromParams({
        error: paramString(raw.error),
        access_token: paramString(raw.access_token),
        refresh_token: paramString(raw.refresh_token),
      });
      if (cancelled) return;
      if (result.ok) {
        await afterExternalLogin();
        const profile = useAppStore.getState().userProfile;
        if (profile?.profile_complete === false || !profile?.first_name?.trim()) {
          router.replace("/onboarding/profile");
          return;
        }
        router.replace("/(tabs)/home");
        return;
      }
      if (result.accountNotFound) {
        router.replace("/auth?oauth_error=account_not_found" as Href);
        return;
      }
      if (!result.cancelled) {
        showSnackbar(result.error ?? "Connexion impossible.");
      }
      router.replace("/auth");
    })();
    return () => {
      cancelled = true;
    };
  }, [afterExternalLogin, raw.access_token, raw.error, raw.refresh_token, router, showSnackbar]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.plumBackground }}>
      <ActivityIndicator color={colors.rosePrimary} />
    </View>
  );
}
