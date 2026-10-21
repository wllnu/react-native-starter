import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { t } from "@/shared/i18n";
import { sizes, spacing, useFocusRing, useMotion, useTheme } from "@/shared/theme";

import { Card } from "./Card";
import { Icon } from "./Icon";
import { Text } from "./Text";

export type DisclosureProps = {
  title: string;
  /** A value shown on the right of the header, such as "8–12 reps". */
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

/** A card whose header opens and closes its body. Hides the detail until it is asked for. */
export function Disclosure({ title, summary, defaultOpen = false, children }: DisclosureProps) {
  const { colors } = useTheme();
  const { fast } = useMotion();
  const focus = useFocusRing(colors.ink, true);
  const [open, setOpen] = useState(defaultOpen);
  const turn = useSharedValue(defaultOpen ? 90 : 0);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get()}deg` }] }));
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={summary ? t("ui.labelValue", { label: title, value: summary }) : title}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          turn.set(withTiming(open ? 0 : 90, { duration: fast }));
          setOpen(!open);
        }}
        {...focus.handlers}
        style={({ pressed }) => [
          styles.head,
          {
            backgroundColor: pressed ? colors.fill : "transparent",
            borderBottomColor: colors.line,
            borderBottomWidth: open ? 1 : 0,
          },
          focus.style,
        ]}
      >
        <Text type="body-strong" style={styles.title}>
          {title}
        </Text>
        {summary ? (
          <Text type="secondary" color="muted">
            {summary}
          </Text>
        ) : null}
        <Animated.View style={chevron}>
          <Icon name="chevron" size="icon-sm" color="faint" strokeWidth={3} />
        </Animated.View>
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    minHeight: sizes.control,
    paddingHorizontal: spacing[4],
  },
  title: { flex: 1 },
  body: { paddingTop: spacing[3], paddingHorizontal: spacing[4], paddingBottom: spacing[4] },
});
