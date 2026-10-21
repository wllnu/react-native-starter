import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { t } from "@/shared/i18n";
import { sizes, spacing, useFocusRing, useTheme } from "@/shared/theme";

import { Icon } from "./Icon";
import { Text } from "./Text";

export type ListRowProps = {
  title: string;
  /** The value on the right, in muted text. */
  value?: string;
  /** Replaces the value and chevron, for example with a native picker. */
  trailing?: ReactNode;
  /** Without it the row is plain and shows no chevron. */
  onPress?: () => void;
  /** Draws the hairline above the row. Use it on every row but the first in a card. */
  divider?: boolean;
  disabled?: boolean;
};

/** Title on the left, value on the right, chevron in faint. Pressed state is a fill. */
export function ListRow({ title, value, trailing, onPress, divider = false, disabled = false }: ListRowProps) {
  const { colors } = useTheme();
  const focus = useFocusRing(colors.ink, true);
  const content = (
    <>
      <Text type="body-strong" style={styles.title}>
        {title}
      </Text>
      {trailing ?? (
        <>
          {value ? (
            <Text type="secondary" color="muted">
              {value}
            </Text>
          ) : null}
          {onPress ? <Icon name="chevron" size="icon-sm" color="faint" strokeWidth={3} /> : null}
        </>
      )}
    </>
  );
  const line = divider ? <View style={[styles.line, { backgroundColor: colors.line }]} /> : null;
  if (!onPress) {
    return (
      <View style={[styles.row, { opacity: disabled ? 0.5 : 1 }]}>
        {line}
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? t("ui.labelValue", { label: title, value }) : title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focus.handlers}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.fill : "transparent", opacity: disabled ? 0.5 : 1 },
        focus.style,
      ]}
    >
      {line}
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    minHeight: sizes.row,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
  },
  title: { flex: 1 },
  line: { position: "absolute", top: 0, left: spacing[4], right: spacing[4], height: 1 },
});
