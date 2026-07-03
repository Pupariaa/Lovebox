import { useCallback, useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Snackbar } from "@/components/ui";
import { ensureFontsLoaded, FONT_FAMILY_MAP } from "@/domain/bacm/font";
import { useAppStore } from "@/store/appStore";
import { colors } from "@/theme/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const bootstrap = useAppStore((s) => s.bootstrap);
  const snackbarMessage = useAppStore((s) => s.snackbarMessage);
  const clearSnackbar = useAppStore((s) => s.clearSnackbar);
  const [fontsLoaded] = useFonts(FONT_FAMILY_MAP);

  useEffect(() => {
    ensureFontsLoaded();
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await bootstrap();
      if (mounted) {
        setReady(true);
        await SplashScreen.hideAsync();
      }
    })();
    return () => {
      mounted = false;
    };
  }, [bootstrap]);

  void fontsLoaded;

  const onDismiss = useCallback(() => clearSnackbar(), [clearSnackbar]);

  if (!ready) return null;

  return (
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
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="ble" options={{ presentation: "card" }} />
          <Stack.Screen name="settings" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="history" />
          <Stack.Screen name="legal-hub" />
          <Stack.Screen name="legal/[section]" />
          <Stack.Screen name="device/[id]" />
        </Stack>
        <Snackbar message={snackbarMessage} onDismiss={onDismiss} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
