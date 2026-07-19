import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button } from "@/components/ui";
import {
  bleAccessMessage,
  openAppSettings,
  type BleAccessState,
} from "@/data/ble/blePermissionStatus";
import { colors, spacing } from "@/theme/theme";

type Props = {
  state: BleAccessState;
  onRetry: () => void;
  onManualWifi?: () => void;
  loading?: boolean;
};

export function BlePermissionCard({ state, onRetry, onManualWifi, loading }: Props) {
  if (state === "ready") return null;

  const blocked = state === "permission_blocked";

  return (
    <View style={styles.card}>
      <Ionicons
        name={state === "bluetooth_off" ? "bluetooth-outline" : "alert-circle-outline"}
        size={28}
        color={colors.rosePrimary}
      />
      <AppText variant="titleMedium" center>
        {state === "bluetooth_off" ? "Bluetooth désactivé" : "Autorisation requise"}
      </AppText>
      <AppText variant="bodyMedium" muted center>
        {bleAccessMessage(state)}
      </AppText>
      <View style={styles.actions}>
        <Button label={loading ? "Vérification..." : "Réessayer"} onPress={onRetry} loading={loading} />
        {blocked ? (
          <Button label="Ouvrir les réglages" variant="secondary" onPress={openAppSettings} />
        ) : null}
        {onManualWifi ? (
          <Button label="Saisir le WiFi manuellement" variant="ghost" onPress={onManualWifi} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  actions: {
    width: "100%",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
