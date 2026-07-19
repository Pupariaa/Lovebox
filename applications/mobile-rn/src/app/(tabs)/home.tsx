import { useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button, Card, Screen, StatusPill } from "@/components/ui";
import { ensureBleAccess } from "@/data/ble/blePermissionStatus";
import { useAppStore } from "@/store/appStore";
import { colors, radius, spacing } from "@/theme/theme";
import { deviceLabel, formatDateTime, formatLastSeen, targetLabel } from "@/util/formatters";

export default function HomeScreen() {
  const router = useRouter();
  const loading = useAppStore((s) => s.loading);
  const devices = useAppStore((s) => s.devices);
  const linkedTargets = useAppStore((s) => s.linkedTargets);
  const selectedTarget = useAppStore((s) => s.selectedTarget);
  const userProfile = useAppStore((s) => s.userProfile);
  const history = useAppStore((s) => s.history);
  const refreshState = useAppStore((s) => s.refreshState);
  const loadHistory = useAppStore((s) => s.loadHistory);
  const loadUserProfile = useAppStore((s) => s.loadUserProfile);
  const showSnackbar = useAppStore((s) => s.showSnackbar);

  useFocusEffect(
    useCallback(() => {
      void refreshState();
      void loadHistory();
      void loadUserProfile();
    }, [refreshState, loadHistory, loadUserProfile]),
  );

  const greeting = userProfile?.first_name ? `Bonjour ${userProfile.first_name}` : "Bienvenue";
  const target = selectedTarget ?? linkedTargets[0] ?? null;
  const lastMessage = history[0];

  const openBle = async () => {
    const status = await ensureBleAccess();
    if (!status.canScan) {
      showSnackbar(status.state === "bluetooth_off" ? "Active le Bluetooth." : "Autorisations Bluetooth requises.");
    }
    router.push("/ble");
  };

  return (
    <Screen title={greeting}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              void refreshState(true);
              void loadHistory(true);
            }}
            tintColor={colors.rosePrimary}
          />
        }
      >
        {devices.length === 0 ? (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="cube" size={22} color={colors.rosePrimary} />
              <AppText variant="headlineMedium">Configure ta boîte</AppText>
            </View>
            <AppText variant="bodyMedium" muted style={styles.paragraph}>
              Connecte ta boîte à cœur au WiFi pour commencer à recevoir des petits mots.
            </AppText>
            <Button label="Ajouter une boîte" onPress={openBle} icon={<Ionicons name="bluetooth" size={18} color={colors.onPrimary} />} />
          </Card>
        ) : (
          <>
            {devices.map((device) => (
              <Card key={device.id} onPress={() => router.push(`/device/${device.id}`)} highlight>
                <View style={styles.deviceRow}>
                  <View style={styles.deviceIcon}>
                    <Ionicons name="cube" size={24} color={colors.rosePrimary} />
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="titleMedium">{deviceLabel(device)}</AppText>
                    <StatusPill
                      online={device.online}
                      label={formatLastSeen(device.online, device.last_seen_seconds_ago)}
                    />
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </View>
              </Card>
            ))}
            {devices.length > 1 ? (
              <Button label="Gérer mes boîtes" variant="secondary" onPress={() => router.push("/boxes")} />
            ) : null}
          </>
        )}

        {target ? (
          <Card onPress={() => router.push("/(tabs)/compose")}>
            <AppText variant="caption" muted>
              Prochain message pour
            </AppText>
            <View style={styles.targetRow}>
              <AppText variant="headlineMedium">{targetLabel(target)}</AppText>
              <View style={styles.composeBadge}>
                <Ionicons name="create" size={16} color={colors.onPrimary} />
                <AppText variant="caption" color={colors.onPrimary}>
                  Écrire
                </AppText>
              </View>
            </View>
          </Card>
        ) : (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="heart" size={22} color={colors.rosePrimary} />
              <AppText variant="headlineMedium">Lier un être cher</AppText>
            </View>
            <AppText variant="bodyMedium" muted style={styles.paragraph}>
              Ajoute un être cher pour lui envoyer des mots doux sur sa boîte.
            </AppText>
            <Button
              label="Lier un contact"
              variant="secondary"
              onPress={() => router.push("/(tabs)/contacts")}
            />
          </Card>
        )}

        {lastMessage ? (
          <Card>
            <AppText variant="caption" muted>
              Dernier message envoyé
            </AppText>
            <AppText variant="titleMedium" style={styles.paragraph}>
              {lastMessage.target_device_name}
            </AppText>
            <AppText variant="caption" muted>
              {formatDateTime(lastMessage.created_at)}
            </AppText>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  flex: { flex: 1 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
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
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  composeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.rosePrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
});
