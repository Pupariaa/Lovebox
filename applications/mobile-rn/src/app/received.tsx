import { useCallback } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Card, Screen } from "@/components/ui";
import type { ReceivedMessageDto } from "@/data/api/models";
import { useAppStore } from "@/store/appStore";
import { formatDateTime } from "@/util/formatters";
import { colors, radius, spacing } from "@/theme/theme";

function senderLabel(item: ReceivedMessageDto): string {
  if (item.sender_first_name && item.sender_first_name.trim()) {
    return `De ${item.sender_first_name.trim()}`;
  }
  return "Message reçu";
}

function ReceivedItem({ item }: { item: ReceivedMessageDto }) {
  const preview = item.preview_base64 ?? null;
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
          <AppText variant="titleMedium">{senderLabel(item)}</AppText>
          <AppText variant="caption" muted>
            Sur {item.device_name}
          </AppText>
          <AppText variant="caption" muted>
            Ouvert le {formatDateTime(item.opened_at ?? item.created_at ?? "")}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

export default function ReceivedScreen() {
  const router = useRouter();
  const received = useAppStore((s) => s.received);
  const loadReceived = useAppStore((s) => s.loadReceived);

  useFocusEffect(
    useCallback(() => {
      void loadReceived();
    }, [loadReceived]),
  );

  return (
    <Screen title="Messages reçus" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content}>
        {received.length === 0 ? (
          <Card>
            <AppText variant="bodyMedium" muted center>
              Aucun message reçu pour le moment. Les messages non éphémères
              apparaissent ici une fois ouverts sur ta boîte.
            </AppText>
          </Card>
        ) : (
          received.map((item) => <ReceivedItem key={item.message_id} item={item} />)
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
