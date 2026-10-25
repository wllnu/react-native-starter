# React Native starter

An Expo SDK 57 app with Expo Router, SQLite through Drizzle, MMKV for small settings, and optional Sentry, Aptabase and RevenueCat. It ships one example feature, notes, in `src/features/notes`. Copy its layout when you add a feature: a public `index.ts`, data hooks over live queries, a Zustand store for client state only, and tests next to the code.

## Run it

The app needs a development build, because MMKV and the keyboard controller don't run in Expo Go.

```bash
pnpm install
pnpm ios        # or pnpm android
```

These set `APP_VARIANT=development`, so the build installs as `<bundleId>.dev` next to the preview and production builds.

Check a change with `pnpm verify`. It picks lint, types, tests and the design, dependency and config checks from your diff. `pnpm verify --full` runs everything, as CI does. Add packages with `npx expo install <package>`, which picks versions that match the SDK.

## After cloning

1. Fill in the `app` block at the top of `app.config.ts`: name, slug, scheme and bundle id prefix.
2. Run `npx eas-cli@latest init` and put the project id it prints into `easProjectId`.
3. Change `name` in `package.json` and the copyright line in `LICENSE`.
4. Replace the placeholder icons in `assets/images` and rewrite `DESIGN.md` for your product, then run `node design/check.mjs build`.

## Optional services

Each service stays off until its key is set. A fresh clone runs with no accounts. Set the keys as EAS environment variables, or in `.env.local` for local builds.

| Service | Variables |
|---|---|
| Sentry crash reports | `EXPO_PUBLIC_SENTRY_DSN`. For source map upload on EAS also `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN`. |
| Aptabase usage events | `EXPO_PUBLIC_APTABASE_KEY` |
| RevenueCat subscriptions (iOS) | `EXPO_PUBLIC_REVENUECAT_IOS_KEY`. Without it the paywall and the Pro row in Settings are hidden. |

Users can turn Sentry and Aptabase off together with the switch in Settings.

## Keeping the guardrails

Every correction becomes a check. When you correct the agent, ask whether a linter or test could have caught the mistake. If one could, add a lint rule to `eslint.config.js` whose message starts with a rule ID, or an assertion to `src/config.test.ts`. If not, add a rule with an ID to the matching file in `.rules/`. `AGENTS.md` tells the agent to offer this whenever you correct it.

When you upgrade Expo or `eslint-config-expo`, look for new lint rules that cover a rule in `.rules/`. Move each one you find to `eslint.config.js` and delete the prose, so the same rule isn't judged twice.

## Database changes

Edit `src/shared/db/schema.ts`, run `pnpm db:generate`, and extend `src/shared/db/migrations.test.ts`. When a release ships, save its schema as a new fixture so the next migration is tested against real data from that release.
