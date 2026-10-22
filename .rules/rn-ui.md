---
id: rn-ui
title: React Native components and rendering
paths: **/*.ts, **/*.tsx
when: The change edits animations or list keys in React Native components.
---

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
Rule: Build list keys from the item's unique id.
Violated when: a `key` prop or `keyExtractor` uses a value created at render time, such as `Math.random()`, `Date.now()` or `crypto.randomUUID()`, or a display field two items can share, such as `item.name` or `item.title`.
Followed when: every list key in the changed lines comes from the item's id field, such as `item.id`.

Good:
```tsx
<FlashList data={sets} renderItem={renderSet} keyExtractor={(item) => item.id} />
```

Bad:
```tsx
<FlashList data={sets} renderItem={renderSet} keyExtractor={(item) => item.title} />
```