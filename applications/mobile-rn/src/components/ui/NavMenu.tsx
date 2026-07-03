import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/theme/theme";
import { AppText } from "./AppText";

type NavMenuItemProps = {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
};

export function NavMenuItem({
  title,
  subtitle,
  icon,
  onPress,
  danger,
  last,
}: NavMenuItemProps) {
  const tint = danger ? colors.wineAccent : colors.rosePrimary;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        !last && styles.itemDivider,
        pressed && styles.pressed,
      ]}
    >
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: `${tint}22` }]}>
          <Ionicons name={icon} size={18} color={tint} />
        </View>
      ) : null}
      <View style={styles.textWrap}>
        <AppText variant="titleMedium" color={danger ? colors.wineAccent : colors.textPrimary}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" muted>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export function NavMenuGroup({ children }: { children: React.ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outline,
    overflow: "hidden",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  itemDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    backgroundColor: colors.surfaceDark,
  },
});
