import { StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "@/theme/theme";
import { AppText } from "./AppText";

type Props = {
  online: boolean;
  label: string;
};

export function StatusPill({ online, label }: Props) {
  return (
    <View style={styles.pill}>
      <View
        style={[styles.dot, { backgroundColor: online ? colors.success : colors.textMuted }]}
      />
      <AppText variant="caption" muted>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
});
