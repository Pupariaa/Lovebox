import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "@/theme/theme";
import { AppBackground } from "@/components/AppBackground";
import { AppText } from "./AppText";

type Props = {
  title?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
  contentStyle?: object;
};

export function Screen({ title, onBack, actions, children, contentStyle }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <AppBackground>
      <View style={{ paddingTop: insets.top }}>
        {(title || onBack || actions) && (
          <View style={styles.header}>
            {onBack ? (
              <Pressable onPress={onBack} hitSlop={12} style={styles.back}>
                <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
              </Pressable>
            ) : (
              <View style={styles.back} />
            )}
            <AppText variant="headlineMedium" style={styles.title} numberOfLines={1}>
              {title ?? ""}
            </AppText>
            <View style={styles.actions}>{actions}</View>
          </View>
        )}
      </View>
      <View style={[styles.content, contentStyle]}>{children}</View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  back: {
    width: 32,
    alignItems: "flex-start",
  },
  title: {
    flex: 1,
  },
  actions: {
    minWidth: 32,
    alignItems: "flex-end",
  },
  content: {
    flex: 1,
  },
});
