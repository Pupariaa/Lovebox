import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Card, Screen } from "@/components/ui";
import { getMessagePreview } from "@/data/api/ApiClient";
import type { SentMessageDto } from "@/data/api/models";
import { useAppStore } from "@/store/appStore";
import { formatDateTime, targetLabel } from "@/util/formatters";
import { colors, radius, spacing } from "@/theme/theme";

function statusLabel(status?: string): string {
  switch (status) {
    case "seen":
      return "Vu";
    case "opened":
      return "Ouvert";
    case "received":
      return "Reçu";
    case "delivering":
      return "En livraison";
    case "queued":
      return "En attente";
    default:
      return status ?? "";
  }
}

function statusColor(status?: string): string {
  switch (status) {
    case "seen":
      return colors.success;
    case "opened":
      return colors.rosePrimary;
    case "received":
      return colors.textSecondary;
    default:
      return colors.textMuted;
  }
}

function HistoryItem({ item, title }: { item: SentMessageDto; title: string }) {
  const [preview, setPreview] = useState<string | null>(item.preview_base64 ?? null);
  const label = statusLabel(item.status);

  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    (async () => {
      try {
        const base64 = await getMessagePreview(item.id);
        if (!cancelled) setPreview(base64);
      } catch {
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item.id, preview]);

  return (
    <Card>
      <View style={styles.itemRow}>
        <View style={styles.thumb}>
          {preview ? (
            <Image
              source={{ uri: `data:image/png;base64,${preview}` }}
              style={styles.thumbImage}
              contentFit="cover"
            />
          ) : (
            <Ionicons name="image" size={22} color={colors.textMuted} />
          )}
        </View>
        <View style={styles.flex}>
          <AppText variant="titleMedium">{title}</AppText>
          <AppText variant="caption" muted>
            {formatDateTime(item.created_at)}
          </AppText>
          {label ? (
            <AppText variant="caption" style={{ color: statusColor(item.status) }}>
              {label}
            </AppText>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const history = useAppStore((s) => s.history);
  const linkedTargets = useAppStore((s) => s.linkedTargets);
  const loadHistory = useAppStore((s) => s.loadHistory);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory]),
  );

  const labelFor = (item: SentMessageDto): string => {
    const target = linkedTargets.find((t) => t.device_id === item.target_device_id);
    return target ? targetLabel(target) : item.target_device_name;
  };

  return (
    <Screen title="Historique" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content}>
        {history.length === 0 ? (
          <Card>
            <AppText variant="bodyMedium" muted center>
              Aucun message envoyé pour le moment.
            </AppText>
          </Card>
        ) : (
          history.map((item) => (
            <HistoryItem key={item.id} item={item} title={labelFor(item)} />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  flex: { flex: 1 },
  thumb: {
    width: 56,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceDark,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
});
