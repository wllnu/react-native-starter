import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";

import { type ColorToken, type TypeRole, typography, useTheme } from "@/shared/theme";

// Dynamic Type caps. Titles would break their layouts at 200%, so they stop earlier.
const maxScale: Record<TypeRole, number> = {
  title: 1.5,
  heading: 1.75,
  button: 1.75,
  body: 2,
  "body-strong": 2,
  secondary: 2,
  "secondary-strong": 2,
  caption: 2,
  kicker: 2,
};

/** The text style for a type role. The kicker is uppercase and every number is tabular. */
export function typeStyle(role: TypeRole): TextStyle {
  const { fontSize, lineHeight, letterSpacing, fontWeight } = typography[role];
  // No fontFamily: React Native's default is the system font.
  return {
    fontSize,
    lineHeight,
    letterSpacing,
    fontWeight,
    fontVariant: ["tabular-nums"],
    textTransform: role === "kicker" ? "uppercase" : "none",
  };
}

export type TextProps = RNTextProps & {
  /** The DESIGN.md type role. Defaults to body. */
  type?: TypeRole;
  /** A colour token. Defaults to ink. */
  color?: ColorToken;
};

export function Text({ type = "body", color = "ink", style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={maxScale[type]}
      {...rest}
      style={[typeStyle(type), { color: colors[color] }, style]}
    />
  );
}
