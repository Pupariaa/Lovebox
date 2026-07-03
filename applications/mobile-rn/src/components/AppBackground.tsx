import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/theme/theme";

type Props = {
  children: React.ReactNode;
};

export function AppBackground({ children }: Props) {
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withRepeat(
      withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [drift]);

  const orbA = useAnimatedStyle(() => ({
    transform: [
      { translateX: -40 + drift.value * 60 },
      { translateY: -20 + drift.value * 40 },
    ],
  }));

  const orbB = useAnimatedStyle(() => ({
    transform: [
      { translateX: 30 - drift.value * 50 },
      { translateY: 40 - drift.value * 30 },
    ],
  }));

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.gradientTop, colors.gradientMid, colors.gradientBottom]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.orb, styles.orbTop, orbA]} />
      <Animated.View style={[styles.orb, styles.orbBottom, orbB]} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.plumBackground,
  },
  content: {
    flex: 1,
  },
  orb: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: colors.rosePrimary,
    opacity: 0.14,
  },
  orbTop: {
    top: -80,
    right: -60,
  },
  orbBottom: {
    bottom: -60,
    left: -80,
    backgroundColor: colors.wineAccent,
    opacity: 0.16,
  },
});
