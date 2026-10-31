---
name: starter-check
description: Checks whether a React Native project has the agent setup from the wllnu/react-native-starter repository on GitHub, which is the source of truth. Clones the starter, compares the guard hooks, the pnpm verify gate, rules, skills, AGENTS.md and the package.json and git hook wiring, and reports what is missing or out of date. Use when the user asks whether a project is set up like the starter, wants to check, audit or align its guardrails or agent setup, or asks what is missing compared to the starter.
---

# Starter check

Report only. Change nothing until the user picks what to fix.

## 1. Run the check

From the app folder (in a monorepo, `apps/<name>`, not the root):

```bash
tmp=$(mktemp -d) && git clone --depth 1 --quiet https://github.com/wllnu/react-native-starter.git "$tmp/starter" && echo "starter: $tmp/starter" && node "$tmp/starter/.agents/skills/starter-check/check.mjs" "$tmp/starter" .
```

The script runs from the fresh clone, so what counts as "the setup" is always what's on GitHub's `main`, not whatever copy of this skill the app has. If the clone fails, tell the user and stop. Don't fall back to what you remember of the starter. Use a local starter path only if the user gives one.

Each line is `rule-id: path message`. Exit code 1 means something needs fixing.

| Rule ID | Meaning |
|---|---|
| `starter-check/missing` | A starter file the app doesn't have |
| `starter-check/outdated` | A copy-as-is file that no longer matches the starter |
| `starter-check/script`, `/dependency` | `package.json` lacks a script or a tool that verify runs |
| `starter-check/hook` | `.claude/settings.json` lacks a guard hook or deny rule |
| `starter-check/git-hook` | `core.hooksPath` isn't `.githooks`, so pre-commit never runs |
| `starter-check/package-manager`, `/native-folders`, `/no-git` | The app breaks an assumption the guardrails make: pnpm, generated `ios/` and `android/`, git |
| `starter-check/review` | The app has its own version of the file. Judge it in step 2 |

## 2. Judge the review lines

Each `review` line names a file the app should have its own version of. Diff it against the starter's copy in the clone and flag only real gaps:

- `AGENTS.md` keeps the starter's sections (stack, Expo docs warning, commands, rules table, definition of done) and describes this app's stack, not the starter's.
- `.rules/rn-architecture.md` names the state, storage and validation libraries in this app's `package.json`.
- `eslint.config.js` builds its import zones from folders that exist in this app, and every custom message starts with a rule ID.
- `src/config.test.ts` and the other `.rules/` files: list starter rules the app dropped. Changes that fit the app are fine.
- `package.json` scripts that differ: fine if they still run the same gate.

## 3. Report

Group the findings under "To fix" (each with its fix), "To review" (your judgment from step 2), and "Fine". End with the starter commit the script printed. Then offer to fix, in this order, because the Stop hook blocks every turn while `pnpm verify` fails:

1. Copy the `missing` and `outdated` copy-as-is files from the clone verbatim. Never edit them in the app. Change the starter and run this check again.
2. Add the scripts and dependencies, write the app's own files, then run `pnpm verify --full` (several minutes, runs expo-doctor and prebuild) and fix what it reports.
3. Wire the hooks into `.claude/settings.json` last, once verify passes.

Delete the clone when done: `rm -rf "$tmp"` with the path the command printed.
