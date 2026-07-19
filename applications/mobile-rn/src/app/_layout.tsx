import { useCallback, useEffect, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { AppText, Button, Snackbar } from "@/components/ui";
import { ensureFontsLoaded, FONT_FAMILY_MAP } from "@/domain/bacm/font";
import { useAppStore } from "@/store/appStore";
import { mapApiError } from "@/data/api/errors";
import { colors } from "@/theme/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const bootstrap = useAppStore((s) => s.bootstrap);
  const snackbarMessage = useAppStore((s) => s.snackbarMessage);
  const clearSnackbar = useAppStore((s) => s.clearSnackbar);
  const [fontsLoaded] = useFonts(FONT_FAMILY_MAP);

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  useEffect(() => {
    ensureFontsLoaded();
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await bootstrap();
      } catch (e) {
        setBootError(e instanceof Error ? mapApiError(e.message) : "Erreur au démarrage.");
      } finally {
        if (mounted) {
          setReady(true);
          await SplashScreen.hideAsync();
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [bootstrap]);

  void fontsLoaded;

  const onDismiss = useCallback(() => clearSnackbar(), [clearSnackbar]);

  if (!ready) return null;

  if (bootError) {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.plumBackground }}>
        <SafeAreaProvider>
          <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 16 }}>
            <AppText variant="headlineMedium">Erreur au démarrage</AppText>
            <AppText variant="bodyMedium" muted>
              {bootError}
            </AppText>
            <Button label="Réessayer" onPress={() => { setBootError(null); void bootstrap(); }} />
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.plumBackground },
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="oauth-callback" options={{ gestureEnabled: false, animation: "none" }} />
          <Stack.Screen name="onboarding/profile" options={{ gestureEnabled: false }} />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="migrate-account" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="boxes" />
          <Stack.Screen name="ble" options={{ presentation: "card" }} />
          <Stack.Screen name="settings" />
          <Stack.Screen name="box-settings" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="history" />
          <Stack.Screen name="received" />
          <Stack.Screen name="legal-hub" />
          <Stack.Screen name="legal/[section]" />
          <Stack.Screen name="device/[id]" />
        </Stack>
        <Snackbar message={snackbarMessage} onDismiss={onDismiss} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}
