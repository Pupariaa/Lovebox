import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button, Card, Screen, StatusPill, TextField } from "@/components/ui";
import { useAppStore, useLoading } from "@/store/appStore";
import { copyToClipboard } from "@/util/platform";
import { colors, radius, spacing } from "@/theme/theme";
import { formatLastSeen, targetLabel } from "@/util/formatters";

function formatPairingCodeInput(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.startsWith("LOVE")) {
    const suffix = cleaned.slice(4, 8);
    return suffix.length ? `LOVE-${suffix}` : "LOVE-";
  }
  if (cleaned.length <= 4) {
    return cleaned.length ? `LOVE-${cleaned}` : "";
  }
  return `LOVE-${cleaned.slice(0, 4)}`;
}

export default function ContactsScreen() {
  const loading = useLoading("pairing");
  const pairingCode = useAppStore((s) => s.pairingCode);
  const pairingCodeCopied = useAppStore((s) => s.pairingCodeCopied);
  const linkedTargets = useAppStore((s) => s.linkedTargets);
  const devices = useAppStore((s) => s.devices);
  const myDevice = useAppStore((s) => s.myDevice);
  const selectDevice = useAppStore((s) => s.selectDevice);
  const selectedTarget = useAppStore((s) => s.selectedTarget);
  const generatePairingCode = useAppStore((s) => s.generatePairingCode);
  const markPairingCodeCopied = useAppStore((s) => s.markPairingCodeCopied);
  const acceptPairingCode = useAppStore((s) => s.acceptPairingCode);
  const unlinkTarget = useAppStore((s) => s.unlinkTarget);
  const setTargetAlias = useAppStore((s) => s.setTargetAlias);
  const selectTarget = useAppStore((s) => s.selectTarget);
  const refreshState = useAppStore((s) => s.refreshState);

  const [code, setCode] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [aliasDraft, setAliasDraft] = useState("");

  useFocusEffect(
    useCallback(() => {
      void refreshState();
    }, [refreshState]),
  );

  const onCopy = async () => {
    if (!pairingCode) return;
    await copyToClipboard(pairingCode);
    markPairingCodeCopied();
  };

  const onAccept = async () => {
    if (!code.trim()) return;
    await acceptPairingCode(code.trim());
    setCode("");
  };

  const startEditAlias = (pairingId: number, current: string) => {
    setEditingId(pairingId);
    setAliasDraft(current);
  };

  const saveAlias = async (pairingId: number) => {
    const ok = await setTargetAlias(pairingId, aliasDraft.trim() || null);
    if (ok) setEditingId(null);
  };

  return (
    <Screen title="Contacts">
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <AppText variant="headlineMedium">Partage ton code</AppText>
          <AppText variant="bodyMedium" muted style={styles.paragraph}>
            Génère un code et transmets-le à la personne qui pourra t'écrire.
          </AppText>
          {devices.length > 1 ? (
            <View style={styles.deviceList}>
              <AppText variant="caption" muted>
                Code pour la boîte :
              </AppText>
              {devices.map((device) => (
                <Pressable
                  key={device.id}
                  onPress={() => selectDevice(device.id)}
                  style={[
                    styles.deviceOption,
                    myDevice?.id === device.id && styles.deviceOptionActive,
                  ]}
                >
                  <AppText variant="bodyMedium">{device.display_name || device.device_name}</AppText>
                  {myDevice?.id === device.id ? (
                    <Ionicons name="checkmark" size={18} color={colors.rosePrimary} />
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : null}
          {pairingCode ? (
            <View style={styles.codeBox}>
              <AppText variant="headlineLarge" color={colors.rosePrimary} style={styles.codeText}>
                {pairingCode}
              </AppText>
              <Button
                label={pairingCodeCopied ? "Copié" : "Copier"}
                variant="secondary"
                fullWidth={false}
                onPress={onCopy}
                icon={
                  <Ionicons
                    name={pairingCodeCopied ? "checkmark" : "copy"}
                    size={16}
                    color={colors.textPrimary}
                  />
                }
              />
            </View>
          ) : null}
          <Button
            label="Générer mon code"
            onPress={generatePairingCode}
            loading={loading && !pairingCode}
          />
        </Card>

        <Card>
          <AppText variant="headlineMedium">Ajoute un être cher</AppText>
          <AppText variant="bodyMedium" muted style={styles.paragraph}>
            Entre le code que l'on t'a partagé.
          </AppText>
          <TextField
            value={code}
            onChangeText={(v) => setCode(formatPairingCodeInput(v))}
            placeholder="LOVE-XXXX"
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <View style={styles.spacer} />
          <Button label="Lier ce contact" onPress={onAccept} disabled={!code.trim()} />
        </Card>

        <View style={styles.listHeader}>
          <AppText variant="titleMedium" muted>
            Personnes liées ({linkedTargets.length})
          </AppText>
        </View>

        {linkedTargets.length === 0 ? (
          <Card>
            <AppText variant="bodyMedium" muted center>
              Aucun contact pour le moment.
            </AppText>
          </Card>
        ) : (
          linkedTargets.map((target) => {
            const active = selectedTarget?.device_id === target.device_id;
            const editing = editingId === target.pairing_id;
            return (
              <Pressable key={target.pairing_id} onPress={() => selectTarget(target)}>
                <Card highlight={active}>
                  <View style={styles.targetRow}>
                    <View style={styles.flex}>
                      <AppText variant="titleMedium">{targetLabel(target)}</AppText>
                      <StatusPill
                        online={target.online}
                        label={formatLastSeen(target.online, target.last_seen_seconds_ago)}
                      />
                    </View>
                    {active ? (
                      <View style={styles.activeBadge}>
                        <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                        <AppText variant="caption" color={colors.onPrimary}>
                          Actif
                        </AppText>
                      </View>
                    ) : null}
                    <Pressable
                      hitSlop={10}
                      onPress={() => startEditAlias(target.pairing_id, target.alias ?? "")}
                      style={styles.removeButton}
                    >
                      <Ionicons name="pencil" size={16} color={colors.textMuted} />
                    </Pressable>
                    <Pressable
                      hitSlop={10}
                      onPress={() => unlinkTarget(target.pairing_id)}
                      style={styles.removeButton}
                    >
                      <Ionicons name="close" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                  {editing ? (
                    <View style={styles.aliasEditor}>
                      <TextField
                        value={aliasDraft}
                        onChangeText={setAliasDraft}
                        placeholder="Nom personnalisé (ex : Mon amour)"
                        autoCapitalize="sentences"
                      />
                      <View style={styles.aliasActions}>
                        <Button
                          label="Annuler"
                          variant="secondary"
                          fullWidth={false}
                          onPress={() => setEditingId(null)}
                        />
                        <Button
                          label="Enregistrer"
                          fullWidth={false}
                          onPress={() => saveAlias(target.pairing_id)}
                        />
                      </View>
                    </View>
                  ) : null}
                </Card>
              </Pressable>
            );
          })
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
  flex: { flex: 1 },
  paragraph: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  codeBox: {
    backgroundColor: colors.surfaceDark,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  codeText: {
    letterSpacing: 4,
  },
  spacer: {
    height: spacing.md,
  },
  listHeader: {
    marginTop: spacing.sm,
  },
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.rosePrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  removeButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  aliasEditor: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  aliasActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.md,
  },
  deviceList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
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
});
