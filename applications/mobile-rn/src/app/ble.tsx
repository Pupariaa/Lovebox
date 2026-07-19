import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BlePermissionCard } from "@/components/ble/BlePermissionCard";
import { AppText, Button, Card, Screen, TextField } from "@/components/ui";
import { WifiQrScanner } from "@/components/wifi/WifiQrScanner";
import {
  ensureBleAccess,
  type BleAccessState,
} from "@/data/ble/blePermissionStatus";
import {
  getCurrentWifiSsid,
  openAppSettings as openWifiSettings,
  requestWifiSsidPermission,
  wifiSsidStatusMessage,
  type WifiSsidStatus,
} from "@/domain/wifi/wifiCurrent";
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
  const [bleAccess, setBleAccess] = useState<BleAccessState>("ready");
  const [wifiStatus, setWifiStatus] = useState<WifiSsidStatus>("ok");
  const [selected, setSelected] = useState<{ name: string; address: string } | null>(null);
  const [ssid, setSsid] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [ssidPrefilled, setSsidPrefilled] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);

  const refreshBleAccess = async (scanAfter = false) => {
    const status = await ensureBleAccess();
    setBleAccess(status.state);
    if (status.canScan && scanAfter) void scanBle();
    return status;
  };

  useEffect(() => {
    resetBleProvision();
    void refreshBleAccess(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step !== "credentials") return;
    (async () => {
      const { ssid: current, status } = await getCurrentWifiSsid();
      setWifiStatus(status);
      if (current) {
        setSsid(current);
        setSsidPrefilled(true);
      }
    })();
  }, [step]);

  const startProvision = async () => {
    if (!selected) return;
    setStep("provisioning");
    const success = await provisionBle(selected.address, selected.name, ssid.trim(), password);
    setStep("result");
    if (!success) return;
    showSnackbar("Boîte configurée.");
  };

  const retry = async () => {
    setStep("provisioning");
    const ok = await retryClaim();
    setStep("result");
    if (ok) showSnackbar("Boîte associée.");
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
                Active le mode configuration sur ta boîte, puis lance la recherche.
              </AppText>
              {bleAccess !== "ready" ? (
                <BlePermissionCard
                  state={bleAccess}
                  onRetry={() => void refreshBleAccess(true)}
                  loading={loading}
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

            {bleAccess === "ready" && !loading && bleDevices.length === 0 ? (
              <Card>
                <AppText variant="bodyMedium" muted center>
                  Aucune boîte trouvée. Vérifie que ta boîte est en mode configuration et proche de ton téléphone.
                </AppText>
              </Card>
            ) : null}

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
              {ssidPrefilled ? " Le réseau actuel du téléphone a été pré-rempli." : ""}
            </AppText>
            {!ssidPrefilled && wifiStatus !== "ok" ? (
              <View style={styles.wifiHint}>
                <AppText variant="caption" muted>
                  {wifiSsidStatusMessage(wifiStatus)}
                </AppText>
                {wifiStatus === "location_denied" ? (
                  <Button
                    label="Autoriser la localisation"
                    variant="secondary"
                    onPress={async () => {
                      const next = await requestWifiSsidPermission();
                      setWifiStatus(next);
                      if (next === "ok") {
                        const { ssid: current, status } = await getCurrentWifiSsid();
                        setWifiStatus(status);
                        if (current) {
                          setSsid(current);
                          setSsidPrefilled(true);
                        }
                      }
                    }}
                  />
                ) : null}
                {wifiStatus === "location_blocked" ? (
                  <Button label="Ouvrir les réglages" variant="secondary" onPress={openWifiSettings} />
                ) : null}
              </View>
            ) : null}
            <TextField label="Nom du réseau (SSID)" value={ssid} onChangeText={setSsid} autoCapitalize="none" />
            <View style={styles.spacer} />
            <TextField label="Mot de passe" value={password} onChangeText={setPassword} secureToggle />
            <View style={styles.spacer} />
            <Button
              label="Scanner le QR WiFi"
              variant="secondary"
              onPress={() => setQrVisible(true)}
              icon={<Ionicons name="qr-code-outline" size={16} color={colors.rosePrimary} />}
            />
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
      <WifiQrScanner
        visible={qrVisible}
        onClose={() => setQrVisible(false)}
        onScanned={({ ssid: scannedSsid, password: scannedPassword }) => {
          setSsid(scannedSsid);
          setPassword(scannedPassword);
          setSsidPrefilled(false);
          showSnackbar("QR WiFi lu.");
        }}
      />
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
  wifiHint: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
});
