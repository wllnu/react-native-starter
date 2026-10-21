import Svg, { Path } from "react-native-svg";

import { type ColorToken, sizes, useTheme } from "@/shared/theme";

// Line drawings on a 24 by 24 grid. Add a path here when a screen needs a new glyph.
const paths = {
  check: "M5 12.5l4.5 4.5L19 7.5",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6L6 18",
  chevron: "M9 5l7 7-7 7",
  note: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  settings: "M4 7h10M18 7h2M4 17h2M10 17h10M16 5v4M8 15v4",
} as const;

export type IconName = keyof typeof paths;

export type IconProps = {
  name: IconName;
  /** icon is 24, icon-sm is 16. */
  size?: "icon" | "icon-sm";
  color?: ColorToken;
  strokeWidth?: number;
};

/** A decorative line drawing. The control around it carries the accessible name. */
export function Icon({ name, size = "icon", color = "ink", strokeWidth = 2 }: IconProps) {
  const { colors } = useTheme();
  const px = sizes[size];
  return (
    <Svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path
        d={paths[name]}
        stroke={colors[color]}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
