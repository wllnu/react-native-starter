# Agentic Coding Guardrails for React Native

Oct 20, 2026 · @Willi

## Overview

The setup has three layers that each catch a different class of mistake, plus a loop that sends every failure back to the agent with the ID of the rule it broke.

The principle that matters most: every rule is classified by how it is enforced. If a linter can check it, write the lint rule and keep it out of the prose. Prose rules are suggestions an agent forgets deep into a session; checks are not.

Rule files hold only what needs judgment, plus the reasoning behind each check, so the agent fixes failures properly instead of silencing them.

&#91;embedded content: guardrail layers · 4 stages, 1 feedback loop\]

Guidance comes first, deterministic checks run during and after the work, and judgment checks close it out; any failure sends the agent back with a pointer to the rule.

## 1. Rules layer

Keep the root `AGENTS.md` (or `CLAUDE.md`) short: a router, not a manual. It holds the stack, the commands, the definition of done, and pointers to scoped rule files that load only when relevant. Each rule gets a stable ID (for example `RN-LIST-01`) so check output can reference it.

Candidate rule files:

- **Architecture**: feature folder structure, import boundaries, where state lives, no business logic in screens
- **Native and dependencies**: on Expo with CNG, never hand-edit `ios/` or `android/`, use config plugins; add deps only via `npx expo install`; check New Architecture compatibility; justify every new dependency
- **Styling and design system**: tokens only, no raw hex or magic spacing; ties straight into a DESIGN.md if one exists
- **Lists and performance**: FlashList or FlatList for unbounded data, never `.map` inside `ScrollView`; stable keys; memoized `renderItem`; animations on the UI thread via Reanimated; `expo-image` over `Image`
- **Platform and layout**: safe areas, keyboard avoidance, dark mode, Dynamic Type, small and large devices, `Platform.select` conventions
- **Accessibility**: roles and labels on every touchable, 44 pt targets, no meaning by color alone
- **Data and storage**: what goes in SecureStore vs. MMKV/SQLite vs. AsyncStorage; `EXPO_PUBLIC_*` vars are public, so no secrets in the bundle
- **Monetization**: one entitlement hook as the single source of truth, never gate on a local flag, restore-purchases button always reachable
- **App Store compliance**: permission usage strings, privacy manifest, no private APIs, account deletion if the app has accounts
- **Testing**: test behavior via React Native Testing Library role queries, not implementation details

## 2. Deterministic checks

Most rules should end up here:

- **TypeScript strict**, no `any`, typed routes
- **ESLint with custom rules**: ban raw colors in styles, ban `ScrollView` + `.map`, ban RN `Image`, ban `console.log`, enforce import boundaries between features (eslint-plugin-boundaries)
- **Design token check** on changed lines
- **expo-doctor** and dependency version alignment
- **Jest + RNTL** for components and hooks
- **Secret scan**, plus a check that `ios/` and `android/` are not in the diff (for CNG)

Every check prints `RULE-ID: file:line, message, link to rule file`. That traceability is what makes the self-correction loop work.

## 3. Enforcement via hooks

- **On edit**: lint and typecheck the touched file only, for fast feedback inside the turn
- **On stop**: run the verify gate; the agent cannot declare done until it passes
- **Permission denials**: block `expo eject`, edits to native folders, `--no-verify`, deleting tests, and adding `eslint-disable` without a justification comment

The last one matters more than it sounds: agents under pressure tend to disable the check that is failing.

## 4. Runtime and review

Static checks cannot tell you the screen looks broken. This layer is where the agent checks its own work:

- **Tiered verify**: the script picks a tier from what changed. Styles only → visual check. `app.json` or a config plugin → prebuild plus native build. Logic → tests.
- **Visual verification**: build to the iOS simulator, drive to the affected screen with Maestro, and screenshot it in light and dark mode on a small and a large device. The agent then looks at the images against the design system. This catches the class of bug agents are worst at.
- **Log check**: tail Metro and simulator logs for red boxes, yellow-box warnings, and "VirtualizedLists should never be nested".
- **Reviewer subagent**: fresh context, sees only the diff and the rule files, returns findings by rule ID. The main agent fixes or explicitly justifies each one. Fresh context matters because the author agent is invested in its own reasoning.
- **Definition-of-done checklist**: filled in by the agent at the end — what was verified, how, and what was not.

## 5. Keeping it alive

- **Ratchet**: every time you correct the agent, ask "can this be a check?" If yes, add the lint rule; if no, add a prose rule with an ID.
- **Eval the guardrails themselves**: a handful of benchmark tasks ("add a settings screen with a toggle", "add a paginated list") run against the kit after changes, scoring whether the guardrails caught planted mistakes.
- **Packaging**: make it portable across apps — an Expo template repo with the lint config, verify script and Maestro scaffolding, plus a plugin bundling the rule files, hooks and reviewer agent. Keep the rule files tool-agnostic so they work in any agent harness.

## Open question

- [ ] Will all apps be Expo with CNG, or will some be bare projects with hand-maintained native code? The native-code rules and the verify tiers differ a lot between the two.
