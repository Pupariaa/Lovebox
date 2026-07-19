import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button, Card, Screen, TextField } from "@/components/ui";
import { requestPasswordReset } from "@/data/api/ApiClient";
import { userFacingError } from "@/data/api/errors";
import { useAppStore } from "@/store/appStore";
import { colors, spacing } from "@/theme/theme";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const showSnackbar = useAppStore((s) => s.showSnackbar);

  const [email, setEmail] = useState(params.email ?? "");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const emailValid = email.includes("@") && email.includes(".");

  const submit = async () => {
    if (!emailValid || busy) return;
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (e) {
      showSnackbar(userFacingError(e, "Erreur réseau, réessayez."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Mot de passe oublié" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {sent ? (
          <Card>
            <View style={styles.sentIcon}>
              <Ionicons name="mail-open" size={28} color={colors.rosePrimary} />
            </View>
            <AppText variant="titleMedium" center>
              Vérifie tes e-mails
            </AppText>
            <AppText variant="bodyMedium" muted center>
              Si un compte existe pour {email}, un lien de réinitialisation vient d&apos;être envoyé.
              Pense à regarder dans tes spams.
            </AppText>
            <Button label="Revenir à la connexion" onPress={() => router.back()} />
          </Card>
        ) : (
          <Card>
            <AppText variant="bodyMedium" muted>
              Entre ton adresse e-mail : nous t&apos;enverrons un lien pour choisir un nouveau mot de passe.
            </AppText>
            <TextField
              label="Adresse e-mail"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <View style={styles.spacer} />
            <Button
              label="Envoyer le lien"
              onPress={submit}
              loading={busy}
              disabled={!emailValid || busy}
            />
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
  sentIcon: {
    alignSelf: "center",
    marginBottom: spacing.xs,
  },
  spacer: {
    height: spacing.md,
  },
});
