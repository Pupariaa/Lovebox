import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/ui";
import { useAppStore } from "@/store/appStore";
import { colors, spacing } from "@/theme/theme";

export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const isOnline = useAppStore((s) => s.isOnline);

  if (isOnline) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top + spacing.xs }]}>
      <AppText variant="caption" center color={colors.onPrimary}>
        Hors ligne. Vérifie ta connexion internet.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
});
