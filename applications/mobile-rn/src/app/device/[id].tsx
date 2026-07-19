import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button, Card, Screen, Slider, StatusPill, TextField } from "@/components/ui";
import { ensureBleAccess } from "@/data/ble/blePermissionStatus";
import { useAppStore } from "@/store/appStore";
import { COMMON_REGIONS, DEVICE_LOCALES, deviceLabel, formatLastSeen } from "@/util/formatters";
import { colors, radius, spacing } from "@/theme/theme";

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

type HardwareSettings = {
  displayName: string;
  regionOverride: string;
  locale: string;
  backlightLevel: number;
  sleepTimeoutSec: number;
  displaySleepEnabled: boolean;
};

export default function DeviceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const devices = useAppStore((s) => s.devices);
  const userProfile = useAppStore((s) => s.userProfile);
  const selectDevice = useAppStore((s) => s.selectDevice);
  const saveDeviceSettings = useAppStore((s) => s.saveDeviceSettings);
  const pushBoxSettingsLive = useAppStore((s) => s.pushBoxSettingsLive);
  const unclaimDevice = useAppStore((s) => s.unclaimDevice);
  const resetAndDeleteDevice = useAppStore((s) => s.resetAndDeleteDevice);
  const loading = useAppStore((s) => s.loading);
  const showSnackbar = useAppStore((s) => s.showSnackbar);

  const device = devices.find((d) => String(d.id) === id) ?? null;

  const [displayName, setDisplayName] = useState("");
  const [locale, setLocale] = useState("fr");
  const [localeOpen, setLocaleOpen] = useState(false);
  const [region, setRegion] = useState("");
  const [regionOpen, setRegionOpen] = useState(false);
  const [backlightLevel, setBacklightLevel] = useState(100);
  const [sleepTimeoutSec, setSleepTimeoutSec] = useState("30");
  const [displaySleepEnabled, setDisplaySleepEnabled] = useState(true);

  const livePushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardwareRef = useRef<HardwareSettings>({
    displayName: "",
    regionOverride: "",
    locale: "fr",
    backlightLevel: 100,
    sleepTimeoutSec: 30,
    displaySleepEnabled: true,
  });

  const syncForm = useCallback(() => {
    if (!device) return;
    setDisplayName(device.display_name ?? "");
    setLocale(device.locale ?? userProfile?.locale ?? "fr");
    setRegion(device.region_override ?? "");
  }, [device, userProfile?.locale]);

  useFocusEffect(
    useCallback(() => {
      if (device) selectDevice(device.id);
      syncForm();
    }, [device, selectDevice, syncForm]),
  );

  useEffect(() => {
    syncForm();
  }, [syncForm]);

  useEffect(() => {
    hardwareRef.current = {
      displayName: displayName.trim(),
      regionOverride: region.trim(),
      locale: locale.trim() || "fr",
      backlightLevel,
      sleepTimeoutSec: Number(sleepTimeoutSec),
      displaySleepEnabled,
    };
  }, [backlightLevel, displayName, displaySleepEnabled, locale, region, sleepTimeoutSec]);

  useEffect(() => {
    return () => {
      if (livePushTimer.current) clearTimeout(livePushTimer.current);
    };
  }, []);

  const localeLabel = DEVICE_LOCALES.find((entry) => entry.code === locale)?.label ?? "Français";
  const regionLabel = COMMON_REGIONS.find((r) => r.code === region)?.label ?? "Automatique";
  const sleepValid = Number(sleepTimeoutSec) >= 5 && Number(sleepTimeoutSec) <= 600;

  const queueLiveHardwarePush = useCallback(
    (patch: Partial<HardwareSettings>) => {
      if (!device) return;
      const next = { ...hardwareRef.current, ...patch };
      hardwareRef.current = next;
      if (livePushTimer.current) clearTimeout(livePushTimer.current);
      livePushTimer.current = setTimeout(() => {
        void pushBoxSettingsLive(device.id, next);
      }, 100);
    },
    [device, pushBoxSettingsLive],
  );

  const onBacklightChange = (value: number) => {
    setBacklightLevel(value);
    queueLiveHardwarePush({ backlightLevel: value });
  };

  const onDisplaySleepChange = (value: boolean) => {
    setDisplaySleepEnabled(value);
    queueLiveHardwarePush({ displaySleepEnabled: value });
  };

  const openBle = async () => {
    const status = await ensureBleAccess();
    if (!status.canScan) {
      showSnackbar(
        status.state === "bluetooth_off" ? "Active le Bluetooth." : "Autorisations Bluetooth requises.",
      );
    }
    router.push("/ble");
  };

  const onSave = async () => {
    if (!device || !sleepValid) return;
    await saveDeviceSettings(device.id, {
      displayName: displayName.trim(),
      regionOverride: region.trim(),
      locale: locale.trim() || "fr",
      backlightLevel,
      sleepTimeoutSec: Number(sleepTimeoutSec),
      displaySleepEnabled,
    });
  };

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
            if (ok) router.replace("/boxes");
          },
        },
      ],
    );
  };

  const onReset = () => {
    if (!device) return;
    Alert.alert(
      "Réinitialiser cette boîte",
      "La boîte sera réinitialisée en usine et supprimée définitivement. Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Réinitialiser",
          style: "destructive",
          onPress: async () => {
            const ok = await resetAndDeleteDevice(device.id);
            if (ok) router.replace("/boxes");
          },
        },
      ],
    );
  };

  return (
    <Screen title={device ? deviceLabel(device) : "Boîte"} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {device ? (
          <>
            <Card style={styles.section}>
              <AppText variant="labelLarge" muted>
                État
              </AppText>
              <InfoRow label="Nom usine" value={device.device_name} />
              <InfoRow label="Numéro de série" value={device.serial_number || "-"} />
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

            <Card style={styles.section}>
              <AppText variant="titleMedium">Personnalisation</AppText>
              <AppText variant="caption" muted>
                Le nom affiché, la langue et la région sont synchronisés avec la boîte lors de l'enregistrement.
              </AppText>
              <TextField
                label="Nom affiché"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Ma boîte"
              />
              <AppText variant="labelLarge" muted style={styles.regionLabel}>
                Langue
              </AppText>
              <Pressable style={styles.dropdown} onPress={() => setLocaleOpen((v) => !v)}>
                <AppText variant="bodyLarge">{localeLabel}</AppText>
                <Ionicons
                  name={localeOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.textMuted}
                />
              </Pressable>
              {localeOpen ? (
                <View style={styles.regionList}>
                  {DEVICE_LOCALES.map((entry) => (
                    <Pressable
                      key={entry.code}
                      style={styles.regionOption}
                      onPress={() => {
                        setLocale(entry.code);
                        setLocaleOpen(false);
                      }}
                    >
                      <AppText
                        variant="bodyMedium"
                        color={locale === entry.code ? colors.rosePrimary : colors.textPrimary}
                      >
                        {entry.label}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <AppText variant="labelLarge" muted style={styles.regionLabel}>
                Région
              </AppText>
              <Pressable style={styles.dropdown} onPress={() => setRegionOpen((v) => !v)}>
                <AppText variant="bodyLarge">{regionLabel}</AppText>
                <Ionicons
                  name={regionOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.textMuted}
                />
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
                      <AppText
                        variant="bodyMedium"
                        color={region === r.code ? colors.rosePrimary : colors.textPrimary}
                      >
                        {r.label}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </Card>

            <Card style={styles.section}>
              <AppText variant="titleMedium">Matériel</AppText>
              <AppText variant="caption" muted>
                La luminosité est appliquée en direct via Bluetooth si la boîte est à proximité. Enregistre pour
                synchroniser le cloud.
              </AppText>
              <Slider label="Luminosité" value={backlightLevel} onValueChange={onBacklightChange} />
              <TextField
                label="Délai veille (secondes)"
                value={sleepTimeoutSec}
                onChangeText={setSleepTimeoutSec}
                keyboardType="number-pad"
                error={!sleepValid ? "Valeur entre 5 et 600." : undefined}
              />
              <View style={styles.switchRow}>
                <View style={styles.switchCopy}>
                  <AppText variant="bodyMedium">Éteindre l'écran en veille</AppText>
                  <AppText variant="caption" muted>
                    {displaySleepEnabled
                      ? "L'écran s'éteint après le délai d'inactivité."
                      : "L'écran reste allumé en veille."}
                  </AppText>
                </View>
                <Switch
                  value={displaySleepEnabled}
                  onValueChange={onDisplaySleepChange}
                  trackColor={{ true: colors.rosePrimary, false: colors.outline }}
                  thumbColor={colors.creamHighlight}
                />
              </View>
            </Card>

            <Card style={styles.section}>
              <AppText variant="titleMedium">Connexion</AppText>
              <AppText variant="bodyMedium" muted>
                Reconfigure le WiFi ou associe une nouvelle boîte via Bluetooth.
              </AppText>
              <Button
                label="Configurer le WiFi"
                variant="secondary"
                onPress={openBle}
                icon={<Ionicons name="bluetooth" size={16} color={colors.textPrimary} />}
              />
            </Card>

            <Button
              label="Enregistrer"
              onPress={onSave}
              loading={loading}
              disabled={!sleepValid || loading}
            />

            <Card style={styles.section}>
              <AppText variant="titleMedium">Zone sensible</AppText>
              <AppText variant="caption" muted>
                Dissocier retire la boîte de ton compte sans la réinitialiser. Réinitialiser efface toutes les
                données et supprime la boîte du serveur.
              </AppText>
              <View style={styles.dangerActions}>
                <Button label="Dissocier cette boîte" variant="danger" onPress={onUnclaim} loading={loading} />
                <Button
                  label="Réinitialiser et supprimer"
                  variant="danger"
                  onPress={onReset}
                  loading={loading}
                />
              </View>
            </Card>
          </>
        ) : (
          <Card>
            <AppText variant="bodyMedium" muted center>
              Boîte introuvable.
            </AppText>
            <Button label="Voir mes boîtes" onPress={() => router.replace("/boxes")} />
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
  section: {
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
  regionLabel: {
    marginLeft: spacing.xs,
  },
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
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  switchCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  dangerActions: {
    gap: spacing.md,
  },
});
