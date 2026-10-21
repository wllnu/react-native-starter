import { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { motion } from "../../../design/tokens";

export const easingOut = Easing.bezierFn(0.16, 1, 0.3, 1);

/** The motion durations, all zero under reduced motion. */
export function useMotion() {
  const reduced = useReducedMotion();
  return reduced
    ? { fast: 0, base: 0, slow: 0 }
    : { fast: motion.fast, base: motion.base, slow: motion.slow };
}

/** Scale-down press feedback for ink fills and round buttons. Spread `handlers` on the Pressable and `style` on the view inside it. */
export function usePressScale(to: number) {
  const { fast } = useMotion();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return {
    style,
    handlers: {
      onPressIn: () => {
        scale.set(withTiming(to, { duration: fast }));
      },
      onPressOut: () => {
        scale.set(withTiming(1, { duration: fast }));
      },
    },
  };
}
