---
id: rn-platform
title: React Native platform and layout
paths: **/*.tsx
when: The change adds or edits screens, layout, text containers, the status bar, or platform-specific code.
---

## rn-platform/no-fixed-text-height
Severity: warning
Rule: Let containers of text grow with Dynamic Type.
Violated when: a view in the changed lines that wraps `Text` sets a fixed numeric `height`, or a `Text` rendering body text the user reads in full, such as a note, message or paragraph, sets `numberOfLines`.
Followed when: text containers in the changed lines size with `minHeight`, padding or flex, and `numberOfLines` appears only on short labels or headings.

Good:
```tsx
<View style={styles.bodyWrap}>
  <Text style={styles.body}>{note.text}</Text>
</View>

const styles = StyleSheet.create({
  bodyWrap: { minHeight: 72 },
});
```

Bad:
```tsx
<View style={styles.bodyWrap}>
  <Text numberOfLines={2} style={styles.body}>{note.text}</Text>
</View>

const styles = StyleSheet.create({
  bodyWrap: { height: 72 },
});
```

## rn-platform/no-wide-fixed-width
Severity: warning
Rule: Make layout containers fit a 375-point iPhone SE.
Violated when: a layout container in the changed lines sets a fixed numeric `width` above 320 instead of `flex` or a percentage.
Followed when: full-width layout containers in the changed lines use `flex`, `width: "100%"`, or another percentage.

Good:
```tsx
<View style={styles.pane}>{rows}</View>

const styles = StyleSheet.create({
  pane: { flex: 1, padding: spacing[4] },
});
```

Bad:
```tsx
<View style={styles.pane}>{rows}</View>

const styles = StyleSheet.create({
  pane: { width: 420, padding: spacing[4] },
});
```

## rn-platform/status-bar-auto
Severity: warning
Rule: Let `StatusBar` from `expo-status-bar` follow the color scheme, because every screen renders in both the light and the dark theme.
Violated when: `StatusBar` from `expo-status-bar` in the changed lines gets a literal `style="dark"` or `style="light"` instead of `style="auto"`.
Followed when: `StatusBar` in the changed lines uses `style="auto"`.

Good:
```tsx
<View style={styles.screen}>
  <StatusBar style="auto" />
  {children}
</View>
```

Bad:
```tsx
<View style={styles.screen}>
  <StatusBar style="dark" />
  {children}
</View>
```