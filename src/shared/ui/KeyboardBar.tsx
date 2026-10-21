import { KeyboardToolbar } from "react-native-keyboard-controller";

import { t } from "@/shared/i18n";
import { useTheme } from "@/shared/theme";

import { Text } from "./Text";

// react-native-keyboard-controller draws its bar exactly this tall (its internal KEYBOARD_TOOLBAR_HEIGHT), and 1.21.9
// does not re-export that constant from the public API, so it lives here. The avoiding views pad for the keyboard plus this bar.
export const KEYBOARD_TOOLBAR_HEIGHT = 42; // design-ignore: the library's toolbar height; not re-exported by the package root

/** The bar above the keyboard: previous, next and Done. The number pad has no confirm key, so this is how it closes. */
export function KeyboardBar() {
  const { colors } = useTheme();
  // The app theme already switches with the OS scheme, so both entries of the toolbar theme read the same values.
  const theme = {
    light: { background: colors.surface, primary: colors.ink, disabled: colors.faint, ripple: colors.fill },
    dark: { background: colors.surface, primary: colors.ink, disabled: colors.faint, ripple: colors.fill },
  };
  return (
    <KeyboardToolbar theme={theme}>
      <KeyboardToolbar.Prev />
      <KeyboardToolbar.Next />
      <KeyboardToolbar.Done
        text={
          <Text type="secondary-strong">
            {t("ui.done")}
          </Text>
        }
      />
    </KeyboardToolbar>
  );
}