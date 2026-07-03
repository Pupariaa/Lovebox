import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppText, Button, Card, Screen, StatusPill } from "@/components/ui";
import { useAppStore } from "@/store/appStore";
import { deviceLabel, formatLastSeen } from "@/util/formatters";
import { colors, spacing } from "@/theme/theme";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="bodyMedium" muted>
        {label}
      </AppText>
      <AppText variant="bodyMedium" style={styles.value}>
        {value}
      </AppText>
    </View>
  );
}

export default function DeviceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const devices = useAppStore((s) => s.devices);
  const unclaimDevice = useAppStore((s) => s.unclaimDevice);
  const loading = useAppStore((s) => s.loading);

  const device = devices.find((d) => String(d.id) === id) ?? null;

  const onUnclaim = () => {
    if (!device) return;
    Alert.alert(
      "Dissocier cette boîte",
      "La boîte ne sera plus liée à ton compte.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Dissocier",
          style: "destructive",
          onPress: async () => {
            const ok = await unclaimDevice(device.id);
            if (ok) router.back();
          },
        },
      ],
    );
  };

  return (
    <Screen title="Détails de la boîte" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content}>
        {device ? (
          <>
            <Card>
              <InfoRow label="Nom affiché" value={deviceLabel(device)} />
              <InfoRow label="Nom usine" value={device.device_name} />
              <InfoRow label="Numéro de série" value={device.serial_number || "-"} />
              <InfoRow label="Région" value={device.region ?? device.region_override ?? "Auto"} />
              <InfoRow label="Firmware" value={device.firmware_version ?? "-"} />
              <View style={styles.row}>
                <AppText variant="bodyMedium" muted>
                  Statut
                </AppText>
                <StatusPill
                  online={device.online}
                  label={formatLastSeen(device.online, device.last_seen_seconds_ago)}
                />
              </View>
            </Card>
            <Button label="Dissocier cette boîte" variant="danger" onPress={onUnclaim} loading={loading} />
          </>
        ) : (
          <Card>
            <AppText variant="bodyMedium" muted center>
              Boîte introuvable.
            </AppText>
          </Card>
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
  },
  value: {
    flexShrink: 1,
    textAlign: "right",
    marginLeft: spacing.lg,
  },
});
