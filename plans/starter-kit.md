# Turn Overload into an agentic React Native starter kit

Status: step 1 done (2026-10-21). Steps 2 to 4 done (2026-10-22). Step 5 done (2026-10-25): `pnpm verify:visual` with the log check and `.maestro/` flows, the `rn-reviewer` agent and the new definition of done. The Maestro flows have not run yet because Maestro was not installed. Steps 6 to 8 not started.
Written 2026-10-21 against `overload/` (Expo SDK 57, React Native 0.86, Expo Router, pnpm) and `Agentic Coding Guardrails for React Native.md`.

## Goal

Someone runs one command, gets an Expo app that builds and passes its own checks, and points a coding agent at it. The agent gets fast feedback after every edit, cannot finish while a check fails, and every failure names the rule it broke and where to read why.

Two jobs:

1. Remove Overload, the workout app, and keep the parts every app needs.
2. Turn the guardrail doc into working config: rule files, lint rules, hooks, a verify gate, visual checks and a way to test the guardrails themselves.

## Decisions made in this plan

These are my calls. Change any of them before step 1 starts, because later phases depend on them.

- **Expo with CNG only.** That answers the guardrail doc's open question. Overload already works this way, `ios/` and `android/` are gitignored, and supporting bare projects would double the native rules and verify tiers. A bare variant can come later as a separate ruleset.
- **The app moves to the repo root.** `overload/` goes away. Templates for `create-expo-app --template` and GitHub's "Use this template" expect `package.json` at the root, and the current `../design/tokens.ts` import from `app.config.ts` and `shared/theme` only exists because of the split.
- **Keep the generic infrastructure, delete the features.** Storage, monitoring, analytics, i18n, theme, the database client and a few UI primitives stay. Everything under `src/features/` goes.
- **One small example feature stays in.** Agents copy whatever pattern they find. With an empty `features/` folder they invent one. A tiny "notes" feature (list, detail, create, one store, one table, tests) shows the folder layout, the public `index.ts`, live queries and RNTL tests in about ten files. It's also the target for the guardrail evals in step 7.
- **Optional services stay off without keys.** Sentry, Aptabase and RevenueCat already do nothing when their env var is missing (`bd0293c` did this for the paywall). The starter keeps them in that state, so a fresh clone runs with zero accounts.
- **pnpm stays.** The agent still adds packages with `npx expo install`, which detects pnpm.

## Step 1. Strip the app

### Move

- `overload/*` to the repo root. Merge `overload/AGENTS.md` into the root one (step 2 rewrites it anyway). `design/` stays where it is, which puts it next to `src/`.
- Fix the paths: `app.config.ts` imports `./design/tokens.ts`, `src/shared/theme/index.ts` imports `../../../design/tokens`, `metro.config.js` drops the extra `watchFolders` entry.

### Delete

- `src/features/*` except what the example feature needs.
- All routes in `src/app/` except `_layout.tsx` and a two-tab shell, `(tabs)/index.tsx` and `(tabs)/settings.tsx`. Settings keeps the crash-report switch, because the privacy setup in `shared/monitoring` assumes the user can turn reports off.
- `db-check.tsx`, `share.tsx`, `paywall.tsx` and the other sheet routes. The root `_layout.tsx` loses `WorkoutRuntime`, `configurePurchases` and the nine `Stack.Screen` sheet entries. Keep one sheet route from the example feature, so the `formSheet` options have a working example.
- Overload-specific UI in `src/shared/ui`: `MeterHeader`, `Spotlight`, `Stepper`, `TabTrack`, `SheetHead`/`SheetFoot` if the example sheet doesn't use them. Keep `Text`, `PrimaryButton`, `QuietButton`, `TextButton`, `IconButton`, `Icon`, `Card`, `ListRow`, `Field`, `KeyboardBar`, `Toast`, `Confirm`, `ActionSheet`, `Disclosure` and their tests.
- `drizzle/` migrations, `shared/db/schema.ts` tables, `seed.ts`, `prune.ts` and the release-1 fixture. Generate a fresh first migration for the example feature's table. Keep the migration test pattern from `migrations.test.ts`, because `RULES.md` requires it.
- Dependencies only Overload uses: `expo-audio`, `expo-keep-awake`, `expo-image-picker`, `expo-sharing`, `react-native-view-shot`, `@expo-google-fonts/barlow-condensed`. Check each with a grep after the code is gone. `react-native-purchases` is a judgment call (see open questions).
- `plans/*.md` for Overload. Already deleted in the working tree.

