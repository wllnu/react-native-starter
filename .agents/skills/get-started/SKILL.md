---
name: get-started
description: Turns a fresh clone of this React Native starter into the first commit of a real app. Asks for the app's name and purpose, renames every identifier, removes the starter's docs and example code, and replaces the notes example with the app's first feature. Use when the user says get started, set up a new app, rename the app, remove the boilerplate, or starts building a product from this starter.
---

# Get started

Work through the steps in order. Each one leaves `pnpm verify` passing, so stop after any step if the user wants to.

## 1. Ask

Ask everything in one round:

- **App name** as shown on the home screen, e.g. "Pace Log".
- **Bundle id prefix**, a reverse-DNS domain the user owns, e.g. `com.acme`. Don't invent one; it is permanent once the app ships.
- **One sentence on what the app does.**
- **The first feature** to build, or "not yet".
- **Subscriptions?** If not, the RevenueCat paywall goes.
- **Inside a pnpm monorepo?** If not, the monorepo script goes.

From the name, derive `slug` (kebab case, `pace-log`), `scheme` (same as slug) and `bundleId` (`<prefix>.<slug without dashes>`, since Android rejects dashes). Take the copyright holder from `git config user.name`.

## 2. Identity

- `app.config.ts`: the `app` block at the top. Leave `easProjectId` alone.
- `package.json`: `name` = slug.
- `.maestro/*.yaml`: `appId: <bundleId>.dev` and `exp+<slug>://` in every `openLink`. The dev client registers `exp+<slug>`, so a stale scheme fails every flow.
- `LICENSE`: year and holder.
- `DESIGN.md` front matter: `name` and `description`. Then run `node design/check.mjs build`.
- `AGENTS.md`: replace "Expo starter app for iOS and Android." with the one-sentence description.

## 3. Starter docs

- Delete `plans/starter-kit.md` and `.github/assets/`.
- Rewrite `README.md` for the app: what it does, "Run it", "Optional services" and "Database changes". Drop the hero, the badges and everything about the starter.

## 4. Optional parts

**No subscriptions.** Delete `src/features/pro/`, `src/app/paywall.tsx` and `.maestro/paywall.yaml`. Remove `configurePurchases` and the `paywall` screen from `src/app/_layout.tsx`, the Pro card from `SettingsScreen.tsx`, the paywall and Pro strings from `src/shared/i18n/en.ts`, RevenueCat from the privacy manifest comment in `app.config.ts` and from the README. Run `pnpm remove react-native-purchases`. `git grep -i -e features/pro -e revenuecat -e paywall` should come back empty apart from `.rules/rn-monetization.md`, which stays for later.

**No monorepo.** Delete `scripts/to-monorepo.mjs`, `scripts/to-monorepo.test.mjs`, the `monorepo` script in `package.json` and the `pnpm monorepo` line in `AGENTS.md`. Keep `scripts/monorepo.test.mjs`; it tests the verify gate.

## 5. Replace the notes example

If the first feature is "not yet", skip this step and tell the user why: agents copy whatever feature they find, so notes stays as the pattern until a real one exists.

1. Build the first feature in `src/features/<name>/` with the same layout as `src/features/notes/`: `index.ts`, `data.ts` over live queries, `store.ts` for client state only, Zod in `lib/`, tests next to the code. Load the `ui-design` skill for its screens.
2. Point `src/app/(tabs)/index.tsx` and the first tab in `(tabs)/_layout.tsx` at it.
3. Delete `src/features/notes/`, `src/app/new-note.tsx`, `src/app/note/`, their `Stack.Screen` entries in `src/app/_layout.tsx` and the `notes.*`, `note.*` and `newNote.*` strings.
4. Database. Nothing has shipped, so start the history over. Replace the `notes` table in `src/shared/db/schema.ts`, delete the folder in `drizzle/` that holds the old migration, run `pnpm db:generate`, then `node .agents/skills/get-started/fixture.mjs`. Rewrite the table and row assertions in `src/shared/db/migrations.test.ts` for the new table.
5. Swap `notes-list.yaml`, `new-note.yaml` and `note-detail.yaml` for one flow per new screen, copied from `.maestro/_template.yaml`. Fix the comments that quote "Your notes show up here." in `scripts/lib/visual-flows.mjs`, `scripts/verify-visual.mjs` and `scripts/visual-flow-isolation.test.mjs`.
6. In `AGENTS.md` and `README.md`, name the new feature as the reference feature.

Leave the note examples in `.rules/` and in the shared UI tests. They are examples, not app code.

## 6. Deleted tests

The guard blocks `rm` of `*.test.ts(x)` on purpose. List the test files left behind by deleted code and ask the user to run one command for them (in Claude Code, `! rm <files>`). Don't route around the guard with `rm -r` on a folder or a script.

## 7. Check

```bash
pnpm verify --full
git grep -n -i -e starter -e com.example -- ':!pnpm-lock.yaml'
git grep -n -i -e features/notes -e 'your notes' -e newNote   # only if step 5 ran
```

Every grep hit left over needs a reason, like the `.rules/` examples. Once step 5 has run, delete this skill: `.agents/skills/get-started/` and the `.claude/skills/get-started` symlink. Before that, keep it for step 5. Don't commit; the user reviews the diff first.

## 8. Hand over

Tell the user what only they can do:

- Replace the placeholder images in `assets/images/`.
- Run `npx eas-cli@latest init` and paste the project id into `easProjectId`.
- Set the optional service keys listed in the README as EAS environment variables.
- Run `pnpm ios` again. The bundle id and scheme changed, so the old development build won't open the app.
- Rewrite `DESIGN.md` for the product with the `ui-design` skill when the brand exists.
