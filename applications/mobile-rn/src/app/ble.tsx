import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button, Card, Screen, TextField } from "@/components/ui";
import { AppConfig } from "@/config/AppConfig";
import { requestBluetoothPermissions } from "@/data/ble/permissions";
import { BleProvisionPhase, useAppStore } from "@/store/appStore";
import { colors, spacing } from "@/theme/theme";

type Step = "scan" | "credentials" | "provisioning" | "result";

const PHASE_STEPS: { phase: BleProvisionPhase; label: string }[] = [
  { phase: BleProvisionPhase.Connecting, label: "Connexion Bluetooth" },
  { phase: BleProvisionPhase.SendingWifi, label: "Envoi du WiFi" },
  { phase: BleProvisionPhase.WaitingForBox, label: "Connexion WiFi de la boîte" },
  { phase: BleProvisionPhase.LinkingAccount, label: "Association au compte" },
];

const PHASE_ORDER: BleProvisionPhase[] = [
  BleProvisionPhase.Connecting,
  BleProvisionPhase.SendingWifi,
  BleProvisionPhase.WaitingForBox,
  BleProvisionPhase.LinkingAccount,
  BleProvisionPhase.Success,
];

export default function BleScreen() {
  const router = useRouter();
  const loading = useAppStore((s) => s.loading);
  const bleDevices = useAppStore((s) => s.bleDevices);
  const scanBle = useAppStore((s) => s.scanBle);
  const provisionBle = useAppStore((s) => s.provisionBle);
  const resetBleProvision = useAppStore((s) => s.resetBleProvision);
  const retryClaim = useAppStore((s) => s.retryClaimAfterProvision);
  const phase = useAppStore((s) => s.bleProvisionPhase);
  const provisionError = useAppStore((s) => s.bleProvisionError);
  const wifiProvisioned = useAppStore((s) => s.bleWifiProvisioned);
  const showSnackbar = useAppStore((s) => s.showSnackbar);

  const [step, setStep] = useState<Step>("scan");
  const [permission, setPermission] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<{ name: string; address: string } | null>(null);
  const [ssid, setSsid] = useState<string>(AppConfig.DEV_WIFI_SSID);
  const [password, setPassword] = useState<string>(AppConfig.DEV_WIFI_PASSWORD);

  useEffect(() => {
    resetBleProvision();
    (async () => {
      const granted = await requestBluetoothPermissions();
      setPermission(granted);
      if (granted) void scanBle();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startProvision = async () => {
    if (!selected) return;
    setStep("provisioning");
    const success = await provisionBle(selected.address, selected.name, ssid.trim(), password);
    setStep("result");
    if (!success) return;
    showSnackbar("Boîte configurée");
  };

  const retry = async () => {
    setStep("provisioning");
    const ok = await retryClaim();
    setStep("result");
    if (ok) showSnackbar("Boîte associée");
  };

  const activePhaseIndex = PHASE_ORDER.indexOf(phase);

  return (
    <Screen
      title="Configurer le WiFi"
      onBack={phase === BleProvisionPhase.Connecting || phase === BleProvisionPhase.SendingWifi || phase === BleProvisionPhase.WaitingForBox ? undefined : () => router.back()}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {step === "scan" ? (
          <>
            <Card>
              <AppText variant="headlineMedium">Trouve ta boîte</AppText>
              <AppText variant="bodyMedium" muted style={styles.paragraph}>
                Active le mode configuration sur ta boîte puis lance la recherche.
              </AppText>
              {permission === false ? (
                <Button
                  label="Autoriser le Bluetooth"
                  onPress={async () => {
                    const granted = await requestBluetoothPermissions();
                    setPermission(granted);
                    if (granted) void scanBle();
                  }}
                />
              ) : (
                <Button
                  label={loading ? "Recherche..." : "Rechercher"}
                  onPress={scanBle}
                  loading={loading}
                  icon={<Ionicons name="search" size={16} color={colors.onPrimary} />}
                />
              )}
            </Card>

            {bleDevices.map((device) => (
              <Card
                key={device.address}
                highlight={selected?.address === device.address}
                onPress={() => setSelected(device)}
              >
                <View style={styles.deviceRow}>
                  <Ionicons name="bluetooth" size={20} color={colors.rosePrimary} />
                  <AppText variant="titleMedium" style={styles.flex}>
                    {device.name}
                  </AppText>
                  {selected?.address === device.address ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.rosePrimary} />
                  ) : null}
                </View>
              </Card>
            ))}

            {selected ? (
              <Button label="Continuer" onPress={() => setStep("credentials")} />
            ) : null}
          </>
        ) : null}

        {step === "credentials" ? (
          <Card>
            <AppText variant="headlineMedium">Réseau WiFi</AppText>
            <AppText variant="bodyMedium" muted style={styles.paragraph}>
              Boîte sélectionnée : {selected?.name}. Le WiFi doit être en 2,4 GHz.
            </AppText>
            <TextField label="Nom du réseau (SSID)" value={ssid} onChangeText={setSsid} autoCapitalize="none" />
            <View style={styles.spacer} />
            <TextField label="Mot de passe" value={password} onChangeText={setPassword} secureToggle />
            <View style={styles.spacer} />
            <Button label="Configurer" onPress={startProvision} disabled={!ssid.trim()} />
          </Card>
        ) : null}

        {step === "provisioning" ? (
          <Card>
            <AppText variant="headlineMedium">Configuration en cours</AppText>
            <View style={styles.steps}>
              {PHASE_STEPS.map((item) => {
                const idx = PHASE_ORDER.indexOf(item.phase);
                const done = activePhaseIndex > idx;
                const active = phase === item.phase;
                return (
                  <View key={item.phase} style={styles.stepRow}>
                    {active ? (
                      <ActivityIndicator size="small" color={colors.rosePrimary} />
                    ) : (
                      <Ionicons
                        name={done ? "checkmark-circle" : "ellipse-outline"}
                        size={20}
                        color={done ? colors.success : colors.textMuted}
                      />
                    )}
                    <AppText variant="bodyMedium" color={active ? colors.textPrimary : colors.textMuted}>
                      {item.label}
                    </AppText>
                  </View>
                );
              })}
            </View>
          </Card>
        ) : null}

        {step === "result" ? (
          <Card>
            {phase === BleProvisionPhase.Success ? (
              <View style={styles.resultCenter}>
                <Ionicons name="checkmark-circle" size={56} color={colors.success} />
                <AppText variant="headlineMedium" center>
                  Boîte configurée
                </AppText>
                <AppText variant="bodyMedium" muted center>
                  Ta boîte est connectée et associée à ton compte.
                </AppText>
                <Button label="Terminer" onPress={() => router.replace("/(tabs)/home")} />
              </View>
            ) : (
              <View style={styles.resultCenter}>
                <Ionicons
                  name={wifiProvisioned ? "time" : "alert-circle"}
                  size={56}
                  color={wifiProvisioned ? colors.rosePrimary : colors.danger}
                />
                <AppText variant="headlineMedium" center>
                  {wifiProvisioned ? "Association en attente" : "Échec de la configuration"}
                </AppText>
                <AppText variant="bodyMedium" muted center>
                  {provisionError ?? "Une erreur est survenue."}
                </AppText>
                {wifiProvisioned ? (
                  <Button label="Réessayer l'association" onPress={retry} loading={loading} />
                ) : (
                  <Button
                    label="Recommencer"
                    onPress={() => {
                      resetBleProvision();
                      setStep("scan");
                    }}
                  />
                )}
                <Pressable onPress={() => router.back()}>
                  <AppText variant="labelLarge" color={colors.textMuted}>
                    Annuler
                  </AppText>
                </Pressable>
              </View>
            )}
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
  paragraph: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  spacer: {
    height: spacing.md,
  },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  steps: {
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  resultCenter: {
    alignItems: "center",
    gap: spacing.md,
  },
});
