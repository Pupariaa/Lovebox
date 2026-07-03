import { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors, radius, spacing } from "@/theme/theme";
import { AppText } from "./AppText";

type Props = {
  message: string | null;
  onDismiss: () => void;
};

export function Snackbar({ message, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (message) {
      progress.value = withTiming(1, { duration: 220 });
      const timer = setTimeout(onDismiss, 3200);
      return () => clearTimeout(timer);
    }
    progress.value = withTiming(0, { duration: 180 });
  }, [message, onDismiss, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 24 }],
  }));

  if (!message) return null;

  return (
    <Animated.View
      style={[styles.wrap, { bottom: insets.bottom + spacing.xl }, style]}
      pointerEvents="box-none"
    >
      <Pressable style={styles.snackbar} onPress={onDismiss}>
        <AppText variant="bodyMedium" color={colors.textPrimary}>
          {message}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    alignItems: "center",
  },
  snackbar: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.rosePrimary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    maxWidth: 480,
  },
});
