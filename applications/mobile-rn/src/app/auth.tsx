import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppBackground } from "@/components/AppBackground";
import { AppText, Button, SegmentedControl, TextField } from "@/components/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { startOAuth } from "@/data/api/oauth";
import { OAUTH_PROVIDERS, type OAuthProvider } from "@/config/AppConfig";
import { useAppStore } from "@/store/appStore";
import { colors, radius, spacing } from "@/theme/theme";

type Mode = "login" | "register";

const PROVIDER_META: Record<OAuthProvider, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  google: { label: "Google", icon: "logo-google" },
  apple: { label: "Apple", icon: "logo-apple" },
  facebook: { label: "Facebook", icon: "logo-facebook" },
};

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const login = useAppStore((s) => s.login);
  const register = useAppStore((s) => s.register);
  const afterExternalLogin = useAppStore((s) => s.afterExternalLogin);
  const loading = useAppStore((s) => s.loading);
  const showSnackbar = useAppStore((s) => s.showSnackbar);

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptLegal, setAcceptLegal] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);

  const emailValid = email.includes("@") && email.includes(".");
  const passwordValid = password.length >= 8;
  const legalOk = mode === "login" || acceptLegal;
  const canSubmit = emailValid && passwordValid && legalOk && !loading;

  const submit = async () => {
    if (!canSubmit) return;
    const ok = mode === "login" ? await login(email, password) : await register(email, password);
    if (ok) router.replace("/(tabs)/home");
  };

  const onOAuth = async (provider: OAuthProvider) => {
    setOauthBusy(true);
    const result = await startOAuth(provider);
    setOauthBusy(false);
    if (result.ok) {
      await afterExternalLogin();
      router.replace("/(tabs)/home");
    } else if (!result.cancelled) {
      showSnackbar(result.error ?? "Connexion impossible");
    }
  };

  return (
    <AppBackground>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <View style={styles.logoGlow}>
              <Image
                source={require("../../assets/images/logo-lovebox.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <AppText variant="headlineLarge" center>
              Boîte à cœur
            </AppText>
            <AppText variant="bodyMedium" muted center>
              Des petits mots qui font battre les cœurs, à distance.
            </AppText>
          </View>

          <View style={styles.card}>
            <SegmentedControl
              segments={[
                { value: "login", label: "Connexion" },
                { value: "register", label: "Inscription" },
              ]}
              value={mode}
              onChange={(m) => {
                setMode(m);
                setAcceptLegal(false);
              }}
            />

            <TextField
              label="Adresse e-mail"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              error={email.length > 0 && !emailValid ? "Adresse e-mail invalide" : undefined}
            />
            <TextField
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureToggle
              error={password.length > 0 && !passwordValid ? "8 caractères minimum" : undefined}
            />

            {mode === "login" ? (
              <Pressable
                onPress={() =>
                  router.push(
                    `/forgot-password?email=${encodeURIComponent(email)}` as Href,
                  )
                }
                hitSlop={8}
                style={styles.forgot}
              >
                <AppText variant="caption" color={colors.rosePrimary}>
                  Mot de passe oublié ?
                </AppText>
              </Pressable>
            ) : null}

            {mode === "register" ? (
              <Pressable style={styles.legalRow} onPress={() => setAcceptLegal((v) => !v)}>
                <View style={[styles.checkbox, acceptLegal && styles.checkboxOn]}>
                  {acceptLegal ? (
                    <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                  ) : null}
                </View>
                <AppText variant="caption" muted style={styles.legalText}>
                  J&apos;accepte les{" "}
                  <AppText
                    variant="caption"
                    color={colors.rosePrimary}
                    onPress={() => router.push("/legal-hub")}
                  >
                    conditions et la politique de confidentialité
                  </AppText>
                  .
                </AppText>
              </Pressable>
            ) : null}

            <Button
              label={mode === "login" ? "Se connecter" : "Créer mon compte"}
              onPress={submit}
              loading={loading}
              disabled={!canSubmit}
            />
          </View>

          <View style={styles.divider}>
            <View style={styles.line} />
            <AppText variant="caption" muted>
              ou continuer avec
            </AppText>
            <View style={styles.line} />
          </View>

          <View style={styles.oauthRow}>
            {OAUTH_PROVIDERS.map((provider) => (
              <Pressable
                key={provider}
                style={({ pressed }) => [styles.oauthButton, pressed && styles.pressed]}
                onPress={() => onOAuth(provider)}
                disabled={oauthBusy}
              >
                <Ionicons name={PROVIDER_META[provider].icon} size={22} color={colors.textPrimary} />
                <AppText variant="caption" muted>
                  {PROVIDER_META[provider].label}
                </AppText>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },
  hero: {
    alignItems: "center",
    gap: spacing.sm,
  },
  logoGlow: {
    width: 128,
    height: 128,
    borderRadius: radius.pill,
    backgroundColor: colors.authGlow,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  logo: {
    width: 104,
    height: 104,
  },
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  forgot: {
    alignSelf: "flex-end",
    marginTop: -spacing.sm,
  },
  legalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.xs,
    borderWidth: 1.5,
    borderColor: colors.outline,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxOn: {
    backgroundColor: colors.rosePrimary,
    borderColor: colors.rosePrimary,
  },
  legalText: {
    flex: 1,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.outline,
  },
  oauthRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  oauthButton: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surfaceDark,
  },
  pressed: {
    opacity: 0.8,
  },
});
