---
version: alpha
name: Starter
description: A neutral design system for an Expo app. Replace the overview, the colours and the type scale with your product's own.
colors:
  ink: "#18181b"            # text, icons and every strong fill
  ink-raised: "#2e2e33"     # pressed ink fills
  on-ink: "#ffffff"         # text and icons on ink
  on-ink-muted: "#a1a1aa"   # secondary text on ink
  secondary: "#4b4b53"      # supporting text the user reads
  muted: "#66666f"          # values, labels, captions
  canvas: "#f4f4f5"         # page, sheets, input wells
  surface: "#ffffff"        # cards, the tab bar, action groups
  line: "#18181b14"         # hairline dividers
  fill: "#18181b0f"         # pressed states, quiet control fills
  scrim: "#18181b73"        # behind sheets
  faint: "#c4c4c9"          # chevrons, grabber, switch off track
  accent: "#2563eb"         # the current tab
typography:
  title:            { fontFamily: "system-ui", fontSize: 28px, fontWeight: 700, lineHeight: 1.15 }
  heading:          { fontFamily: "system-ui", fontSize: 20px, fontWeight: 600, lineHeight: 1.25 }
  button:           { fontFamily: "system-ui", fontSize: 17px, fontWeight: 600, lineHeight: 1.25 }
  body:             { fontFamily: "system-ui", fontSize: 17px, fontWeight: 400, lineHeight: 1.35 }
  body-strong:      { fontFamily: "system-ui", fontSize: 17px, fontWeight: 600, lineHeight: 1.35 }
  secondary:        { fontFamily: "system-ui", fontSize: 15px, fontWeight: 400, lineHeight: 1.35 }
  secondary-strong: { fontFamily: "system-ui", fontSize: 15px, fontWeight: 600, lineHeight: 1.35 }
  caption:          { fontFamily: "system-ui", fontSize: 12px, fontWeight: 400, lineHeight: 1.35 }
  kicker:           { fontFamily: "system-ui", fontSize: 12px, fontWeight: 700, lineHeight: 1.25, letterSpacing: 0.08em }
rounded:
  sm: 8px
  md: 16px
  lg: 20px
  xl: 24px
  full: 9999px
spacing:
  "1": 4px
  "2": 8px
  "3": 12px
  "4": 16px
  "5": 20px
  "6": 24px
  "12": 48px
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: "{sizes.control}"
  button-quiet:
    textColor: "{colors.secondary}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    height: "{sizes.control}"
  button-quiet-pressed:
    backgroundColor: "{colors.fill}"
  text-button:
    textColor: "{colors.ink}"
    typography: "{typography.secondary-strong}"
    height: "{sizes.touch-min}"
  icon-button:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.full}"
    size: "{sizes.touch-min}"
  field:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    height: "{sizes.touch-min}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  list-row:
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    height: "{sizes.row}"
  list-row-pressed:
    backgroundColor: "{colors.fill}"
  tab-bar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
  tab-current:
    textColor: "{colors.accent}"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    typography: "{typography.secondary-strong}"
    rounded: "{rounded.full}"
  sheet:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.xl}"
  action-group:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
themes:
  dark:
    ink: "#f4f4f5"
    ink-raised: "#dcdce0"
    on-ink: "#18181b"
    on-ink-muted: "#5b5b63"
    secondary: "#b4b4bc"
    muted: "#9b9ba4"
    canvas: "#0f0f11"
    surface: "#1c1c20"
    line: "#ffffff1f"
    fill: "#ffffff14"
    scrim: "#00000099"
    faint: "#4a4a51"
    accent: "#7aa7ff"
motion:
  fast: 120ms
  base: 200ms
  slow: 320ms
  easing-out: "cubic-bezier(0.16, 1, 0.3, 1)"
sizes:
  touch-min: 44px
  touch-min-android: 48px
  row: 52px
  control: 56px
  icon: 24px
  icon-sm: 16px
  content-max: 430px
platforms:
  targets: [ios, android]
checks:
  strict: true
  banned: [gradient, glass, em-dash, emoji-in-ui]
  exclude: []
---

## Overview

This is the starting design system for a new app. It is deliberately plain: a grey ink scale, white cards on a light grey canvas, the system font and one accent colour. Rewrite this overview with who uses the app, where and why, then adjust the tokens to match. Keep the structure, because the agent and `design/check.mjs` read it.

Signature decisions to protect until you replace them:
- Greys do the work. `accent` is the only colour, and it has one job.
- Selection and primary actions are an ink fill.
- Every screen answers one question and leads with one object.

