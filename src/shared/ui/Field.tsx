import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { radius, spacing, touchMin, useFocusRing, useTheme } from "@/shared/theme";

import { Text, typeStyle } from "./Text";

export type FieldProps = Omit<TextInputProps, "style" | "placeholderTextColor" | "accessibilityLabel"> & {
  /** The visible label above the well. A placeholder is an example, never the label. */
  label: string;
  /** Small text below the well. */
  hint?: string;
  /** An inline error below the well, in ink. Never red. */
  error?: string;
};

/** A kicker label, a canvas well and an optional hint. Focus draws a 2px ink ring, inset so a clipping parent cannot cut it. */
export function Field({ label, hint, error, onFocus, onBlur, ...input }: FieldProps) {
  const { colors } = useTheme();
  const focus = useFocusRing(colors.ink, true);
  return (
    <View style={styles.field}>
      <Text type="kicker" color="muted">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        selectionColor={colors.ink}
        maxFontSizeMultiplier={2}
        {...input}
        onFocus={(event) => {
          focus.handlers.onFocus();
          onFocus?.(event);
        }}
        onBlur={(event) => {
          focus.handlers.onBlur();
          onBlur?.(event);
        }}
        style={[
          typeStyle("body"),
          styles.well,
          { backgroundColor: colors.canvas, color: colors.ink },
          focus.style,
        ]}
      />
      {error ? (
        <Text type="secondary-strong" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      {hint ? (
        <Text type="caption" color="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing[2] },
  well: { minHeight: touchMin, paddingHorizontal: spacing[3], borderRadius: radius.sm },
});
