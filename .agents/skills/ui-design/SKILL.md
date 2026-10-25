---
name: ui-design
description: Design rules for any UI work in this repo. Use whenever building, changing or styling a screen, page, component, layout, form, list, table, chart or empty state, on web or React Native, including small tweaks to spacing, colour or copy.
---

# UI design for this app

1. **Before building:** read `DESIGN.md`. Use its tokens and type roles (via `design/theme.css` utilities or `design/tokens.ts`), its listed components, and the composition it gives for the screen's task. Don't read the generated theme files.
2. **While building:** no raw hex, no sizes or spacing outside the scale, no arbitrary Tailwind values, nothing from the Don'ts list.
3. **When done:** run `node design/check.mjs` once. It checks only the lines you changed. Fix what it reports and run it again until it passes. A deliberate exception gets a `design-ignore: <reason>` comment.

This is the only design verification step. Don't write your own check scripts or greps, and don't render pages unless the user asks. To look at a real screen on a device, add or reuse a flow in `.maestro/`; `pnpm verify:visual` runs it, but only when the user asks for it, never on your own. That is the only sanctioned way to get screenshots, and hand-rolled screenshot loops are still off limits. `design/check.mjs` still checks your changed lines; the screenshots are for judgment (composition, spacing, dark mode), not a replacement.

If you change `DESIGN.md`, run `node design/check.mjs build` to regenerate the theme files.
