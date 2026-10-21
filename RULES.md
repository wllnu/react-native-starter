# General rules

These rules apply to the whole app. No single file's diff can prove them, so `.rules/` does not check them. Follow them anyway, and say in your summary when a change touches one.

## Project setup

- The `ios` folder is build output. Keep it out of git and regenerate it with `npx expo prebuild`. Native configuration goes in `app.config.ts` and config plugins.
- `eas.json` defines three profiles: development, preview and production. Each has its own bundle identifier suffix so all three install side by side.
- Set `CADisableMinimumFrameDurationOnPhone` in Info.plist so ProMotion iPhones run at 120 Hz.
- Enable code signing for over-the-air updates.

## Dependencies and CI

- Commit the lockfile. CI installs with a frozen lockfile.
- Set a minimum release age for new package versions.
- Pin CI actions to commit hashes.
- CI runs `npx expo-doctor`.

## App behaviour

- Every screen sits inside an error boundary.
- The first frame never waits for a database open or a migration. Show UI from cached state, then hydrate.
- Launch never waits for a feature-flag fetch. Evaluate flags from a cached value at startup.
- List rows make no network calls of their own.
- Every user-facing string is externalised, starting with the first screen.

## Security and privacy

- The server authorises every request. A client-side feature flag never decides what a user is allowed to do.
- The privacy manifest (`PrivacyInfo.xcprivacy`) covers our code and every SDK, including required-reason API declarations. Update it when you add an SDK.
- If the app offers account creation, it offers in-app account deletion.

## Observability and tests

- Every analytics event and crash report carries the app version, build number, update ID and channel.
- Database migrations are tested against a fixture of the previous release's schema.
