import { Linking, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { NavMenuGroup, NavMenuItem, Screen } from "@/components/ui";
import { COOKIES_POLICY_URL, DELETE_ACCOUNT_URL } from "@/data/legal";
import { spacing } from "@/theme/theme";

export default function LegalHubScreen() {
  const router = useRouter();
  return (
    <Screen title="Informations légales" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content}>
        <NavMenuGroup>
          <NavMenuItem
            title="Conditions d'utilisation"
            icon="document-text"
            onPress={() => router.push("/legal/terms")}
          />
          <NavMenuItem
            title="Confidentialité"
            icon="lock-closed"
            onPress={() => router.push("/legal/privacy")}
          />
          <NavMenuItem
            title="Mentions légales"
            icon="information-circle"
            onPress={() => router.push("/legal/legal")}
          />
          <NavMenuItem
            title="Mes données personnelles"
            icon="document-outline"
            onPress={() => Linking.openURL(DELETE_ACCOUNT_URL)}
          />
          <NavMenuItem
            title="Politique cookies"
            icon="globe-outline"
            onPress={() => Linking.openURL(COOKIES_POLICY_URL)}
            last
          />
        </NavMenuGroup>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
  },
});