## Scope and priorities

Applies to all product UI on iOS and Android. It does not cover store listings or a marketing site.

When rules conflict, protect in this order:
1. Correct data and user input. Nothing the user typed is lost or shown wrong.
2. The screen's main task is obvious.
3. Accessibility: contrast, targets, focus.
4. Existing components and tokens, with no new values.
5. The look.
6. Polish and motion.

## Colors

`ink` and `on-ink` swap in dark mode, so `ink` is light there. Write "ink fill" and "on-ink text", never "black" and "white".

- `ink`: text, icons and every strong fill. That means the primary button, the toast and the cancel row of an action sheet. Also the focus ring.
- `ink-raised`: the pressed state of an ink fill. Never a surface of its own.
- `on-ink`: text and icons on an ink fill. `on-ink-muted`: secondary text on an ink fill.
- `secondary`: supporting text the user reads to act, such as explanations, quiet buttons and action-sheet messages.
- `muted`: values, field labels, captions and small icons. Never for an instruction or an error.
- `canvas`: the page, sheets and the wells of fields. `surface`: cards, the tab bar and action groups. A well on a card uses `canvas`, so the two always alternate.
- `line`: 1px dividers between rows in one card, and the top edge of the tab bar. Never a border around a card.
- `fill`: pressed state on `surface` or `canvas`, and the resting fill of quiet controls such as the close button.
- `scrim`: behind an open action sheet. Nothing else.
- `faint`: chevrons, the sheet grabber and the off track of a switch. Never text, because it fails contrast.
- `accent`: the icon and label of the current tab. Never on buttons, body text or selection. Selection is always an ink fill.
- Dark mode uses `themes.dark`. Cards separate from the canvas by tone alone.

## Typography

One voice: the system font, so text matches the platform and scales with the OS setting.

- `title`: sheet titles and the one headline of a screen.
- `heading`: the name of the object a detail screen shows.
- `button`: the primary button.
- `body`: default text. `body-strong`: row titles, action-sheet buttons, quiet buttons.
- `secondary`: values in rows, explanations, summaries. `secondary-strong`: text buttons, the toast, inline errors.
- `caption`: dates, field hints, legends. Never for anything the user must read to continue.
- `kicker`: field labels and the state line above a title.

Rules:
- Text is sentence case. `kicker` is the one exception and stays uppercase and tracked, set with a text transform.
- A `kicker` sits above a title only when it carries state. Don't add one as decoration.
- Every number that changes or lines up uses tabular figures.
- Peers share a role. Don't step one row up to `heading` to make it stand out.

## Layout

- One column, `content-max` wide, centred. Page padding is space 4.
- Within a card: space 1 to 3. Card padding: space 4. Between cards: space 3. Space 12 only separates a destructive action from the rest of a sheet.
- The parent owns the gap. Use `gap`, not sibling margins.
- Rows are `row` tall, primary and quiet buttons `control`. Nothing tappable is shorter than `touch-min`.
- The tab bar sits at the bottom on `surface` with a `line` on top. Scrolling content clears it and the safe area.
- Sheets rise from the bottom. A sheet has a head with grabber, title and close button, a scrolling body, and an optional foot that holds the one primary button.
- Nothing changes with width except the centred column.

## Elevation & Depth

Tone first: `canvas`, then `surface`, then an ink fill. Two shadows exist.

- `shadow-card`: a 1px lift under cards in light mode. Off in dark mode.
- `shadow-float`: under the toast only, because it floats over content.
- The focus ring on a field is a 2px ink ring drawn inside the well. That is a ring and adds no depth.
- No other shadows. Action sheets separate with `scrim`, not a shadow.

## Shapes

- `rounded.sm`: fields and text buttons.
- `rounded.md`: primary and quiet buttons.
- `rounded.lg`: cards and action groups.
- `rounded.xl`: the top corners of a sheet.
- `rounded.full`: round icon buttons, the toast, the grabber.
- A control inside a padded container uses the container's radius minus the padding.

## Components

Use these. Don't build look-alikes. If something is missing, compose it from these and say so in your summary.

