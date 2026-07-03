import { useCallback } from "react";
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
import { useAppStore } from "@/store/appStore";
import { colors, radius, spacing } from "@/theme/theme";

export default function AccountScreen() {
  const router = useRouter();
  const userProfile = useAppStore((s) => s.userProfile);
  const myDevice = useAppStore((s) => s.myDevice);
  const history = useAppStore((s) => s.history);
  const logout = useAppStore((s) => s.logout);
  const loadUserProfile = useAppStore((s) => s.loadUserProfile);

  useFocusEffect(
    useCallback(() => {
      void loadUserProfile();
    }, [loadUserProfile]),
  );

  const name =
    [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(" ") ||
    "Mon compte";

  const onLogout = async () => {
    await logout();
    router.replace("/auth");
  };

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
            subtitle="Nom, langue, mot de passe"
            icon="person-circle"
            onPress={() => router.push("/profile")}
          />
          <NavMenuItem
            title="Réglages de la boîte"
            subtitle="Nom affiché, région"
            icon="settings"
            onPress={() => router.push("/settings")}
          />
          {myDevice ? (
            <NavMenuItem
              title="Détails de la boîte"
              subtitle="Série, firmware, statut"
              icon="cube"
              onPress={() => router.push(`/device/${myDevice.id}`)}
            />
          ) : null}
          <NavMenuItem
            title="Historique"
            subtitle={`${history.length} message${history.length > 1 ? "s" : ""}`}
            icon="time"
            onPress={() => router.push("/history")}
          />
          <NavMenuItem
            title="Configurer le WiFi"
            subtitle="Reconnecter la boîte"
            icon="bluetooth"
            onPress={() => router.push("/ble")}
            last
          />
        </NavMenuGroup>

        <NavMenuGroup>
          <NavMenuItem
            title="Informations légales"
            icon="document-text"
            onPress={() => router.push("/legal-hub")}
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
