import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { AppText, Button, Card, Screen, TextField } from "@/components/ui";
import { migrateContactEmail, setAccountPassword } from "@/data/api/ApiClient";
import { userFacingError } from "@/data/api/errors";
import { useAppStore } from "@/store/appStore";
import { spacing } from "@/theme/theme";

export default function MigrateAccountScreen() {
  const router = useRouter();
  const userProfile = useAppStore((s) => s.userProfile);
  const loadUserProfile = useAppStore((s) => s.loadUserProfile);
  const showSnackbar = useAppStore((s) => s.showSnackbar);

  const [contactEmail, setContactEmail] = useState(userProfile?.contact_email ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const emailValid = contactEmail.includes("@") && contactEmail.includes(".");
  const passwordValid = password.length >= 8;
  const contactVerified = !!userProfile?.contact_email_verified;
  const canSetPassword = !!userProfile?.can_set_password;

  const sendVerification = async () => {
    if (!emailValid || busy) return;
    setBusy(true);
    try {
      await migrateContactEmail(contactEmail.trim());
      setSent(true);
      showSnackbar("E-mail de vérification envoyé.");
    } catch (e) {
      showSnackbar(userFacingError(e));
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async () => {
    if (!passwordValid || busy || !canSetPassword) return;
    setBusy(true);
    try {
      await setAccountPassword(password);
      await loadUserProfile(true);
      showSnackbar("Mot de passe enregistré.");
      router.back();
    } catch (e) {
      showSnackbar(userFacingError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Migration du compte" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <AppText variant="bodyMedium" muted>
            Pour ajouter une connexion par e-mail et mot de passe, confirme d'abord une adresse e-mail de contact
            (adresse Apple masquée non acceptée).
          </AppText>
          <TextField
            label="E-mail de contact"
            value={contactEmail}
            onChangeText={setContactEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!contactVerified}
          />
          {contactVerified ? (
            <AppText variant="caption" muted>
              E-mail de contact vérifié.
            </AppText>
          ) : (
            <Button
              label={sent ? "Renvoyer le lien" : "Envoyer le lien de vérification"}
              onPress={sendVerification}
              loading={busy}
              disabled={!emailValid || busy}
            />
          )}
        </Card>

        {canSetPassword ? (
          <Card>
            <AppText variant="titleMedium">Mot de passe</AppText>
            <TextField
              label="Nouveau mot de passe"
              value={password}
              onChangeText={setPassword}
              secureToggle
              error={password.length > 0 && !passwordValid ? "8 caractères minimum." : undefined}
            />
            <Button
              label="Enregistrer le mot de passe"
              onPress={savePassword}
              loading={busy}
              disabled={!passwordValid || busy}
            />
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
});
