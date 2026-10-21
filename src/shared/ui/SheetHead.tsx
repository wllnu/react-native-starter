import type { ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { t } from "@/shared/i18n";
import { radius, spacing, useTheme } from "@/shared/theme";

import { type IconName } from "./Icon";
import { IconButton } from "./IconButton";
import { Text } from "./Text";

export type SheetHeadProps = {
  title: string;
  /** A state line above the title. Only when it carries state. */
  kicker?: string;
  /** The accessible name of the close button. Defaults to "Close". */
  closeLabel?: string;
  /** The close button's icon. Defaults to the cross. */
  closeIcon?: IconName;
  onClose: () => void;
  /** Extra content left of the close button, such as a status. */
  trailing?: ReactNode;
  /**
   * Draw the grabber here. A form-sheet route gets a native one from `sheetGrabberVisible` on iOS only
   * (react-native-screens), so the default draws it on Android and leaves iOS to the system.
   * Pass `true` inside a Modal-based sheet.
   */
  grabber?: boolean;
};

/** The head of a sheet: grabber, title and close button. Works in a form-sheet route and would work in a Modal. */
export function SheetHead({
  title,
  kicker,
  closeLabel = t("ui.close"),
  closeIcon = "close",
  onClose,
  trailing,
  grabber = Platform.OS !== "ios",
}: SheetHeadProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.head, { paddingTop: grabber ? spacing[2] : spacing[6] }]}>
      {grabber ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.grabber, { backgroundColor: colors.faint }]}
        />
      ) : null}
      <View style={styles.bar}>
        <View style={styles.title}>
          {kicker ? (
            <Text type="kicker" color="muted">
              {kicker}
            </Text>
          ) : null}
          <Text type="title" accessibilityRole="header">
            {title}
          </Text>
        </View>
        {trailing}
        <IconButton icon={closeIcon} label={closeLabel} onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: spacing[5], paddingBottom: spacing[3] },
  grabber: {
    width: 36, // design-ignore: the prototype's 36×5 grabber is not on the scale
    height: 5, // design-ignore: the prototype's 36×5 grabber is not on the scale
    borderRadius: radius.full,
    alignSelf: "center",
    marginBottom: spacing[3],
  },
  bar: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
  title: { flex: 1, gap: spacing[1] },
});