- Card: a `surface` container for one object or one group of rows. Never a card inside a card.
- List row: title left, value right in `muted`, chevron in `faint`. Pressed state is `fill`.
- Primary button: full width, `control` tall, one per sheet, in the sheet foot.
- Quiet button: same size, no fill, `secondary` text. Text button: `touch-min` tall, for inline actions. A destructive text button is `secondary` with an underline.
- Icon button: round, `touch-min`. The glyph is `icon` or `icon-sm`.
- Field: visible `kicker` label above, `canvas` well, hint below in `caption`. A placeholder is an example, never the label.
- Disclosure: a card whose header opens and closes its body.
- Switch: the platform switch, as the trailing part of a list row, for a setting that is on or off. The track is `ink` when on and `faint` when off, and the thumb is `on-ink`.
- Tab bar: the platform tab bar on `surface`. The current tab is `accent`, the others `muted`.
- Sheet: a form-sheet route with grabber, drag to dismiss and a close button.
- Action sheet: one or two `surface` groups of full-width rows, with the cancel row as an ink fill in its own group. A message row may come first. A row with `selected` shows a check, and a destructive row is `secondary` with an underline. Confirmations use this sheet too, never a system alert.
- Toast: one line, optional check icon, gone after a moment. Confirms an action and never carries an error.

Every interactive component has pressed and focus states. Disabled is half opacity. An empty list says in one sentence what belongs there and offers the action that fills it.

## Composition by task

- List (browse): the rows are the screen. One card of list rows, newest first, and the action that adds one.
- Detail (read): the object's name as `heading`, its date in `caption`, then its content. The destructive action sits last, separated by space 12.
- Create (input): a sheet with the fields in one card and the primary button in the foot.
- Configure: settings are list rows in cards, grouped by what they change.
- Before building a screen, name its one question and its one focal object. If you can't, the screen is doing two jobs.

## Content

- One short, plain sentence on screen. A longer explanation goes behind a disclosure.
- Never shorten copy by dropping words.
- Buttons name the outcome: "Add note", "Delete note".
- Numbers carry their unit with a space ("12 kB"). Ranges use an en dash ("8–12"). Separate facts with a middle dot.
- No em dashes and no emoji anywhere in the UI. Icons are 24px line drawings in the current text colour.

## Accessibility

- WCAG 2.2 AA. Text 4.5:1, large text and control boundaries 3:1.
- Targets are at least `touch-min` on iOS and `touch-min-android` on Android. Extend the hit area before enlarging the visual.
- Focus is a 2px ring in `ink` with a 2px offset, or in `on-ink` on an ink fill. Where a card clips the ring, inset it.
- Colour never works alone. The current tab has its accent and the screen's title, a selected row has its check.
- Status changes such as the toast are announced.
- Motion durations drop to zero under reduced motion. Layouts hold at 200% text size, so don't fix the height of anything that holds a sentence.

## Motion

- `fast`: press feedback, toggles, the toast. `base`: a sheet settling back after a cancelled drag. `slow` with `easing-out`: an action sheet rising.
- Press feedback is one of two things. Ink fills and round buttons scale down slightly, and rows and quiet controls take a `fill` background.
- Nothing loops and nothing animates on scroll.

## Platform notes

**React Native.** Import from `design/tokens.ts`. No raw numbers or hex in styles except 0, 1 and flex values. Text uses the system font and scales with the OS setting.

What changes on native:
- `shadow-card` may be dropped on Android if it renders heavier than a hairline. `shadow-float` stays on the toast.
- Sheets use the platform form sheet with a drag handle. A bar above the keyboard holds previous, next and Done.
- Read the colour scheme from the OS and pick `colors` or `darkColors`.

## Do's and Don'ts

Don't:
- Add gradients.
- Use native menus or alerts. Choices and confirmations use the action sheet.
- Use glass or backdrop blur. Layers separate by tone and `scrim`.
- Put em dashes or emoji in UI copy.
- Add a second colour, or widen the job of `accent`.
- Mark selection, links or primary actions with `accent`. They are ink fills.
- Nest cards, or draw borders around cards.
- Compress explanations into fragments.

Do:
- Let one object lead each screen.
- Show selection by filling with `ink`.
- Put a longer explanation behind a disclosure.

## Self-review

Before handing off UI work:
1. Squint at it. Is there one focal object?
2. Every colour, size, spacing and radius comes from a token. No new components.
3. It works at 320px width without horizontal scroll, in light and in dark.
4. Text is sentence case, except kickers.
5. Every tappable thing meets the touch minimum and has pressed and focus states.
6. Empty states exist, and on-screen copy is one plain sentence.
7. Nothing on the Don't list appears.
8. Run `node design/check.mjs` once and fix what it reports. Don't write other verification scripts or take screenshots unless asked.
