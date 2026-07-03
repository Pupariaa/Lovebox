import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppText, Button, Screen } from "@/components/ui";
import { LEGAL_SECTIONS } from "@/data/legal";
import { colors, spacing } from "@/theme/theme";

export default function LegalScreen() {
  const router = useRouter();
  const { section } = useLocalSearchParams<{ section: string }>();
  const data = LEGAL_SECTIONS[section ?? "legal"] ?? LEGAL_SECTIONS.legal;
  const [page, setPage] = useState(0);
  const lastPage = data.paragraphs.length - 1;
  const current = data.paragraphs[page];

  return (
    <Screen title={data.title} onBack={() => router.back()}>
      <View style={styles.content}>
        <View style={styles.body}>
          <AppText variant="titleMedium" color={colors.rosePrimary}>
            {current.title}
          </AppText>
          <AppText variant="bodyMedium" muted style={styles.paragraph}>
            {current.body}
          </AppText>
        </View>

        <View style={styles.footer}>
          <AppText variant="caption" muted center>
            {page + 1} / {data.paragraphs.length}
          </AppText>
          <View style={styles.buttons}>
            <Button
              label="Précédent"
              variant="secondary"
              onPress={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              style={styles.flexButton}
            />
            <Button
              label={page < lastPage ? "Suivant" : "Fermer"}
              onPress={() => (page < lastPage ? setPage((p) => p + 1) : router.back())}
              style={styles.flexButton}
            />
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: "space-between",
  },
  body: {
    flex: 1,
    justifyContent: "center",
  },
  paragraph: {
    marginTop: spacing.md,
  },
  footer: {
    gap: spacing.md,
  },
  buttons: {
    flexDirection: "row",
    gap: spacing.md,
  },
  flexButton: {
    flex: 1,
  },
});
