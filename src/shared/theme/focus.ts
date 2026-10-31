import { useState } from "react";
import type { ViewStyle } from "react-native";

/**
 * The DESIGN.md focus ring: 2px with a 2px offset. Spread `handlers` on the Pressable and add `style` to the view that has the radius.
 * `inset` draws the ring inside, for a control that a clipping parent would cut off. It shows for keyboard and switch-control focus.
 */
export function useFocusRing(color: string, inset = false) {
  const [focused, setFocused] = useState(false);
  // satisfies instead of a ViewStyle annotation keeps the narrow type, which a TextInput style accepts too.
  const style = focused
    ? ({
        outlineStyle: "solid",
        outlineColor: color,
        outlineWidth: 2, // design-ignore: the focus ring is 2px (DESIGN.md Accessibility)
        outlineOffset: inset ? -4 : 2, // design-ignore: 2px offset, or inset by space 1 where a parent clips
      } satisfies ViewStyle)
    : null;
  return {
    style,
    handlers: {
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
    },
  };
}
