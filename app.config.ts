import type { ExpoConfig } from "expo/config";

import { darkColors } from "./design/tokens.ts";

// Everything that names this app or an account. Change these after cloning, then run `eas init` for a projectId.
const app = {
  name: "Starter",
  slug: "starter",
  scheme: "starter",
  // Reverse-DNS prefix you own. The build variant adds .dev or .preview.
  bundleId: "com.example.starter",
  // Set by `eas init`. Leave undefined until then.
  easProjectId: undefined,
};

// eas.json sets APP_VARIANT per build profile. Unset means production.
const suffixes = {
  development: ".dev",
  preview: ".preview",
  production: "",
} as const;
const isVariant = (value: string): value is keyof typeof suffixes => Object.hasOwn(suffixes, value);
const variant = process.env.APP_VARIANT ?? "production";
if (!isVariant(variant)) {
  throw new Error(
    `APP_VARIANT must be development, preview or production, got "${variant}"`,
  );
}
const suffix = suffixes[variant];
const id = `${app.bundleId}${suffix}`;

const config: ExpoConfig = {
  name: variant === "production" ? app.name : `${app.name} (${variant})`,
  slug: app.slug,
  version: "1.0.0",
  // OTA updates only target builds with identical native code. The fingerprint policy hashes the native
  // dependency graph, so an update can never land on a binary it does not match.
  runtimeVersion: { policy: "fingerprint" },
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: app.scheme,
  userInterfaceStyle: "automatic",
  platforms: ["ios", "android"],
  ios: {
    icon: "./assets/images/icon.png",
    bundleIdentifier: id,
    infoPlist: {
      CADisableMinimumFrameDurationOnPhone: true,
      ITSAppUsesNonExemptEncryption: false,
    },
    // The required-reason APIs our packages declare in their own PrivacyInfo.xcprivacy files (React Native, @sentry/react-native,
    // expo-file-system, expo-constants, expo-system-ui, expo-device, RevenueCat). Update the list when a package is added.
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
          NSPrivacyAccessedAPITypeReasons: ["C617.1", "0A2A.1", "3B52.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
          NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace",
          NSPrivacyAccessedAPITypeReasons: ["E174.1", "85F4.1"],
        },
        {
          NSPrivacyAccessedAPIType:
            "NSPrivacyAccessedAPICategorySystemBootTime",
          NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
        },
      ],
      // Crash reports sent to Sentry and usage events sent to Aptabase: no user id, not used for tracking.
      NSPrivacyCollectedDataTypes: [
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeCrashData",
          NSPrivacyCollectedDataTypeLinked: false,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeProductInteraction",
          NSPrivacyCollectedDataTypeLinked: false,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAnalytics"],
        },
      ],
    },
  },
  android: {
    package: id,
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      monochromeImage: "./assets/images/monochrome-icon.png",
      backgroundColor: darkColors.canvas,
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: darkColors.canvas,
      },
    ],
    "expo-sqlite",
    // Uploads source maps at build time. SENTRY_ORG, SENTRY_PROJECT and SENTRY_AUTH_TOKEN come from the EAS environment,
    // never from the repo. Without SENTRY_ORG the upload step is left out, so a build without a Sentry account still passes.
    ...(process.env.SENTRY_ORG
      ? [
          [
            "@sentry/react-native/expo",
            { url: "https://sentry.io/", organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT },
          ] satisfies [string, object],
        ]
      : []),
  ],
  extra: { variant, ...(app.easProjectId ? { eas: { projectId: app.easProjectId } } : {}) },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
