import { Pressable, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";

import { radius, sizes, spacing, useFocusRing, usePressScale, useTheme } from "@/shared/theme";

import { Text } from "./Text";

export type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  /** Inverts the colours for use on an ink panel. */
  onInk?: boolean;
  disabled?: boolean;
};

/** The one primary action of a sheet or panel: full width, ink fill, scales down while pressed. */
export function PrimaryButton({ label, onPress, onInk = false, disabled = false }: PrimaryButtonProps) {
  const { colors } = useTheme();
  const press = usePressScale(0.98);
  const focus = useFocusRing(onInk ? colors["on-ink"] : colors.ink);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...press.handlers}
      {...focus.handlers}
    >
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: onInk ? colors["on-ink"] : colors.ink, opacity: disabled ? 0.5 : 1 },
          focus.style,
          press.style,
        ]}
      >
        <Text type="button" color={onInk ? "ink" : "on-ink"} style={styles.label}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    minHeight: sizes.control,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    alignItems: "center",
    justifyContent: "center",
  },
  label: { textAlign: "center" },
});
