import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  clamp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { AppText } from "./AppText";
import { colors, radius, spacing } from "@/theme/theme";

const THUMB_SIZE = 26;
const TRACK_HEIGHT = 5;

type Props = {
  label: string;
  value: number;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  unit?: string;
  onValueChange: (value: number) => void;
};

export function Slider({
  label,
  value,
  minimumValue = 0,
  maximumValue = 100,
  step = 1,
  unit = "%",
  onValueChange,
}: Props) {
  const trackWidth = useSharedValue(0);
  const range = maximumValue - minimumValue;
  const ratio = useSharedValue(range > 0 ? (value - minimumValue) / range : 0);

  useEffect(() => {
    ratio.value = range > 0 ? (value - minimumValue) / range : 0;
  }, [minimumValue, range, ratio, value]);

  const commit = useCallback(
    (nextRatio: number) => {
      const raw = minimumValue + nextRatio * range;
      const stepped = step <= 1 ? Math.round(raw) : Math.round(raw / step) * step;
      onValueChange(Math.max(minimumValue, Math.min(maximumValue, stepped)));
    },
    [maximumValue, minimumValue, onValueChange, range, step],
  );

  const gesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((event) => {
      if (trackWidth.value <= 0) return;
      const nextRatio = clamp(event.x / trackWidth.value, 0, 1);
      ratio.value = nextRatio;
      runOnJS(commit)(nextRatio);
    })
    .onUpdate((event) => {
      if (trackWidth.value <= 0) return;
      const nextRatio = clamp(event.x / trackWidth.value, 0, 1);
      ratio.value = nextRatio;
      runOnJS(commit)(nextRatio);
    });

  const onTrackLayout = (event: LayoutChangeEvent) => {
    trackWidth.value = event.nativeEvent.layout.width;
  };

  const fillStyle = useAnimatedStyle(() => ({
    width: ratio.value * trackWidth.value,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: ratio.value * Math.max(0, trackWidth.value - THUMB_SIZE) }],
  }));

  const highIconColor = value > 66 ? colors.rosePrimary : value > 33 ? colors.creamMuted : colors.textMuted;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <AppText variant="labelLarge" muted style={styles.label}>
          {label}
        </AppText>
        <View style={styles.valueBadge}>
          <AppText variant="labelLarge" color={colors.rosePrimary}>
            {value}
            {unit}
          </AppText>
        </View>
      </View>
      <View style={styles.row}>
        <Ionicons name="sunny-outline" size={18} color={colors.textMuted} />
        <GestureDetector gesture={gesture}>
          <View style={styles.trackArea} onLayout={onTrackLayout}>
            <View style={styles.trackBg} />
            <Animated.View style={[styles.trackFill, fillStyle]} />
            <Animated.View style={[styles.thumb, thumbStyle]} />
          </View>
        </GestureDetector>
        <Ionicons name="sunny" size={20} color={highIconColor} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    marginLeft: spacing.xs,
  },
  valueBadge: {
    minWidth: 52,
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.xs,
    backgroundColor: colors.surfaceDark,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  trackArea: {
    flex: 1,
    height: 44,
    justifyContent: "center",
  },
  trackBg: {
    height: TRACK_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: colors.outline,
  },
  trackFill: {
    position: "absolute",
    left: 0,
    height: TRACK_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: colors.rosePrimary,
  },
  thumb: {
    position: "absolute",
    left: 0,
    top: (44 - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.creamHighlight,
    borderWidth: 2,
    borderColor: colors.rosePrimary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
  },
});
