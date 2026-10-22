import { useRef, useState, type ReactNode } from "react";
import { FlatList, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { t } from "@/shared/i18n";
import { easingOut, radius, sizes, spacing, useMotion, useTheme } from "@/shared/theme";

import { Icon } from "./Icon";
import { Text } from "./Text";

export type ActionSheetAction = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Shows a check at the right edge of the row and marks it selected to screen readers. */
  selected?: boolean | undefined;
  /** Underlined secondary text, never red. */
  destructive?: boolean | undefined;
};

export type ActionSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Label of the ink cancel row, which also names the scrim. Defaults to "Cancel". */
  cancelLabel?: string | undefined;
  actions?: readonly ActionSheetAction[];
  /** A message row above everything else. `long` left-aligns a paragraph instead of centring a sentence. */
  message?: { title?: string; body: string; long?: boolean };
  /** Extra rows between the message and the actions, such as a settings row. */
  children?: ReactNode;
};

/** One or two surface groups of full-width rows on a transparent Modal, with the cancel row as an ink fill in its own group. */
export function ActionSheet({
  visible,
  onClose,
  cancelLabel = t("ui.cancel"),
  actions = [],
  message,
  children,
}: ActionSheetProps) {
  const { colors } = useTheme();
  const { fast, slow } = useMotion();
  const insets = useSafeAreaInsets();
  const hasRows = actions.length > 0 || children != null;
  // iOS refuses to dismiss a sheet under a Modal that is still closing, and the app is left frozen behind an
  // invisible layer. So on iOS the Modal hides itself first; onClose and the pressed action run once it is gone.
  const [closing, setClosing] = useState(false);
  const pending = useRef<{ action?: () => void } | null>(null);
  const close = (action?: () => void) => {
    if (Platform.OS !== "ios") {
      onClose();
      action?.();
      return;
    }
    pending.current = action ? { action } : {};
    setClosing(true);
  };
  const dismissed = () => {
    const done = pending.current;
    if (!done) return; // the parent hid the sheet itself
    pending.current = null;
    setClosing(false);
    onClose();
    done.action?.();
  };
  return (
    <Modal
      transparent
      visible={visible && !closing}
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => close()}
      onDismiss={dismissed}
    >
      <View style={[styles.root, { paddingTop: Math.max(insets.top, spacing[4]) }]}>
        <Animated.View
          entering={FadeIn.duration(fast)}
          style={[styles.scrimLayer, { backgroundColor: colors.scrim }]}
        >
          <Pressable accessibilityRole="button" accessibilityLabel={cancelLabel} onPress={() => close()} style={styles.scrim} />
        </Animated.View>
        <Animated.View
          entering={SlideInDown.duration(slow).easing(easingOut)}
          accessibilityViewIsModal
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[2]) }]}
        >
          {message || hasRows ? (
            <View style={[styles.group, styles.contentGroup, { backgroundColor: colors.surface }]}>
              <FlatList
                style={styles.scroll}
                keyboardShouldPersistTaps="handled"
                data={actions}
                keyExtractor={(action) => action.label}
                ListHeaderComponent={
                  <>
                    {message ? (
                      <View
                        style={[
                          styles.message,
                          message.long ? styles.long : styles.centred,
                          { borderBottomColor: colors.line, borderBottomWidth: hasRows ? 1 : 0 },
                        ]}
                      >
                        {message.title ? <Text type="body-strong">{message.title}</Text> : null}
                        <Text type="secondary" color="secondary" style={message.long ? undefined : styles.text}>
                          {message.body}
                        </Text>
                      </View>
                    ) : null}
                    {children}
                  </>
                }
                renderItem={({ item: action, index }) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: action.disabled === true, selected: action.selected === true }}
                    disabled={action.disabled === true}
                    onPress={() => close(action.onPress)}
                    style={({ pressed }) => [
                      styles.row,
                      {
                        backgroundColor: pressed ? colors.fill : "transparent",
                        borderBottomColor: colors.line,
                        borderBottomWidth: index === actions.length - 1 ? 0 : 1,
                        opacity: action.disabled === true ? 0.4 : 1,
                      },
                    ]}
                  >
                    <Text
                      type="body-strong"
                      color={action.destructive === true ? "secondary" : "ink"}
                      style={[styles.text, action.destructive === true ? styles.underlined : undefined]}
                    >
                      {action.label}
                    </Text>
                    {action.selected === true ? (
                      <View style={styles.check}>
                        <Icon name="check" />
                      </View>
                    ) : null}
                  </Pressable>
                )}
              />
            </View>
          ) : null}
          <View style={[styles.group, message || hasRows ? styles.cancelGroup : null]}>
            <Pressable
              accessibilityRole="button"
              onPress={() => close()}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors["ink-raised"] : colors.ink }]}
            >
              <Text type="body-strong" color="on-ink" style={styles.text}>
                {cancelLabel}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  scrimLayer: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 },
  scrim: { flex: 1 },
  sheet: { width: "100%", maxWidth: sizes["content-max"], maxHeight: "100%", flexShrink: 1, alignSelf: "center", paddingHorizontal: spacing[2] },
  group: { borderRadius: radius.lg, overflow: "hidden" },
  contentGroup: { flexShrink: 1 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  cancelGroup: { marginTop: spacing[2] },
  message: { padding: spacing[5], gap: spacing[2] },
  centred: { alignItems: "center" },
  long: { alignItems: "stretch" },
  row: { minHeight: sizes.control, paddingHorizontal: spacing[4], alignItems: "center", justifyContent: "center" },
  text: { textAlign: "center" },
  underlined: { textDecorationLine: "underline" },
  check: { position: "absolute", top: 0, bottom: 0, right: spacing[4], justifyContent: "center" },
});
