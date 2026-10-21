// Generated from DESIGN.md by `node design/check.mjs build`. Do not edit.
// React Native / Expo: unitless numbers, hex colours, absolute line heights.
export const colors = {
  ink: "#18181b",
  "ink-raised": "#2e2e33",
  "on-ink": "#ffffff",
  "on-ink-muted": "#a1a1aa",
  secondary: "#4b4b53",
  muted: "#66666f",
  canvas: "#f4f4f5",
  surface: "#ffffff",
  line: "#18181b14",
  fill: "#18181b0f",
  scrim: "#18181b73",
  faint: "#c4c4c9",
  accent: "#2563eb",
} as const;
export const darkColors = {
  ink: "#f4f4f5",
  "ink-raised": "#dcdce0",
  "on-ink": "#18181b",
  "on-ink-muted": "#5b5b63",
  secondary: "#b4b4bc",
  muted: "#9b9ba4",
  canvas: "#0f0f11",
  surface: "#1c1c20",
  line: "#ffffff1f",
  fill: "#ffffff14",
  scrim: "#00000099",
  faint: "#4a4a51",
  accent: "#7aa7ff",
} as const;
export const themes = { light: colors, dark: darkColors } as const;
export const spacing = {
  "1": 4,
  "2": 8,
  "3": 12,
  "4": 16,
  "5": 20,
  "6": 24,
  "12": 48,
} as const;
export const radius = {
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  full: 9999,
} as const;
export const sizes = {
  "touch-min": 44,
  "touch-min-android": 48,
  row: 52,
  control: 56,
  icon: 24,
  "icon-sm": 16,
  "content-max": 430,
} as const;
export const motion = {
  fast: 120,
  base: 200,
  slow: 320,
} as const;
export const typography = {
  title: {
    fontFamily: "System",
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "700",
    letterSpacing: 0,
  },
  heading: {
    fontFamily: "System",
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "600",
    letterSpacing: 0,
  },
  button: {
    fontFamily: "System",
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "600",
    letterSpacing: 0,
  },
  body: {
    fontFamily: "System",
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "400",
    letterSpacing: 0,
  },
  "body-strong": {
    fontFamily: "System",
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "600",
    letterSpacing: 0,
  },
  secondary: {
    fontFamily: "System",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "400",
    letterSpacing: 0,
  },
  "secondary-strong": {
    fontFamily: "System",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    letterSpacing: 0,
  },
  caption: {
    fontFamily: "System",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    letterSpacing: 0,
  },
  kicker: {
    fontFamily: "System",
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 0.96,
  },
} as const;
export type ColorToken = keyof typeof colors;
export type TypeRole = keyof typeof typography;
export default { colors, darkColors, themes, spacing, radius, sizes, motion, typography };
