import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { radius, spacing, useCardShadow, useTheme } from "@/shared/theme";

export type CardProps = {
  children: ReactNode;
  /** Adds card padding (space 4). Leave it off when rows run edge to edge. */
  padded?: boolean;
  /** Outer view: size, placement and shadow. */
  style?: StyleProp<ViewStyle>;
  /** Inner clipping view: how the children arrange, such as gap and flexDirection. */
  contentStyle?: StyleProp<ViewStyle>;
};

/** A surface container for one object. Never put a card inside a card. */
export function Card({ children, padded = false, style, contentStyle }: CardProps) {
  const { colors } = useTheme();
  const shadow = useCardShadow();
  // The outer view carries the shadow, the inner one clips the rows to the corners, because iOS drops a shadow from a clipping view.
  return (
    <View style={[styles.outer, { backgroundColor: colors.surface }, shadow, style]}>
      <View style={[styles.inner, padded ? styles.padded : null, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { borderRadius: radius.lg },
  inner: { borderRadius: radius.lg, overflow: "hidden" },
  padded: { padding: spacing[4] },
});
