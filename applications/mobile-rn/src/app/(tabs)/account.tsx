import { Linking, useCallback } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AppText,
  Button,
  NavMenuGroup,
  NavMenuItem,
  Screen,
} from "@/components/ui";
import { AppConfig } from "@/config/AppConfig";
import { useAppStore } from "@/store/appStore";
import { colors, radius, spacing } from "@/theme/theme";

export default function AccountScreen() {
  const router = useRouter();
  const userProfile = useAppStore((s) => s.userProfile);
  const devices = useAppStore((s) => s.devices);
  const history = useAppStore((s) => s.history);
  const logout = useAppStore((s) => s.logout);
  const loadUserProfile = useAppStore((s) => s.loadUserProfile);
  const refreshState = useAppStore((s) => s.refreshState);

  useFocusEffect(
    useCallback(() => {
      void loadUserProfile();
      void refreshState();
    }, [loadUserProfile, refreshState]),
  );

  const name =
    [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(" ") ||
    "Mon compte";

  const onLogout = async () => {
    await logout();
    router.replace("/auth");
  };

  const boxesSubtitle =
    devices.length === 0
      ? "Aucune boîte liée."
      : devices.length === 1
        ? "1 boîte liée."
        : `${devices.length} boîtes liées.`;

  return (
    <Screen title="Compte">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={28} color={colors.rosePrimary} />
          </View>
          <View style={styles.flex}>
            <AppText variant="headlineMedium">{name}</AppText>
            {userProfile?.email ? (
              <AppText variant="bodyMedium" muted>
                {userProfile.email}
              </AppText>
            ) : null}
          </View>
        </View>

        <NavMenuGroup>
          <NavMenuItem
            title="Mon profil"
            subtitle="Nom, langue, mot de passe."
            icon="person-circle"
            onPress={() => router.push("/profile")}
          />
          <NavMenuItem
            title="Mes boîtes"
            subtitle={boxesSubtitle}
            icon="cube"
            onPress={() => router.push("/boxes")}
          />
          <NavMenuItem
            title="Historique"
            subtitle={`${history.length} message${history.length > 1 ? "s" : ""}`}
            icon="time"
            onPress={() => router.push("/history")}
          />
          <NavMenuItem
            title="Messages reçus"
            subtitle="Messages ouverts sur tes boîtes."
            icon="mail-open"
            onPress={() => router.push("/received")}
            last
          />
        </NavMenuGroup>

        <NavMenuGroup>
          <NavMenuItem
            title="Informations légales"
            icon="document-text"
            onPress={() => router.push("/legal-hub")}
          />
          <NavMenuItem
            title="Supprimer mon compte"
            subtitle="Demande de suppression RGPD."
            icon="trash"
            onPress={() => void Linking.openURL(`${AppConfig.API_BASE}/delete-me`)}
            last
          />
        </NavMenuGroup>

        <Button label="Se déconnecter" variant="danger" onPress={onLogout} />
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
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.outline,
    alignItems: "center",
    justifyContent: "center",
  },
});
