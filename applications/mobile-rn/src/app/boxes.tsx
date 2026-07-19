import { useCallback } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button, Card, Screen, StatusPill } from "@/components/ui";
import { bleAccessMessage, ensureBleAccess } from "@/data/ble/blePermissionStatus";
import { useAppStore } from "@/store/appStore";
import { colors, radius, spacing } from "@/theme/theme";
import { deviceLabel, formatLastSeen } from "@/util/formatters";

export default function BoxesScreen() {
  const router = useRouter();
  const devices = useAppStore((s) => s.devices);
  const refreshState = useAppStore((s) => s.refreshState);
  const showSnackbar = useAppStore((s) => s.showSnackbar);

  useFocusEffect(
    useCallback(() => {
      void refreshState();
    }, [refreshState]),
  );

  const openBle = async () => {
    const status = await ensureBleAccess();
    if (!status.canScan) {
      showSnackbar(bleAccessMessage(status.state) || "Autorisations Bluetooth requises.");
      return;
    }
    router.push("/ble");
  };

  return (
    <Screen title="Mes boîtes" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content}>
        {devices.length === 0 ? (
          <Card>
            <AppText variant="bodyMedium" muted style={styles.paragraph}>
              Aucune boîte n'est liée à ton compte. Configure une première boîte pour recevoir des messages.
            </AppText>
            <Button
              label="Ajouter une boîte"
              onPress={openBle}
              icon={<Ionicons name="bluetooth" size={18} color={colors.onPrimary} />}
            />
          </Card>
        ) : (
          <>
            <AppText variant="bodyMedium" muted>
              {devices.length === 1
                ? "Tu as une boîte liée à ton compte."
                : `Tu as ${devices.length} boîtes liées à ton compte.`}
            </AppText>
            {devices.map((device) => (
              <Card key={device.id} onPress={() => router.push(`/device/${device.id}`)} highlight>
                <View style={styles.deviceRow}>
                  <View style={styles.deviceIcon}>
                    <Ionicons name="cube" size={24} color={colors.rosePrimary} />
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="titleMedium">{deviceLabel(device)}</AppText>
                    <AppText variant="caption" muted>
                      {device.serial_number || device.device_name}
                    </AppText>
                    <StatusPill
                      online={device.online}
                      label={formatLastSeen(device.online, device.last_seen_seconds_ago)}
                    />
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </View>
              </Card>
            ))}
            <Button
              label="Ajouter une boîte"
              variant="secondary"
              onPress={openBle}
              icon={<Ionicons name="add" size={18} color={colors.textPrimary} />}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  flex: { flex: 1, gap: spacing.xs },
  paragraph: {
    marginBottom: spacing.lg,
  },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  deviceIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceDark,
    alignItems: "center",
    justifyContent: "center",
  },
});
