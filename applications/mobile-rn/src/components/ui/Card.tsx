import { Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { colors, radius, spacing } from "@/theme/theme";

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  highlight?: boolean;
};

export function Card({ children, onPress, style, highlight }: Props) {
  const content = (
    <View
      style={[
        styles.card,
        highlight && { borderColor: colors.rosePrimary },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  pressed: {
    opacity: 0.9,
  },
});
