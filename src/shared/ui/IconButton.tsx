import { Pressable, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";

import { radius, touchMin, useCardShadow, useFocusRing, usePressScale, useTheme } from "@/shared/theme";

import { Icon, type IconName } from "./Icon";

export type IconButtonProps = {
  icon: IconName;
  /** The accessible name. An icon has no text, so this is required. */
  label: string;
  onPress: () => void;
  /** fill: resting fill (close). plain: no fill until pressed (row actions). surface: a lifted circle on the canvas. */
  variant?: "fill" | "plain" | "surface";
  /** icon is 24, icon-sm is 16. */
  glyph?: "icon" | "icon-sm";
};

/** A round button, touch-min across. Scales down while pressed. */
export function IconButton({ icon, label, onPress, variant = "fill", glyph = "icon-sm" }: IconButtonProps) {
  const { colors } = useTheme();
  const shadow = useCardShadow();
  const press = usePressScale(0.94);
  const focus = useFocusRing(colors.ink);
  const background = variant === "fill" ? colors.fill : variant === "surface" ? colors.surface : "transparent";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      {...press.handlers}
      {...focus.handlers}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.round,
            { backgroundColor: variant === "plain" && pressed ? colors.fill : background },
            variant === "surface" ? shadow : null,
            focus.style,
            press.style,
          ]}
        >
          <Icon
            name={icon}
            size={glyph}
            color={variant === "plain" ? "muted" : variant === "surface" ? "ink" : "secondary"}
            strokeWidth={glyph === "icon-sm" ? 2.5 : 2}
          />
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  round: {
    width: touchMin,
    height: touchMin,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
