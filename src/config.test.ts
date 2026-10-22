import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExpoConfig } from "expo/config";

import productionConfig from "../app.config.ts";

// `expect(value, message)` is not available in Jest, so every assertion is a plain error whose
// message starts with the rule ID it enforces. One `it` per rule ID.
function check(ok: boolean, message: string): void {
  if (!ok) throw new Error(message);
}

function deepEquals(actual: unknown, expected: unknown): boolean {
  try {
    expect(actual).toEqual(expected);
    return true;
  } catch {
    return false;
  }
}

// Re-imports app.config.ts with APP_VARIANT set, then restores the env var. The static import above
// runs at module load, where APP_VARIANT unset means production.
function loadConfigWith(variant: string): ExpoConfig {
  const restored = process.env.APP_VARIANT;
  process.env.APP_VARIANT = variant;
  try {
    let config: ExpoConfig | undefined;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh CJS require is needed so app.config.ts re-evaluates with the new APP_VARIANT
      config = (require("../app.config.ts") as { default: ExpoConfig }).default;
    });
    if (!config) throw new Error("app.config.ts did not resolve to a config object");
    return config;
  } finally {
    if (restored === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = restored;
  }
}

const developmentConfig = loadConfigWith("development");

// infoPlist is `{ [k: string]: any }` in ExpoConfig, so the ATS shape is narrowed here instead of
// trusting an untyped read.
type TransportSecurity = {
  NSAllowsArbitraryLoads?: boolean;
  NSAllowsArbitraryLoadsInWebContent?: boolean;
  NSExceptionDomains?: Record<
    string,
    { NSExceptionAllowsInsecureHTTPLoads?: boolean } | undefined
  >;
};

function atsIsOn(config: ExpoConfig): boolean {
  const ats = config.ios?.infoPlist?.NSAppTransportSecurity as TransportSecurity | undefined;
  if (ats === undefined) return true;
  if (ats.NSAllowsArbitraryLoads === true || ats.NSAllowsArbitraryLoadsInWebContent === true) {
    return false;
  }
  return !Object.values(ats.NSExceptionDomains ?? {}).some(
    (domain) => domain?.NSExceptionAllowsInsecureHTTPLoads === true,
  );
}

// tsconfig.json is plain JSON: no comments, no trailing commas.
type Tsconfig = {
  compilerOptions?: Partial<
    Record<"strict" | "noUncheckedIndexedAccess" | "exactOptionalPropertyTypes", boolean>
  >;
};

function readTsconfig(): Tsconfig {
  return JSON.parse(readFileSync(join(__dirname, "../tsconfig.json"), "utf8")) as Tsconfig;
}

describe("config", () => {
  // Every variant ships the same native config guarantees, so each rule is checked on both.
  const configs = [productionConfig, developmentConfig];

  it("rn-app-config/keep-ats-on", () => {
    for (const config of configs) {
      check(
        atsIsOn(config),
        "rn-app-config/keep-ats-on: App Transport Security must stay on. Remove the HTTP exception from ios.infoPlist.NSAppTransportSecurity.",
      );
    }
  });

  it("rn-app-config/fingerprint-runtime-version", () => {
    for (const config of configs) {
      check(
        deepEquals(config.runtimeVersion, { policy: "fingerprint" }),
        "rn-app-config/fingerprint-runtime-version: set runtimeVersion to { policy: 'fingerprint' } so an OTA update never reaches a binary with different native code.",
      );
    }
  });

  it("rn-app-config/promotion-frame-rate", () => {
    for (const config of configs) {
      check(
        config.ios?.infoPlist?.CADisableMinimumFrameDurationOnPhone === true,
        "rn-app-config/promotion-frame-rate: keep CADisableMinimumFrameDurationOnPhone true so ProMotion iPhones run at 120 Hz.",
      );
    }
  });

  it("rn-app-config/typed-routes", () => {
    for (const config of configs) {
      check(
        config.experiments?.typedRoutes === true,
        "rn-app-config/typed-routes: Expo Router typed routes must stay on so Link and router.push are checked against real routes.",
      );
    }
  });

  it("rn-app-config/react-compiler", () => {
    for (const config of configs) {
      check(
        config.experiments?.reactCompiler === true,
        "rn-app-config/react-compiler: React Compiler must stay on; the lint rule rn-ui/no-manual-memo depends on it.",
      );
    }
  });

  it("rn-tsconfig/strict-flags", () => {
    const { compilerOptions } = readTsconfig();
    const flags = ["strict", "noUncheckedIndexedAccess", "exactOptionalPropertyTypes"] as const;
    for (const flag of flags) {
      check(
        compilerOptions?.[flag] === true,
        `rn-tsconfig/strict-flags: compilerOptions.${flag} must be true.`,
      );
    }
  });
});