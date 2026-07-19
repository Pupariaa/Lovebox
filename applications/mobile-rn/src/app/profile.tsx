import { useState } from "react";

import { ScrollView, StyleSheet, View } from "react-native";

import { useRouter } from "expo-router";

import { AppText, Button, Card, Screen, TextField } from "@/components/ui";

import { useAppStore, useLoading } from "@/store/appStore";

import { spacing } from "@/theme/theme";



export default function ProfileScreen() {

  const router = useRouter();

  const userProfile = useAppStore((s) => s.userProfile);

  const updateUserProfile = useAppStore((s) => s.updateUserProfile);

  const loading = useLoading("profile");



  const [firstName, setFirstName] = useState(userProfile?.first_name ?? "");

  const [lastName, setLastName] = useState(userProfile?.last_name ?? "");

  const [locale, setLocale] = useState(userProfile?.locale ?? "fr");

  const [password, setPassword] = useState("");



  const oauthOnly = (userProfile?.oauth_providers?.length ?? 0) > 0 && userProfile?.has_password === false;

  const showPassword = !oauthOnly || userProfile?.can_set_password;

  const showMigration = oauthOnly;



  const leaveProfile = () => {

    if (router.canGoBack()) {

      router.back();

      return;

    }

    router.replace("/(tabs)/home");

  };



  const onSave = async () => {

    const ok = await updateUserProfile({

      firstName: firstName.trim(),

      lastName: lastName.trim(),

      locale: locale.trim() || "fr",

      password: showPassword && password.trim() ? password.trim() : null,

    });

    if (ok) {

      setPassword("");

      leaveProfile();

    }

  };



  return (

    <Screen title="Mon profil" onBack={leaveProfile}>

      <ScrollView contentContainerStyle={styles.content}>

        <Card>

          <TextField label="E-mail" value={userProfile?.email ?? ""} editable={false} />

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

          {showPassword ? (

            <>

              <View style={styles.spacer} />

              <TextField

                label="Nouveau mot de passe"

                value={password}

                onChangeText={setPassword}

                secureToggle

                placeholder="Laisser vide pour ne pas le changer."

              />

            </>

          ) : null}

        </Card>

        {showMigration ? (

          <Card>

            <AppText variant="bodyMedium" muted>

              Compte connecté via {userProfile?.oauth_providers?.join(", ")}. Pour ajouter un mot de passe, migre

              vers un e-mail de contact vérifié.

            </AppText>

            <Button label="Migrer le compte" variant="secondary" onPress={() => router.push("/migrate-account")} />

          </Card>

        ) : null}

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


