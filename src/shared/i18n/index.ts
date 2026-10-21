import { en } from './en';

export type Key = keyof typeof en;

// lazy: one language and a plain lookup. When a second language arrives, add expo-localization plus i18next,
// and Intl.PluralRules for counts.
export function t(key: Key, params?: Record<string, string | number>): string {
  return en[key].replace(/\{(\w+)\}/g, (hole, name: string) => String(params?.[name] ?? hole));
}
