import { Pressable, StyleSheet } from "react-native";

import { radius, spacing, touchMin, useFocusRing, useTheme } from "@/shared/theme";

import { Text } from "./Text";

export type TextButtonProps = {
  label: string;
  onPress: () => void;
  /** Destructive actions are plain secondary text with an underline, never red. */
  destructive?: boolean;
  /** For use on an ink panel. */
  onInk?: boolean;
  disabled?: boolean;
};

/** An inline action, touch-min tall. */
export function TextButton({ label, onPress, destructive = false, onInk = false, disabled = false }: TextButtonProps) {
  const { colors } = useTheme();
  const focus = useFocusRing(onInk ? colors["on-ink"] : colors.ink);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focus.handlers}
      style={({ pressed }) => [styles.base, { opacity: pressed || disabled ? 0.5 : 1 }, focus.style]}
    >
      <Text
        type="secondary-strong"
        color={onInk ? "on-ink" : destructive ? "secondary" : "ink"}
        style={destructive ? styles.underline : undefined}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchMin,
    paddingHorizontal: spacing[1],
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  underline: { textDecorationLine: "underline" },
});
