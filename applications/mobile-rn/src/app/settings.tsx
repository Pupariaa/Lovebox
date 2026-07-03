import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button, Card, Screen, TextField } from "@/components/ui";
import { useAppStore } from "@/store/appStore";
import { COMMON_REGIONS, deviceLabel } from "@/util/formatters";
import { colors, radius, spacing } from "@/theme/theme";

export default function SettingsScreen() {
  const router = useRouter();
  const devices = useAppStore((s) => s.devices);
  const myDevice = useAppStore((s) => s.myDevice);
  const selectDevice = useAppStore((s) => s.selectDevice);
  const updateDeviceSettings = useAppStore((s) => s.updateDeviceSettings);
  const loading = useAppStore((s) => s.loading);

  const [displayName, setDisplayName] = useState(myDevice?.display_name ?? "");
  const [region, setRegion] = useState(myDevice?.region_override ?? "");
  const [regionOpen, setRegionOpen] = useState(false);

  const regionLabel = COMMON_REGIONS.find((r) => r.code === region)?.label ?? "Automatique";

  const onSave = async () => {
    await updateDeviceSettings(displayName, region);
  };

  return (
    <Screen title="Réglages de la boîte" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content}>
        {devices.length > 1 ? (
          <Card>
            <AppText variant="labelLarge" muted>
              Boîte
            </AppText>
            <View style={styles.deviceList}>
              {devices.map((device) => (
                <Pressable
                  key={device.id}
                  onPress={() => {
                    selectDevice(device.id);
                    setDisplayName(device.display_name ?? "");
                    setRegion(device.region_override ?? "");
                  }}
                  style={[
                    styles.deviceOption,
                    myDevice?.id === device.id && styles.deviceOptionActive,
                  ]}
                >
                  <AppText variant="bodyMedium">{deviceLabel(device)}</AppText>
                  {myDevice?.id === device.id ? (
                    <Ionicons name="checkmark" size={18} color={colors.rosePrimary} />
                  ) : null}
                </Pressable>
              ))}
            </View>
          </Card>
        ) : null}

        <Card>
          <TextField
            label="Nom affiché"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Ma boîte"
          />
          <View style={styles.spacer} />
          <AppText variant="labelLarge" muted style={styles.regionLabel}>
            Région
          </AppText>
          <Pressable style={styles.dropdown} onPress={() => setRegionOpen((v) => !v)}>
            <AppText variant="bodyLarge">{regionLabel}</AppText>
            <Ionicons name={regionOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
          </Pressable>
          {regionOpen ? (
            <View style={styles.regionList}>
              {COMMON_REGIONS.map((r) => (
                <Pressable
                  key={r.code || "auto"}
                  style={styles.regionOption}
                  onPress={() => {
                    setRegion(r.code);
                    setRegionOpen(false);
                  }}
                >
                  <AppText variant="bodyMedium" color={region === r.code ? colors.rosePrimary : colors.textPrimary}>
                    {r.label}
                  </AppText>
                </Pressable>
              ))}
            </View>
          ) : null}
          <AppText variant="caption" muted style={styles.helper}>
            Les réglages sont aussi poussés via Bluetooth si la boîte est à proximité.
          </AppText>
        </Card>

        <Button label="Enregistrer" onPress={onSave} loading={loading} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  deviceList: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  deviceOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surfaceDark,
  },
  deviceOptionActive: {
    borderColor: colors.rosePrimary,
  },
  spacer: { height: spacing.md },
  regionLabel: { marginLeft: spacing.xs, marginBottom: spacing.xs },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surfaceDark,
  },
  regionList: {
    marginTop: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.outline,
    overflow: "hidden",
  },
  regionOption: {
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
  },
  helper: {
    marginTop: spacing.md,
  },
});
