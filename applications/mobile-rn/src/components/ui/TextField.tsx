import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { colors, radius, spacing, typography } from "@/theme/theme";
import { AppText } from "./AppText";

type Props = TextInputProps & {
  label?: string;
  helper?: string;
  error?: string;
  secureToggle?: boolean;
};

export function TextField({
  label,
  helper,
  error,
  secureToggle,
  secureTextEntry,
  style,
  ...rest
}: Props) {
  const [hidden, setHidden] = useState(true);
  const isSecure = secureToggle ? hidden : secureTextEntry;

  return (
    <View style={styles.wrap}>
      {label ? (
        <AppText variant="labelLarge" muted style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <View style={[styles.fieldRow, error ? styles.fieldError : null]}>
        <TextInput
          {...rest}
          secureTextEntry={isSecure}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, style]}
        />
        {secureToggle ? (
          <Pressable onPress={() => setHidden((v) => !v)} hitSlop={10}>
            <AppText variant="labelLarge" color={colors.rosePrimary}>
              {hidden ? "Voir" : "Cacher"}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" color={colors.danger}>
          {error}
        </AppText>
      ) : helper ? (
        <AppText variant="caption" muted>
          {helper}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  label: {
    marginLeft: spacing.xs,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceDark,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.outline,
    paddingHorizontal: spacing.lg,
  },
  fieldError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
    ...typography.bodyLarge,
  },
});
