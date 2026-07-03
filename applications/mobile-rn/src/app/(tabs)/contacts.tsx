import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button, Card, Screen, StatusPill, TextField } from "@/components/ui";
import { useAppStore } from "@/store/appStore";
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
  const loading = useAppStore((s) => s.loading);
  const pairingCode = useAppStore((s) => s.pairingCode);
  const pairingCodeCopied = useAppStore((s) => s.pairingCodeCopied);
  const linkedTargets = useAppStore((s) => s.linkedTargets);
  const selectedTarget = useAppStore((s) => s.selectedTarget);
  const generatePairingCode = useAppStore((s) => s.generatePairingCode);
  const markPairingCodeCopied = useAppStore((s) => s.markPairingCodeCopied);
  const acceptPairingCode = useAppStore((s) => s.acceptPairingCode);
  const unlinkTarget = useAppStore((s) => s.unlinkTarget);
  const selectTarget = useAppStore((s) => s.selectTarget);
  const refreshState = useAppStore((s) => s.refreshState);

  const [code, setCode] = useState("");

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

  return (
    <Screen title="Contacts">
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <AppText variant="headlineMedium">Partage ton code</AppText>
          <AppText variant="bodyMedium" muted style={styles.paragraph}>
            Génère un code et transmets-le à la personne qui pourra t&apos;écrire.
          </AppText>
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
            Entre le code que l&apos;on t&apos;a partagé.
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
                      onPress={() => unlinkTarget(target.pairing_id)}
                      style={styles.removeButton}
                    >
                      <Ionicons name="close" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
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
});