### Neutralise

- `analytics` `Events`: replace the workout events with `app_opened` and one example event. `trainedWeeks` goes.
- `monitoring.scrubMessage`: keep. Drizzle leaking bound values into errors is true for every app.
- `i18n/en.ts`: only the strings the shell and example use.
- `DESIGN.md`: replace Overload's system with a neutral one in the same structure (a grey ink scale, one accent, system font, the same spacing and radius scale). Then run `node design/check.mjs build` to regenerate `design/tokens.ts` and `design/theme.css`. The `ui-design` skill and `check.mjs` stay unchanged. Their copy says "Overload" in two places.
- Identifiers. Every Overload or account value moves into one block at the top of `app.config.ts` with placeholder values: app name, slug, scheme, bundle id prefix (`caturra.studio.overload`), EAS `projectId`. `eas.json` loses the Sentry DSN, the Aptabase key and `SENTRY_ORG: "wllnu"`. Those go in EAS environment variables per project. Icons and splash images become plain placeholders. `LICENSE`, `README.md` and `package.json` `name` get rewritten.

### Done when

`pnpm install && pnpm lint && pnpm typecheck && pnpm test && npx expo-doctor` pass at the root, `pnpm ios` opens the two-tab shell, and `git grep -i -e overload -e workout -e caturra -e wllnu` returns nothing outside `plans/`.

## Step 2. Rules layer

### Root AGENTS.md as a router

`CLAUDE.md` keeps `@AGENTS.md`. `AGENTS.md` stays under about 60 lines and holds only:

- The stack with exact versions, and the existing "Expo has changed, fetch versioned docs" section from `overload/AGENTS.md`.
- The commands: `pnpm verify`, `pnpm verify:visual`, `npx expo install`.
- The definition of done (step 5).
- A table that maps paths and topics to rule files. Each rule file loads only when relevant.
- One line on what to do when a check fails: fix the cause, never disable the check. An `eslint-disable` needs a reason after `--`.

### Rule IDs

The existing `.rules/` files already use stable IDs like `rn-ui/stable-list-keys`, and the paseo-rules plugin judges them after every turn. I'm keeping that format instead of the doc's `RN-LIST-01` style, because the current IDs already say what they're about and nothing else would change. Lint messages print the same IDs.

### Split each rule by how it's enforced

The guardrail doc's main point: if a linter can check it, the linter checks it, and the prose rule goes. A rule that lives in both places gets judged twice and drifts. For each rule in `.rules/`:

| Enforcement | Rules | What happens to the prose |
|---|---|---|
| ESLint, built-in rules | `rn-ui/no-deep-imports`, `rn-ui/safe-area-context`, `rn-ui/keyboard-controller`, `rn-ui/expo-image`, `rn-ui/no-expo-vector-icons`, `rn-ui/no-interaction-manager`, `rn-ui/window-dimensions`, `rn-ui/no-manual-memo`, `rn-security/no-async-storage`, `rn-security/https-only`, `rn-testing/no-react-test-renderer` | Removed from `.rules/`. The reason moves into the lint message and a comment above the rule in `eslint.config.js`. |
| ESLint, needs type info or a plugin | `rn-testing/await-rntl` (`@typescript-eslint/no-floating-promises`), `rn-architecture/feature-public-api` and `rn-architecture/dependency-direction` (`import/no-restricted-paths`, already installed through `eslint-config-expo`) | Same. |
| Partly lintable | `rn-ui/accessibility-label-role`, `rn-ui/stable-list-keys`, `rn-ui/font-scaling`, `rn-architecture/store-selectors`, `rn-security/no-sensitive-logs` (`no-console` catches some) | Lint catches the obvious case. The prose keeps only the part that needs judgment. |
| Config test | `rn-app-config/keep-ats-on`, `rn-app-config/fingerprint-runtime-version`, `rn-tsconfig/strict-flags` | One Jest test loads the resolved Expo config and `tsconfig.json` and asserts the values. Prose removed. |
| Judgment | `rn-architecture/no-io-in-components`, the `validate-*` rules, `no-server-data-in-store`, `live-queries`, `no-param-mirroring`, `layout-auth-gating`, `typed-app-errors`, `rn-security/secure-token-storage`, `oauth-pkce`, `universal-link-auth-callback`, `no-webview-token-injection`, `no-tokens-in-links`, `rn-ui/no-setstate-animation`, `animate-transform-opacity`, `rn-testing/query-by-role`, `mock-network-boundary` | Stays in `.rules/`. |

