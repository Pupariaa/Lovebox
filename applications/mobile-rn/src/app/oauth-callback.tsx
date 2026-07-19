import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { completeOAuthFromParams } from "@/data/api/oauth";
import { userFacingError } from "@/data/api/errors";
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
    code?: string | string[];
  }>();
  const showSnackbar = useAppStore((s) => s.showSnackbar);
  const afterExternalLogin = useAppStore((s) => s.afterExternalLogin);

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
    let cancelled = false;
    (async () => {
      try {
        const result = await completeOAuthFromParams({
          error: paramString(raw.error),
          code: paramString(raw.code),
        });
        if (cancelled) return;
        if (result.ok) {
          await afterExternalLogin();
          if (cancelled) return;
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
      } catch (error) {
        if (cancelled) return;
        console.error("oauth callback handling failed", error);
        showSnackbar(userFacingError(error, "Connexion impossible."));
        router.replace("/auth");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [afterExternalLogin, raw.code, raw.error, router, showSnackbar]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.plumBackground }}>
      <ActivityIndicator color={colors.rosePrimary} />
    </View>
  );
}
