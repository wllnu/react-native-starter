---
id: rn-ui
title: React Native components and rendering
paths: **/*.ts, **/*.tsx
when: The change adds or edits React Native components, hooks, lists, animations, or imports from react-native.
---

## rn-ui/no-deep-imports
Severity: error
Rule: Import React Native APIs only from the `react-native` root.
Violated when: an import path starts with `react-native/`, such as `react-native/Libraries/...`.
Followed when: every React Native core import in the changed lines comes from `"react-native"`.

Good:
```ts
import { Alert } from "react-native";
```

Bad:
```ts
import Alert from "react-native/Libraries/Alert/Alert";
```

## rn-ui/safe-area-context
Severity: warning
Rule: Handle safe areas with `react-native-safe-area-context`.
Violated when: `SafeAreaView` is imported from `react-native`.
Followed when: `SafeAreaView` or `useSafeAreaInsets` in the changed lines comes from `react-native-safe-area-context`.

Good:
```tsx
import { SafeAreaView } from "react-native-safe-area-context";
```

Bad:
```tsx
import { SafeAreaView } from "react-native";
```

## rn-ui/keyboard-controller
Severity: warning
Rule: Handle the keyboard with `react-native-keyboard-controller`.
Violated when: `KeyboardAvoidingView` is imported from `react-native`.
Followed when: keyboard handling components in the changed lines come from `react-native-keyboard-controller`.

Good:
```tsx
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
```

Bad:
```tsx
import { KeyboardAvoidingView } from "react-native";
```

## rn-ui/expo-image
Severity: warning
Rule: Render images with `Image` from `expo-image`.
Violated when: `Image` or `ImageBackground` is imported from `react-native`.
Followed when: every image component in the changed lines comes from `expo-image`.

Good:
```tsx
import { Image } from "expo-image";
```

Bad:
```tsx
import { Image } from "react-native";
```

## rn-ui/no-expo-vector-icons
Severity: warning
Rule: Do not import the deprecated `@expo/vector-icons` package.
Violated when: an import path is `@expo/vector-icons` or starts with `@expo/vector-icons/`.
Followed when: icons in the changed lines come from `expo-symbols` or an `@react-native-vector-icons/` package.

Good:
```tsx
import { SymbolView } from "expo-symbols";
```

Bad:
```tsx
import { Ionicons } from "@expo/vector-icons";
```

## rn-ui/window-dimensions
Severity: error
Rule: Read the window size with `useWindowDimensions`, never from a value cached at startup.
Violated when: `Dimensions.get(` is called at module scope, inside `StyleSheet.create`, or its result is stored in a constant outside a component.
Followed when: window width and height in the changed lines come from `useWindowDimensions()` inside a component or hook.

Good:
```tsx
export function WeekStack() {
  const { width } = useWindowDimensions();
  return <WeekTiles width={width} />;
}
```

Bad:
```tsx
const { width } = Dimensions.get("window");

export function WeekStack() {
  return <WeekTiles width={width} />;
}
```

## rn-ui/font-scaling
Severity: warning
Rule: Cap Dynamic Type per component with `maxFontSizeMultiplier` instead of turning scaling off.
Violated when: a `Text` or `TextInput` sets `allowFontScaling={false}`.
Followed when: text that limits scaling in the changed lines sets `maxFontSizeMultiplier` and leaves `allowFontScaling` on.

Good:
```tsx
<Text maxFontSizeMultiplier={1.5}>{groupName}</Text>
```

Bad:
```tsx
<Text allowFontScaling={false}>{groupName}</Text>
```

## rn-ui/accessibility-label-role
Severity: error
Rule: Give every interactive element an accessibility role and a label.
Violated when: a `Pressable`, `TouchableOpacity` or other touchable has no `accessibilityRole`, or has no text child and no `accessibilityLabel`.
Followed when: every touchable in the changed lines sets `accessibilityRole` and has either a text child or an `accessibilityLabel`.

Good:
```tsx
<Pressable accessibilityRole="button" accessibilityLabel="Remove set" onPress={onRemove}>
  <TrashIcon />
</Pressable>
```

Bad:
```tsx
<Pressable onPress={onRemove}>
  <TrashIcon />
</Pressable>
```

## rn-ui/no-manual-memo
Severity: warning
Rule: Write plain components and leave memoisation to React Compiler.
Violated when: the changed lines add a `useMemo(` or `useCallback(` call.
Followed when: derived values and handlers in the changed lines are plain expressions and functions.

Good:
```tsx
const doneSets = sets.filter((set) => set.done);
```

Bad:
```tsx
const doneSets = useMemo(() => sets.filter((set) => set.done), [sets]);
```

## rn-ui/no-setstate-animation
Severity: error
Rule: Never drive an animation by calling a state setter on every frame.
Violated when: a `useState` setter is called inside a `requestAnimationFrame` loop, a gesture `onUpdate` or `onChange` callback, or an `onScroll` handler to move or resize a view.
Followed when: per-frame values in the changed lines are Reanimated shared values read in `useAnimatedStyle`.

Good:
```tsx
const offset = useSharedValue(0);
const pan = Gesture.Pan().onUpdate((event) => {
  offset.value = event.translationX;
});
```

Bad:
```tsx
const [offset, setOffset] = useState(0);
const pan = Gesture.Pan()
  .runOnJS(true)
  .onUpdate((event) => setOffset(event.translationX));
```

## rn-ui/animate-transform-opacity
Severity: warning
Rule: Animate `transform` and `opacity` instead of layout properties.
Violated when: a `useAnimatedStyle` callback or animated style animates `width`, `height`, `top`, `left`, `margin` or `padding`.
Followed when: animated styles in the changed lines change only `transform` and `opacity`.

Good:
```tsx
const style = useAnimatedStyle(() => ({
  transform: [{ scaleX: progress.value }],
}));
```

Bad:
```tsx
const style = useAnimatedStyle(() => ({
  width: progress.value * trackWidth,
}));
```

## rn-ui/stable-list-keys
Severity: warning
Rule: Give list items stable keys.
Violated when: a `keyExtractor` returns the item index, or a mapped element sets `key` to the array index.
Followed when: every list key in the changed lines comes from a field of the item, such as `item.id`.

Good:
```tsx
<FlashList data={sets} renderItem={renderSet} keyExtractor={(item) => item.id} />
```

Bad:
```tsx
<FlashList data={sets} renderItem={renderSet} keyExtractor={(_, index) => String(index)} />
```

## rn-ui/no-interaction-manager
Severity: error
Rule: Schedule background work with `requestIdleCallback`, not `InteractionManager`.
Violated when: the changed lines import or call `InteractionManager`.
Followed when: deferred work in the changed lines is scheduled with `requestIdleCallback(`.

Good:
```ts
requestIdleCallback(() => pruneOldDrafts());
```

Bad:
```ts
InteractionManager.runAfterInteractions(() => pruneOldDrafts());
```
