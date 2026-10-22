---
id: rn-store-compliance
title: App Store compliance
paths: app.config.ts, app.json
when: The change edits permission plugins, permission usage strings or the iOS privacy manifest in the app config.
---

## rn-store-compliance/permission-usage-strings
Severity: error
Rule: Give every permission-requesting config plugin its permission message option or the matching `NS...UsageDescription` in `ios.infoPlist`.
Violated when: the config adds a plugin that requests a permission such as `expo-camera`, `expo-location`, `expo-image-picker`, `expo-contacts` or `expo-media-library` with no permission message option (for example `cameraPermission` or `locationWhenInUsePermission`) and no matching `NS...UsageDescription` key (for example `NSCameraUsageDescription` or `NSLocationWhenInUseUsageDescription`) in `ios.infoPlist`.
Followed when: every permission plugin added in the changed lines sets its permission message option, or `ios.infoPlist` in the changed lines supplies the matching `NS...UsageDescription` key.

Good:
```ts
plugins: [
  [
    "expo-camera",
    { cameraPermission: "The camera is used to scan product barcodes." },
  ],
],
```

Bad:
```ts
plugins: ["expo-camera"],
```

## rn-store-compliance/specific-usage-strings
Severity: warning
Rule: Make permission usage strings say what the app uses the permission for.
Violated when: a permission message option or `NS...UsageDescription` value is a generic sentence such as "This app needs camera access" or only repeats the permission name.
Followed when: usage strings in the changed lines name the feature the app uses the permission for, such as scanning barcodes or finding nearby pick-up points.

Good:
```ts
plugins: [
  [
    "expo-location",
    {
      locationWhenInUsePermission:
        "Your location is used to find nearby pick-up points.",
    },
  ],
],
```

Bad:
```ts
plugins: [
  [
    "expo-location",
    { locationWhenInUsePermission: "This app needs location access." },
  ],
],
```

## rn-store-compliance/privacy-manifest-reasons
Severity: error
Rule: Give every entry in `ios.privacyManifests.NSPrivacyAccessedAPITypes` its required-reason codes.
Violated when: an `NSPrivacyAccessedAPIType` entry in the changed lines has no `NSPrivacyAccessedAPITypeReasons` key or an empty `NSPrivacyAccessedAPITypeReasons: []`.
Followed when: every `NSPrivacyAccessedAPIType` entry in the changed lines lists at least one reason code.

Good:
```ts
NSPrivacyAccessedAPITypes: [
  {
    NSPrivacyAccessedAPIType:
      "NSPrivacyAccessedAPICategorySystemBootTime",
    NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
  },
],
```

Bad:
```ts
NSPrivacyAccessedAPITypes: [
  {
    NSPrivacyAccessedAPIType:
      "NSPrivacyAccessedAPICategorySystemBootTime",
  },
],
```