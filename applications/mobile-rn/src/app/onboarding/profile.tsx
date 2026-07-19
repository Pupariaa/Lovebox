import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AppText, Button, Card, Screen, TextField } from "@/components/ui";
import { useAppStore } from "@/store/appStore";
import { spacing } from "@/theme/theme";

export default function OnboardingProfileScreen() {
  const router = useRouter();
  const userProfile = useAppStore((s) => s.userProfile);
  const updateUserProfile = useAppStore((s) => s.updateUserProfile);
  const loading = useAppStore((s) => s.loading);

  const [firstName, setFirstName] = useState(userProfile?.first_name ?? "");

  const valid = firstName.trim().length >= 2;

  const submit = async () => {
    if (!valid) return;
    const ok = await updateUserProfile({ firstName: firstName.trim() });
    if (ok) router.replace("/(tabs)/home");
  };

  return (
    <Screen title="Bienvenue">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <View style={styles.intro}>
            <AppText variant="titleMedium">Comment t&apos;appelles-tu ?</AppText>
            <AppText variant="bodyMedium" muted>
              Ton prénom sera visible par les personnes qui t&apos;envoient des messages.
            </AppText>
          </View>
          <TextField
            label="Prénom"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            autoComplete="given-name"
            error={firstName.length > 0 && !valid ? "Prénom trop court." : undefined}
          />
          <Button
            label="Continuer"
            onPress={submit}
            loading={loading}
            disabled={!valid || loading}
            style={styles.continue}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  card: {
    gap: spacing.lg,
  },
  intro: {
    gap: spacing.sm,
  },
  continue: {
    marginTop: spacing.md,
  },
});
