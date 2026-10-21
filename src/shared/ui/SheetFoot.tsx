import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing, useTheme } from "@/shared/theme";

export type SheetFootProps = {
  /** The one primary button of the sheet. */
  children: ReactNode;
};

/** The pinned foot of a sheet. Sits under the scrolling body and clears the home indicator. */
export function SheetFoot({ children }: SheetFootProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.foot,
        { backgroundColor: colors.canvas, paddingBottom: Math.max(insets.bottom, spacing[4]) },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  foot: { paddingTop: spacing[3], paddingHorizontal: spacing[4] },
});
