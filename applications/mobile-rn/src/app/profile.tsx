import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Card, Screen, TextField } from "@/components/ui";
import { useAppStore } from "@/store/appStore";
import { spacing } from "@/theme/theme";

export default function ProfileScreen() {
  const router = useRouter();
  const userProfile = useAppStore((s) => s.userProfile);
  const updateUserProfile = useAppStore((s) => s.updateUserProfile);
  const loading = useAppStore((s) => s.loading);

  const [firstName, setFirstName] = useState(userProfile?.first_name ?? "");
  const [lastName, setLastName] = useState(userProfile?.last_name ?? "");
  const [locale, setLocale] = useState(userProfile?.locale ?? "fr");
  const [password, setPassword] = useState("");

  const onSave = async () => {
    const ok = await updateUserProfile({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      locale: locale.trim() || "fr",
      password: password.trim() ? password.trim() : null,
    });
    if (ok) {
      setPassword("");
      router.back();
    }
  };

  return (
    <Screen title="Mon profil" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <TextField label="Email" value={userProfile?.email ?? ""} editable={false} />
          <View style={styles.spacer} />
          <TextField label="Prénom" value={firstName} onChangeText={setFirstName} />
          <View style={styles.spacer} />
          <TextField label="Nom" value={lastName} onChangeText={setLastName} />
          <View style={styles.spacer} />
          <TextField
            label="Langue"
            value={locale}
            onChangeText={setLocale}
            autoCapitalize="none"
            placeholder="fr"
          />
          <View style={styles.spacer} />
          <TextField
            label="Nouveau mot de passe"
            value={password}
            onChangeText={setPassword}
            secureToggle
            placeholder="Laisser vide pour ne pas le changer"
          />
        </Card>
        <Button label="Enregistrer" onPress={onSave} loading={loading} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  spacer: { height: spacing.md },
});
