---
id: rn-native-deps
title: Native configuration and dependencies
paths: app.config.ts, package.json, plugins/**
when: The change adds or removes dependencies in `package.json`, or adds or edits native configuration such as a config plugin or Info.plist values.
---

## rn-native-deps/typed-config-mods
Severity: warning
Rule: Change native files from a config plugin through typed mods such as `withInfoPlist`, `withEntitlementsPlist` or `withAndroidManifest`, not through `withDangerousMod`.
Violated when: a mod inside `withDangerousMod(` reads a native file such as `Info.plist`, `AndroidManifest.xml` or a gradle file and patches it with a `replace(` string or regex.
Followed when: native value changes in the changed lines go through typed mods and write `modResults`, and no regex or string patching of a native file appears.

Good:
```ts
const withVoiceNotes = (config) =>
  withInfoPlist(config, (modConfig) => {
    modConfig.modResults.UIBackgroundModes = ["audio"];
    return modConfig;
  });
```

Bad:
```ts
const withVoiceNotes = (config) =>
  withDangerousMod(config, ["ios", async (modConfig) => {
    const path = `${modConfig.modRequest.platformProjectRoot}/Info.plist`;
    let plist = await fs.readFile(path, "utf8");
    plist = plist.replace("</dict>", "<key>UIBackgroundModes</key><array><string>audio</string></array></dict>");
    await fs.writeFile(path, plist);
    return modConfig;
  }]);
```

## rn-native-deps/no-script-native-patching
Severity: error
Rule: Never let `package.json` lifecycle scripts such as `postinstall` or `prepare` edit files under `ios/` or `android/`.
Violated when: a `postinstall`, `prepare` or similar script in the changed lines calls `sed`, `cp` or `patch`, or rewrites a native path such as `android/build.gradle` or `ios/*/Info.plist`.
Followed when: scripts in the changed lines touch only files outside `ios/` and `android/`, and native configuration lives in `app.config.ts` and config plugins.

Good:
```json
"scripts": {
  "postinstall": "node scripts/verify-env.mjs"
}
```

Bad:
```json
"scripts": {
  "postinstall": "sed -i '' 's/minSdkVersion 24/minSdkVersion 26/' android/build.gradle"
}
```
