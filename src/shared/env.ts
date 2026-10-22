import { z } from "zod";

// process.env is `any` in React Native (the app ships no @types/node), so a direct read passes `any`
// into app code. Every read goes through here: one place, validated by Zod, and the value stays
// `string | undefined` on the other side. Keys this app reads, build-time ones included.
type EnvKey =
  | "APP_VARIANT"
  | "SENTRY_ORG"
  | "SENTRY_PROJECT"
  | "EXPO_PUBLIC_APTABASE_KEY"
  | "EXPO_PUBLIC_SENTRY_DSN"
  | "EXPO_PUBLIC_REVENUECAT_IOS_KEY";

const envValue = z.string().optional().catch(undefined);

/** Reads one environment value live, so tests that swap process.env see the change. */
export function env(name: EnvKey): string | undefined {
  return envValue.parse((process.env as Record<string, unknown>)[name]);
}