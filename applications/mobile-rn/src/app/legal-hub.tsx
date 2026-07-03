import { ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { NavMenuGroup, NavMenuItem, Screen } from "@/components/ui";
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
