---
id: rn-accessibility
title: React Native accessibility
paths: **/*.tsx
when: The change adds or edits touchable elements, icons, status indicators, or async actions.
---

## rn-accessibility/touchable-label
Severity: error
Rule: Give every icon-only touchable an accessible name.
Violated when: a `Pressable`, `TouchableOpacity` or other touchable in the changed lines has no text child and no `accessibilityLabel`, or an `IconButton` is rendered with no `label` prop.
Followed when: every icon-only touchable in the changed lines sets `accessibilityLabel`, and `IconButton` sets its `label` prop.

Good:
```tsx
<Pressable accessibilityRole="button" accessibilityLabel="Remove set" onPress={onRemove}>
  <Icon name="trash" size="icon" />
</Pressable>
```

Bad:
```tsx
<Pressable accessibilityRole="button" onPress={onRemove}>
  <Icon name="trash" size="icon" />
</Pressable>
```

## rn-accessibility/min-touch-target
Severity: warning
Rule: Keep touch targets at least 44 by 44 points.
Violated when: a style on a touchable in the changed lines sets `width` or `height` below 44 and no `hitSlop` makes up the difference.
Followed when: touchables in the changed lines set `width` and `height` of at least 44, such as the app's `touchMin` token, or set `hitSlop` to reach 44.

Good:
```tsx
<Pressable accessibilityRole="button" accessibilityLabel="Remove set" style={{ width: touchMin, height: touchMin }} onPress={onRemove}>
  <Icon name="trash" size="icon" />
</Pressable>
```

Bad:
```tsx
<Pressable accessibilityRole="button" accessibilityLabel="Remove set" style={{ width: 32, height: 32 }} onPress={onRemove}>
  <Icon name="trash" size="icon" />
</Pressable>
```

## rn-accessibility/no-color-only-state
Severity: warning
Rule: Pair a color-only state change with text, an icon, or `accessibilityState`.
Violated when: a color in the changed lines switches on a state such as error, selected or done, and the changed lines show that state no other way, with no conditional text, conditional icon or `accessibilityState`.
Followed when: a state shown by color in the changed lines also appears as text, an icon, or `accessibilityState`.

Good:
```tsx
<View
  accessibilityState={{ selected }}
  style={[styles.row, { backgroundColor: selected ? colors.fill : colors.surface }]}
>
  <Text>{name}</Text>
</View>
```

Bad:
```tsx
<View style={[styles.row, { backgroundColor: selected ? colors.fill : colors.surface }]}>
  <Text>{name}</Text>
</View>
```

## rn-accessibility/announce-async-results
Severity: warning
Rule: Announce the result of an async action with the app's Toast or `AccessibilityInfo.announceForAccessibility`.
Violated when: the changed lines render a status or result message produced by async work, such as saved, failed or pending feedback, without calling `showToast(` or `AccessibilityInfo.announceForAccessibility(`.
Followed when: async results in the changed lines go through `showToast(`, which announces itself, or an explicit `AccessibilityInfo.announceForAccessibility(` call.

Good:
```tsx
function save() {
  saveNote(text).then(() => showToast(t("note.saved")));
}
```

Bad:
```tsx
const [status, setStatus] = useState("");

function save() {
  saveNote(text).then(() => setStatus(t("note.saved")));
}

<Text type="secondary">{status}</Text>
```