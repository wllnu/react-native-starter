---
id: rn-app-config
title: Expo app config
paths: app.config.ts, app.config.js, app.json
when: The change edits the Expo app config, including Info.plist values and update settings.
---

## rn-app-config/keep-ats-on
Severity: error
Rule: Leave iOS App Transport Security on.
Violated when: the config sets `NSAllowsArbitraryLoads` or `NSExceptionAllowsInsecureHTTPLoads` to `true`.
Followed when: the changed lines add no `NSAppTransportSecurity` exception that allows HTTP.

Good:
```ts
ios: {
  bundleIdentifier: "com.example.app",
  infoPlist: { CADisableMinimumFrameDurationOnPhone: true },
},
```

Bad:
```ts
ios: {
  bundleIdentifier: "com.example.app",
  infoPlist: { NSAppTransportSecurity: { NSAllowsArbitraryLoads: true } },
},
```

## rn-app-config/fingerprint-runtime-version
Severity: warning
Rule: Set `runtimeVersion` with the `fingerprint` policy.
Violated when: `runtimeVersion` is a string literal or an object whose `policy` is not `"fingerprint"`.
Followed when: `runtimeVersion` in the changed lines is `{ policy: "fingerprint" }`.

Good:
```ts
runtimeVersion: { policy: "fingerprint" },
```

Bad:
```ts
runtimeVersion: "1.0.0",
```