I haven't read every rule's full criteria yet. Some rows may move when I write the lint config, for example if `font-scaling` turns out to be a single attribute check.

### New rulesets

Written with the `write-ruleset` skill so they match the existing format. Only rules that need judgment go in. Each lintable item goes to step 3 instead.

- `rn-native-deps`: no hand edits to native folders, native config through config plugins, check New Architecture support before adding a package, write one sentence on why a new dependency is needed and which Expo module was ruled out.
- `rn-platform`: dark mode on every new surface, Dynamic Type up to the largest size without clipping, small (iPhone SE) and large devices, `Platform.select` instead of scattered `Platform.OS` checks.
- `rn-accessibility`: 44 pt targets (lint can't see layout), no meaning by colour alone, reading order, announcing async results. Moves `accessibility-label-role` here from `rn-ui`.
- `rn-monetization`: one entitlement hook as the only source of truth, never gate on a local flag, restore purchases always reachable. Only if RevenueCat stays.
- `rn-store-compliance`: usage strings for every permission, privacy manifest updated with every SDK, account deletion when there are accounts, no private APIs.

`RULES.md` has the rules no single diff can prove. Most of them become rules for the reviewer agent in step 5. The few that map to a ruleset move there (privacy manifest to `rn-store-compliance`, `CADisableMinimumFrameDurationOnPhone` to the config test).

### What step 2 shipped (2026-10-22)

- `AGENTS.md` is the router. It lists `pnpm lint`, `typecheck` and `test` because `pnpm verify` doesn't exist yet. Step 3 swaps in `pnpm verify`, step 5 adds `verify:visual` and the full definition of done.
- Removed from `.rules/` and not enforced until step 3 lands: every rule in the first three rows of the table, plus `rn-ui/font-scaling` (a single attribute check, so it went to lint after all). `rn-app-config.md` and `rn-tsconfig.md` are deleted. The removed prose, with the reasons for the lint messages, is in `70f336b`.
- Renamed: `rn-architecture/store-selectors` is now the lint ID for a store hook called with no selector. The prose rule is `rn-architecture/stable-selector-output` (an object or array selector without `useShallow`). `rn-ui/accessibility-label-role` became `rn-accessibility/touchable-label` (label only). Lint owns the role part as `rn-accessibility/touchable-role`.
- New lint items for step 3: `Platform.OS ===` ternaries (use `Platform.select`), `react-native-purchases` imported outside `src/features/pro/`, index keys (`react/no-array-index-key`), and the `rn-native-deps/expo-module-first` package list, which is a deny-list that `verify` could check in place of the classifier.
- Left to `RULES.md` or the step 5 reviewer: New Architecture support and a stated reason for every new dependency, a privacy manifest update for every new SDK, account deletion, no private APIs, reading order.
- Found, not fixed: `rn-architecture/no-server-data-in-store` tells agents to use TanStack Query, which isn't installed, and `rn-ui/stable-list-keys` uses FlashList in its examples, which isn't installed either.

## Step 3. Deterministic checks

### ESLint

`eslint.config.js` today is `eslint-config-expo` and nothing else. Add, in this order of value:

- `no-restricted-imports` with one entry per banned import. The `message` field carries the rule ID and the fix: `"rn-ui/expo-image: import Image from expo-image (disk cache, placeholders)."` ESLint prints it as is, which gives `RULE-ID: file:line, message` without a custom formatter.
- `no-restricted-syntax` for patterns imports can't express: `.map()` inside a `ScrollView` (selector `JSXElement[openingElement.name.name='ScrollView'] CallExpression[callee.property.name='map']`), `Dimensions.get`, `http://` string literals, `InteractionManager`.
- `import/no-restricted-paths` for `app → features → shared`, and for imports that reach past a feature's `index.ts`. This avoids adding `eslint-plugin-boundaries`. If the zone config gets unreadable, switch to boundaries.
- Typed linting (`parserOptions.projectService`) with `@typescript-eslint/no-floating-promises`, `no-explicit-any`, `no-unsafe-*`. RNTL 14's `render` and `fireEvent` return promises, so `no-floating-promises` enforces `rn-testing/await-rntl` for free.
- `no-console` with `warn` and `error` allowed.
- `@eslint-community/eslint-plugin-eslint-comments` with `require-description` and `no-unlimited-disable`. That's the one new dependency here. It's the cheapest way to stop agents from silencing a failing check without saying why.

Design tokens stay with `design/check.mjs`, which already checks changed lines for raw hex and off-scale values.

### Config test

`src/config.test.ts` (or `tests/config.test.ts`) resolves `app.config.ts` and reads `tsconfig.json`, then asserts ATS is on, `runtimeVersion.policy` is `fingerprint`, `CADisableMinimumFrameDurationOnPhone` is set, the strict flags are on, and `typedRoutes` and `reactCompiler` are on. Each failing assertion message starts with its rule ID.

### The verify gate

`scripts/verify.mjs` behind `pnpm verify`. One command so agents, hooks, git hooks and CI run the same thing. It reads `git diff --name-only` against the merge base plus untracked files and picks a tier:

| Changed | Runs |
|---|---|
| Anything | ESLint on changed files, `tsc --noEmit`, the native-folder and secret checks below |
| `*.ts(x)` under `src/` | Jest with `--findRelatedTests` on the changed files |
| `*.tsx` or `DESIGN.md` | `node design/check.mjs` |
| `package.json`, lockfile | `npx expo install --check`, `npx expo-doctor` |
| `app.config.ts`, `eas.json`, a config plugin | Config test, `npx expo prebuild --clean --no-install` into a temp dir to prove it still generates |
| `--full` flag or CI | Everything, Jest without filtering |

Two small checks live inside the script because they're one-liners: fail if the diff touches `ios/` or `android/`, and fail on `EXPO_PUBLIC_` names containing `SECRET`, `PRIVATE`, `PASSWORD` or `SERVICE_ROLE`. CI also runs gitleaks for real secret scanning. I'm not adding a JS secret scanner to the agent loop, because its false positives would train the agent to ignore the gate.

Output: every failure on one line as `rule-id: file:line message`, then a summary of which tiers ran and which were skipped. Exit 1 on any failure.

### CI

`.github/workflows/verify.yml`: frozen-lockfile install, `pnpm verify --full`, gitleaks, actions pinned to commit hashes (from `RULES.md`). Add pnpm's `minimumReleaseAge` to `pnpm-workspace.yaml` while I'm there, which `RULES.md` asks for and which isn't set yet.

### What step 3 shipped (2026-10-22)

- `eslint.config.js` has every lint rule from the step 2 table, plus the step 2 additions: `rn-platform/platform-select`, `rn-monetization/purchases-in-pro`, `rn-ui/no-scrollview-map` and `react/no-array-index-key`. Typed linting is on. eslint-config-expo 57 only ships the node resolver, so the config adds `import/resolver: typescript` to make `@/` paths resolve for `import/no-restricted-paths`.
- Rules whose ESLint message can't be changed (`no-floating-promises`, `no-array-index-key`, `no-console`) get their rule ID from a map in `scripts/verify.mjs`.
- `src/config.test.ts` asserts the step 2 config rules plus `rn-app-config/promotion-frame-rate`, `typed-routes` and `react-compiler`, for the production and development variants. `app.config.ts` now sets `runtimeVersion: { policy: "fingerprint" }`.
- `pnpm verify` takes about 26 s with `--full`. It also checks the `rn-native-deps/expo-module-first` deny-list, so that prose rule is gone from `.rules/`.
- `.github/workflows/verify.yml` runs on Node 24, which is the current LTS. `minimumReleaseAge: 1440` is set.
- Found while merging: the ESLint minion added an `env(name)` helper that read `(process.env as Record<string, unknown>)[name]`. Expo only inlines `EXPO_PUBLIC_` values written as `process.env.EXPO_PUBLIC_X`, so every key would have been `undefined` in a release build. eslint-config-expo's `expo/no-dynamic-env-var` misses the cast. I reverted the helper. Step 7a should plant this case and step 5's reviewer should look for it.

## Step 4. Hooks

The logic lives in `scripts/guard/*.mjs`. `.claude/settings.json` only wires them up, so Codex, Cursor or a git hook can call the same scripts.

- **PostToolUse on `Edit|Write|MultiEdit`**: `scripts/guard/on-edit.mjs` reads the file path from the hook's stdin JSON and runs ESLint on that file. Exit 2 sends the errors back into the turn. `tsc` runs here too if a warm incremental run stays under about 3 seconds on the starter. Otherwise it waits for the stop hook.
- **Stop**: `scripts/guard/on-stop.mjs` runs `pnpm verify` and exits 2 with the failures, so the agent can't end the turn. It checks `stop_hook_active` and lets the second attempt through with a warning, so a check that can't pass doesn't loop forever.
- **PreToolUse on Bash**: block `expo eject`, `git commit --no-verify`, `git push --force`, `pnpm add`/`npm install <pkg>`/`yarn add` (use `npx expo install`), and `rm`/`git rm` on `*.test.ts(x)` files, and any command that names a `.env*` file.
- **PreToolUse on `Edit|Write`**: block paths under `ios/` and `android/`, and block new `eslint-disable` or `design-ignore` comments that have no reason. Lint catches the first case too, but blocking at write time saves a round trip.
- **PreToolUse on `Read|Grep`** (`pre-read.mjs`): block `.env*` files, which hold secrets. `.env.example` stays readable. pi and opencode `read` calls go through the same script. The Bash check matches strings, so it stops accidents, not someone determined to get around it.
- `permissions.deny` in `.claude/settings.json` for `Edit(ios/**)` and `Edit(android/**)` as a second layer.
- A git pre-commit hook through `core.hooksPath` pointing at `.githooks/pre-commit`, which runs `pnpm verify`. No husky or lefthook. `pnpm prepare` sets the path.

`overload/.claude/settings.json` enables the `expo@claude-plugins-official` plugin. That moves to the root settings.

### What step 4 shipped (2026-10-22)

- `scripts/guard/` has `on-edit.mjs`, `on-stop.mjs`, `pre-bash.mjs` and `pre-edit.mjs`. `.claude/settings.json` wires all four, sets `permissions.deny` for `ios/**` and `android/**`, and keeps the Expo plugin.
- A warm incremental `tsc` takes about 1 s on the starter (2.2 s cold), so `on-edit` runs it after ESLint and reports type errors in every file, not just the edited one, because a changed signature breaks its callers. ESLint on one file takes 1.5 to 2.8 s.
- The Stop hook has a 600 s timeout, since Claude Code's default of 60 s is too short when `verify` runs prebuild.
- The hook-only blocks use `guard/*` rule IDs (`guard/no-verify`, `guard/no-force-push`, `guard/expo-install`, `guard/keep-tests`). The native-folder block reuses `rn-native-deps/no-native-edits`.
- `pre-bash` doesn't catch command substitution, `env` or `xargs` wrappers, `git -C dir`, force-push through a `+ref` refspec, or `rm -r` of a directory that holds tests. Step 7a can plant these if they turn out to matter.
- The ESLint rule-ID map and the `tsc` line regex moved to `scripts/lib/`, so `verify` and `on-edit` print failures the same way.
- `verify` has a new `guards` tier that runs `node --test` on `scripts/**/*.test.mjs` when anything under `scripts/` changes. The jest-expo preset doesn't load plain `.mjs`, which is why these tests use `node:test`.
- `.githooks/pre-commit` runs `pnpm verify`. `pnpm prepare` points `core.hooksPath` at it and does nothing outside a git repo.

### opencode and pi (2026-10-23)

- `.opencode/plugins/guard.js` (opencode 2.x plugin API) and `.pi/extensions/guard.js` wire the same four scripts. `scripts/guard/adapters.mjs` turns their tool calls into Claude Code's hook JSON and runs the scripts unchanged, so the rule IDs and messages match.
- Tool names differ: opencode has `shell`, `edit`, `write` and `patch`, and pi has `bash`, `edit` (with an `edits[]` array) and `write`. An opencode patch is split per file, and deleting a test file through a patch counts as `rm`, so `guard/keep-tests` still applies.
- Blocks: opencode throws from `tool` `execute.before`, and pi returns `{ block, reason }` from `tool_call`. Edit feedback is added to the tool result.
- Stop gate: pi continues the run from `agent_before_settle`. opencode has no stop hook, so the plugin waits for `session.execution.succeeded` and sends the failures as a new prompt. That needs a running server (the TUI or `opencode serve`). One-shot `opencode run --standalone` exits before the follow-up runs.
- pi loads project extensions only after you trust the folder (`/trust`). opencode 2.1.4 loaded `.opencode/plugins/` without asking in `opencode run` and `opencode serve`. I did not check the TUI.
- Not covered yet: Codex and Cursor. The opencode stop gate probably also fires when a subagent session finishes (not tested), and its give-up warning goes to opencode's log instead of the TUI.

## Step 5. Runtime checks and review

### Visual verification

This conflicts with what the repo says now. `AGENTS.md` and the `ui-design` skill tell agents to run `design/check.mjs` "and nothing else" and not to render pages. That rule exists to stop agents from writing their own screenshot loops. The fix is one sanctioned command, `pnpm verify:visual`, and an update to the skill and `AGENTS.md` that names it as the only allowed way to look at screens.

`scripts/verify-visual.mjs`:

1. Boots two simulators, iPhone SE (3rd generation) and the largest current Pro Max, through `xcrun simctl`.
2. Installs the dev build once. It rebuilds only if the fingerprint changed (`npx expo-updates fingerprint:generate` or `@expo/fingerprint`).
3. Runs the Maestro flows in `.maestro/`. Each flow navigates to one screen and calls `takeScreenshot`.
4. Repeats with `xcrun simctl ui <device> appearance dark`.
5. Writes `artifacts/screens/<flow>-<device>-<light|dark>.png` and prints the paths so the agent can read the images and compare them with `DESIGN.md`.

The starter ships one flow per example screen and a template flow. When a feature adds a screen, its flow comes in the same change. The reviewer checks that.

The verify tier table sends UI-only changes here when `--visual` is passed. It stays opt-in for the agent loop, because a simulator run takes minutes and the stop hook can't block on it.

### Log check

The same script tails Metro and `xcrun simctl spawn booted log stream` while the flows run. It fails on red boxes, `console.error`, and the warnings that point at real bugs: "VirtualizedLists should never be nested", "Each child in a list should have a unique key", "Cannot update a component while rendering". Any other yellow box gets listed but doesn't fail.

### Visual and log check shipped (2026-10-25)

- `scripts/verify-visual.mjs` behind `pnpm verify:visual`, and behind `pnpm verify --visual` for UI changes (a `.tsx`, `DESIGN.md` or `.maestro/` diff turns the tier on). Still opt-in; hooks and CI never run it implicitly.
- Flows in `.maestro/` per example screen (notes list, new note, note detail, settings, paywall — paywall only when `EXPO_PUBLIC_REVENUECAT_IOS_KEY` is set) plus `_template.yaml` for new screens. Each flow opens the dev build through the dev-client URL, waits for content, calls `takeScreenshot`.
- Two simulators: iPhone SE (3rd generation) and the newest Pro Max device type, created by the script if missing. Dev build built once and cached by `@expo/fingerprint` hash under `.expo/visual/`; a run reinstalls for a fresh database.
- Screenshots land in `artifacts/screens/<flow>-<device>-<light|dark>.png`; failed flows keep Maestro's artifact bundle there too. `artifacts/` is gitignored.
- Log check: Metro (`artifacts/logs/metro.log`) and one `simctl spawn log stream` per device. Fails on `ERROR` lines, on NSException/SIGABRT from the app process, and on the three warnings that point at real bugs ("VirtualizedLists should never be nested", "Each child in a list should have a unique key", "Cannot update a component while rendering"). Other `WARN` yellow boxes are listed without failing.
- Missing on this machine when written: Maestro was not installed, so the script fails fast with install instructions and nothing was end-to-end verified. Only the build/install/Metro plumbing was exercised with `--setup-only`.
- Not covered: Android (open question below).

### Reviewer agent

`.claude/agents/rn-reviewer.md`. It starts with a fresh context and gets the diff, `RULES.md` and the rule files that match the changed paths. It returns findings as `rule-id: file:line finding` and nothing else. It doesn't edit. The main agent fixes each finding or writes down why not.

paseo-rules already judges each diff against `.rules/` after every turn, so the reviewer doesn't repeat that. It covers what a per-file check can't see: rules from `RULES.md` (error boundaries, no DB wait before the first frame, strings externalised, migration tests), a new screen without a Maestro flow, a new SDK without a privacy manifest entry, a new dependency with no stated reason.

### Definition of done

In `AGENTS.md`. The agent ends every task with:

```
Verified: pnpm verify (tiers: lint, types, related tests, design)
Visual: <screens checked, or "not run: logic only">
Reviewer: <n findings, n fixed, n justified>
Not verified: <anything skipped and why>
```

## Step 6. Keeping it alive

- **Every correction becomes a check.** When I correct the agent, I ask whether a linter or test could have caught it. If yes, add the lint rule. If no, add a prose rule with an ID. `AGENTS.md` says this in one line, and so does the README for people who adopt the kit.
- Revisit the enforcement table in step 2 when ESLint or Expo ship new rules.

## Step 7. Test the guardrails

Two levels, the cheap one first.

**Planted mistakes (deterministic, runs in CI).** `evals/fixtures/` has one bad file per lint or test rule, named after the rule, such as `rn-ui__expo-image.tsx`. `evals/run.mjs` copies each into the example feature, runs `pnpm verify`, asserts that the output contains that rule ID, and restores the tree. If a lint config change silently stops a rule from firing, CI fails. This is the runnable check for steps 3 and 4.

**Agent tasks (manual, before a release of the kit).** Five prompts in `evals/tasks.md`: add a settings screen with a toggle, add a paginated list from an API, add a photo picker, add a sheet with a form, add a purchase button. Run each with `claude -p` in a fresh worktree and score: did verify pass at the end, how many check failures did the agent hit on the way, did any `eslint-disable` or deleted test slip through, did the reviewer find anything. I'd keep the scores in a table in the same file and compare between kit versions. Automating this is a later step.

## Step 8. Packaging

1. **Template repo first.** GitHub "Use this template" and `npx create-expo-app --template <repo-url>` both work once the app is at the root. A README section lists what to fill in after cloning: the identifier block in `app.config.ts`, `eas init`, the optional service keys.
2. **Plugin later.** Once the rule files, hooks and reviewer agent stop changing every week, pack them as a Claude Code plugin so existing Expo apps can adopt the guardrails without the template. The rule files stay plain markdown so any agent can read them.

I'd skip an init script that renames identifiers. The identifier block is about six values and a README checklist covers it. Add the script if people forget them.

## Order and size

| Step | Depends on | Size |
|---|---|---|
| 1. Strip the app | decisions above | 1 day |
| 2. Rules layer | 1 | half a day |
| 3. Deterministic checks | 2 | 1 day |
| 4. Hooks | 3 | half a day |
| 7a. Planted-mistake evals | 3 | half a day, do it right after step 3 |
| 5. Visual, logs, reviewer | 1 | 1 to 2 days, mostly Maestro and simulator plumbing |
| 6. Keeping it alive | 2 | an hour |
| 7b. Agent-task evals | 4, 5 | half a day for the first run |
| 8. Packaging | all | half a day |

Steps 1 to 4 plus 7a give a usable kit. Step 5 is the most work and the part agents need most, because static checks can't see a broken screen.

## Open questions

- [x] RevenueCat: kept `features/pro` without the free-workout gate. Settings opens the paywall when `EXPO_PUBLIC_REVENUECAT_IOS_KEY` is set. Original question: keep `features/pro` as an optional entitlement module, or remove it and keep only the `rn-monetization` ruleset? I lean towards keeping it, because getting the entitlement hook right is the part people get wrong. But it's the biggest optional dependency.
- [x] Drizzle and SQLite stay. The notes example uses one table, and the migration test pattern ships. Original question: Drizzle and SQLite in the starter, or MMKV only with the database as an opt-in recipe? The example feature is simpler without a database. Many apps need one, though, and the migration test pattern is worth shipping.
- [ ] Git history: this repo has 34 commits of Overload. Template copies start fresh, but if the repo goes public the history shows the app. Squash to a single initial commit before publishing?
- [ ] Android in the visual check: the plan above is iOS only. Adding an emulator doubles the run time.
- [ ] Should the stop hook run `verify:visual` when `.tsx` files changed, instead of leaving it to the agent? That's more reliable and slower. I'd try it on the starter and measure.
