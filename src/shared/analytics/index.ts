// The SDK also exports init/trackEvent/dispose as named exports; we deliberately use its documented default export.
/* eslint-disable import/no-named-as-default-member -- Aptabase documents the default export; named aliases exist only for compat */
import Aptabase from '@aptabase/react-native';
import { env } from '../env';
import { reportsEnabled } from '../monitoring';

/** Every event the app sends. Properties are numbers or fixed labels, never text a user typed. */
export type Events = {
  app_opened: undefined;
  note_created: { hasBody: 'yes' | 'no' };
};

let started = false;

/** Starts Aptabase with the key from EXPO_PUBLIC_APTABASE_KEY. Does nothing when started, without a key, or when the user turned reports off. Safe to call again. */
export function startAnalytics(): void {
  const key = env('EXPO_PUBLIC_APTABASE_KEY');
  if (started || !key || !reportsEnabled()) return;
  // No options object: crash reporting stays off, Sentry owns crashes.
  Aptabase.init(key);
  started = true;
}

/** Tracks one event with its typed properties. Skipped while analytics is off or the user turned reports off. */
export function track<K extends keyof Events>(
  name: K,
  ...props: Events[K] extends undefined ? [] : [Events[K]]
): void {
  if (!started || !reportsEnabled()) return;
  // Callers sit between a save and its cleanup. A failed event must never break them.
  try {
    Aptabase.trackEvent(name, props[0]);
  } catch {}
}

/** Applies the shared reports switch to analytics right away. The stored on/off value belongs to monitoring's setReportsEnabled; both tools share it. */
export function setAnalyticsEnabled(on: boolean): void {
  if (on) startAnalytics();
  else if (started) {
    Aptabase.dispose();
    started = false;
  }
}
