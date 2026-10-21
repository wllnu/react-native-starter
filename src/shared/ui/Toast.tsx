import { useEffect } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { create } from "zustand";

import { radius, sizes, spacing, useFloatShadow, useMotion, useTheme } from "@/shared/theme";

import { Icon } from "./Icon";
import { Text } from "./Text";

const DWELL_MS = 2400;

type ToastState = {
  message: string;
  /** Shows a check in a round chip before the message. */
  check: boolean;
  visible: boolean;
  /** Bumps on every show, so showing the same message twice still announces twice. */
  id: number;
  show: (message: string, options?: { check?: boolean }) => void;
  hide: () => void;
};

let timer: ReturnType<typeof setTimeout> | undefined;

export const useToastStore = create<ToastState>((set) => ({
  message: "",
  check: false,
  visible: false,
  id: 0,
  show: (message, options) => {
    clearTimeout(timer);
    set((state) => ({ message, check: options?.check === true, visible: true, id: state.id + 1 }));
    timer = setTimeout(() => set({ visible: false }), DWELL_MS);
  },
  hide: () => {
    clearTimeout(timer);
    set({ visible: false });
  },
}));

/** Confirms an action in one line. Never carries an error. */
export function showToast(message: string, options?: { check?: boolean }) {
  useToastStore.getState().show(message, options);
}

/** Sheet hosts share the toast state; only the tab host announces it. `bottomOffset` clears the controls below. */
export function Toast({ bottomOffset = 0, announce = true }: { bottomOffset?: number; announce?: boolean }) {
  const { colors } = useTheme();
  const { fast } = useMotion();
  const shadow = useFloatShadow();
  const insets = useSafeAreaInsets();
  const message = useToastStore((state) => state.message);
  const check = useToastStore((state) => state.check);
  const visible = useToastStore((state) => state.visible);
  const id = useToastStore((state) => state.id);

  const shown = useSharedValue(0);
  useEffect(() => {
    shown.set(withTiming(visible ? 1 : 0, { duration: fast }));
  }, [visible, fast, shown]);
  const animated = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: (1 - shown.get()) * spacing[2] }],
  }));

  // announceForAccessibility works on both platforms. A live region on top of it would read the message twice on Android.
  useEffect(() => {
    if (announce && id > 0) AccessibilityInfo.announceForAccessibility(message);
  }, [announce, id, message]);

  return (
    <View
      pointerEvents="none"
      style={[styles.slot, { bottom: Math.max(insets.bottom, spacing[4]) + spacing[3] + bottomOffset }]}
    >
      <Animated.View
        accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? "yes" : "no-hide-descendants"}
        style={[styles.toast, { backgroundColor: colors.ink }, shadow, animated]}
      >
        {check ? (
          <View style={[styles.chip, { backgroundColor: colors["on-ink"] }]}>
            <Icon name="check" size="icon-sm" color="ink" strokeWidth={2.5} />
          </View>
        ) : null}
        <Text type="secondary-strong" color="on-ink">
          {message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: spacing[4] },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    maxWidth: sizes["content-max"],
    paddingVertical: spacing[2],
    paddingLeft: spacing[3],
    paddingRight: spacing[4],
    borderRadius: radius.full,
  },
  chip: { borderRadius: radius.full, padding: spacing[1] },
});
