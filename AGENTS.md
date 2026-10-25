Expo starter app for iOS and Android.

## Stack

Expo SDK 57 (`expo` ~57.0.31), React Native 0.86.3, React 19.2.3, Expo Router ~57.0.29 with typed routes, TypeScript ~6.0.3 (strict), React Compiler. Zustand 5 for client state, Drizzle 1.0 rc on `expo-sqlite` for records, MMKV 4 for settings, Zod 4 at every boundary. Jest with `jest-expo` and React Native Testing Library 14. pnpm.

Continuous Native Generation: `ios/` and `android/` are build output. Never create or edit them. Native config goes in `app.config.ts` and config plugins. A library with native code needs a development build (`pnpm ios`), not Expo Go.

## Expo has changed, do not trust your training data

Expo ships breaking changes every SDK release. Before writing code that touches an Expo, EAS or React Native API:

1. Fetch the versioned docs for SDK 57: `https://docs.expo.dev/versions/v57.0.0/`
2. For anything else, fetch https://docs.expo.dev/llms.txt. It indexes all Expo docs and corrects common LLM mistakes. Follow its links to the page you need. Never answer from memory.

## Commands

```bash
npx expo install <package>  # the only way to add a package, it picks SDK-compatible versions
pnpm verify                 # the gate: picks lint, types, tests, design, deps and config checks from your diff
pnpm verify --visual        # + the simulator tier (manual only): boots the newest Pro Max and runs the .maestro/ flows
pnpm verify --full          # every check on every file, as CI runs it
```

Each `pnpm verify` failure prints as `rule-id: file:line message`. Search `.rules/`, `eslint.config.js`, `src/config.test.ts` or `scripts/guard/` for the rule ID to find out why it exists.

Hooks in `.claude/settings.json`, `.opencode/plugins/guard.js` and `.pi/extensions/guard.js` run the scripts in `scripts/guard/`: ESLint and `tsc` after every edit, `pnpm verify` before the turn ends, and a block on forbidden commands, edits and reads of `.env*` files. The git pre-commit hook runs `pnpm verify` too.

EAS CLI runs as `npx eas-cli@latest <command>`.

## Rules

Read the files that match your change before you edit. paseo-rules judges every diff against `.rules/` after each turn and reports the rule ID it broke.

| You are changing | Read |
|---|---|
| Any `.ts` or `.tsx` under `src/` | `.rules/rn-architecture.md`, `.rules/rn-security.md` |
| Components, lists, animations | `.rules/rn-ui.md`, `.rules/rn-accessibility.md`, `.rules/rn-platform.md` |
| Screens, styles, colours, spacing | `DESIGN.md` (also load the `ui-design` skill) |
| Tests (`*.test.ts(x)`) | `.rules/rn-testing.md` |
| Purchases, paywall, paid features | `.rules/rn-monetization.md` |
| `package.json`, `app.config.ts`, config plugins | `.rules/rn-native-deps.md`, `.rules/rn-store-compliance.md` |
| Anything app-wide (error boundaries, startup, strings, migrations) | `RULES.md` |

Routes live in `src/app/`. Every file there is a screen. Everything else goes in `src/features/<name>/` (imported only through its `index.ts`) or `src/shared/`. `src/features/notes` is the reference feature. Copy its layout.

UI work: verify with `pnpm verify` (it runs `node design/check.mjs`) and nothing else. Don't write your own design checks or render screens. To actually look at a screen, the user runs `pnpm verify:visual` (or `pnpm verify --visual`): it boots one simulator, the newest Pro Max, runs the `.maestro/` flows and writes screenshots to `artifacts/screens/`. Run it yourself only when the user asks you to in this task. Never start it on your own, not even after UI changes. That is the only sanctioned way to get screenshots, and it does not end the rule against hand-rolled screenshot loops or ad-hoc simctl scripting. Add a `.maestro/` flow for a new screen in the same change. After editing `DESIGN.md`, run `node design/check.mjs build`.

When a check fails, fix the cause. Never disable, skip or delete the check or its test. An `eslint-disable` comment needs a reason after `--`.

## Definition of done

`pnpm verify` passes. End every task with:

```
Verified: pnpm verify (tiers: lint, types, related tests, design)
Visual: <screens checked, or "not run: manual only">
Reviewer: <n findings, n fixed, n justified, or "not run: on request only">
Not verified: <anything skipped and why>
```

### Review on request

Run the reviewer only when the user asks for a review. Never run it on your own, at the end of a task or otherwise. When asked, start a Paseo agent: call `list_profiles`, take the profile named "Review" and copy its provider, model, `modeId` and `thinkingOptionId` into `create_agent`, with the initial prompt "Read `.agents/rn-reviewer.md` and follow it. Review the diff since `git merge-base HEAD main`, plus untracked files." Wait for it to finish, then fix each finding or write down why not, tallied in the Reviewer line. Without Paseo, read `.agents/rn-reviewer.md` and apply its checks to your own diff yourself.
