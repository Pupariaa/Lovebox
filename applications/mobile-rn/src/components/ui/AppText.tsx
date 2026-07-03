import { Text, TextProps, TextStyle } from "react-native";
import { colors, typography } from "@/theme/theme";

type Variant = keyof typeof typography;

type Props = TextProps & {
  variant?: Variant;
  color?: string;
  muted?: boolean;
  center?: boolean;
};

export function AppText({
  variant = "bodyLarge",
  color,
  muted,
  center,
  style,
  ...rest
}: Props) {
  const base = typography[variant] as TextStyle;
  return (
    <Text
      {...rest}
      style={[
        base,
        { color: color ?? (muted ? colors.textMuted : colors.textPrimary) },
        center && { textAlign: "center" },
        style,
      ]}
    />
  );
}
