import { Platform, useColorScheme } from "react-native";

import { colors, darkColors, sizes } from "../../../design/tokens";

export * from "../../../design/tokens";
export { useFocusRing } from "./focus";
export { easingOut, useMotion, usePressScale } from "./motion";

export type Scheme = "light" | "dark";

export function useTheme() {
  const scheme: Scheme = useColorScheme() === "dark" ? "dark" : "light";
  return { scheme, dark: scheme === "dark", colors: scheme === "dark" ? darkColors : colors };
}

/** Smallest tappable size on this platform. */
export const touchMin = Platform.OS === "android" ? sizes["touch-min-android"] : sizes["touch-min"];

/** shadow-card: a 1px lift under cards in light mode, off in dark mode and on Android (DESIGN.md allows dropping it there). */
export function useCardShadow() {
  const { dark, colors: c } = useTheme();
  if (dark || Platform.OS === "android") return {};
  return {
    shadowColor: c.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2, // design-ignore: elevation is not a token; shadow-card is 0 1px 2px at 4% ink
    shadowOpacity: 0.04,
  };
}

/** shadow-float: under the toast only. */
export function useFloatShadow() {
  const { colors: c } = useTheme();
  return {
    shadowColor: c.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12, // design-ignore: elevation is not a token; shadow-float is 0 8px 24px at 35% ink
    shadowOpacity: 0.35,
    elevation: 8,
  };
}
