import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "@/theme/theme";
import { AppText } from "./AppText";

type Segment<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
}: Props<T>) {
  return (
    <View style={styles.container}>
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(segment.value)}
          >
            <AppText
              variant="labelLarge"
              color={active ? colors.onPrimary : colors.textMuted}
            >
              {segment.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.surfaceDark,
    borderRadius: radius.pill,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  segmentActive: {
    backgroundColor: colors.rosePrimary,
  },
});
