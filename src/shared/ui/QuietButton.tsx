import { Pressable, StyleSheet } from "react-native";

import { radius, sizes, spacing, useFocusRing, useTheme } from "@/shared/theme";

import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

export type QuietButtonProps = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  /** Rests on a fill. Without it the button has no fill until it is pressed. */
  filled?: boolean;
  disabled?: boolean;
};

/** Same size as the primary button with no fill and secondary text. */
export function QuietButton({ label, onPress, icon, filled = false, disabled = false }: QuietButtonProps) {
  const { colors } = useTheme();
  const focus = useFocusRing(colors.ink);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focus.handlers}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: pressed || filled ? colors.fill : "transparent", opacity: disabled ? 0.5 : 1 },
        focus.style,
      ]}
    >
      {icon ? <Icon name={icon} size="icon-sm" color="secondary" /> : null}
      <Text type="body-strong" color="secondary">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    minHeight: sizes.control,
    borderRadius: radius.md,
  },
});
