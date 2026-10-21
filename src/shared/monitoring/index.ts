import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { z } from 'zod';
import { create } from 'zustand';
import { storage } from '../storage';

const REPORTS_KEY = 'monitoring.reports';
let started = false;
let closing: Promise<void> | null = null;

const useReportsStore = create<{ on: boolean }>()(() => ({ on: storage.getJSON(REPORTS_KEY, z.boolean()) ?? true }));

/** False once the user turned crash reports off in Settings. Defaults to true. */
export const reportsEnabled = (): boolean => useReportsStore.getState().on;
/** The same value for components, which re-render when it changes. */
export const useReportsEnabled = (): boolean => useReportsStore((s) => s.on);

/** Drizzle includes bound values in its messages, including text the user typed. */
function scrubMessage(message: string): string {
  return /Failed query:|\bparams:/i.test(message) ? 'Database query failed' : message;
}

/** Removes user identity and query values while keeping stack traces. */
export function scrubEvent<T extends Sentry.Event>(event: T): T {
  delete event.user;
  delete event.server_name;
  if (event.message) event.message = scrubMessage(event.message);
  if (event.logentry?.message) event.logentry.message = scrubMessage(event.logentry.message);
  if (event.logentry) delete event.logentry.params;
  for (const exception of event.exception?.values ?? []) {
    if (exception.type === 'DrizzleQueryError') exception.value = 'Database query failed';
    else if (exception.value) exception.value = scrubMessage(exception.value);
  }
  for (const breadcrumb of event.breadcrumbs ?? []) {
    if (breadcrumb.message) breadcrumb.message = scrubMessage(breadcrumb.message);
  }
  return event;
}

/** Drops console breadcrumbs, which could one day print something a user typed. Used as Sentry's beforeBreadcrumb. */
export function scrubBreadcrumb<T extends { category?: string }>(breadcrumb: T): T | null {
  if (breadcrumb.category === 'console') return null;
  return breadcrumb;
}

/** Build variant from the Expo config, so events know which build they came from. */
function variant(): string {
  const value = Constants.expoConfig?.extra?.variant;
  return typeof value === 'string' ? value : 'production';
}

/** Starts Sentry. Does nothing useful without a DSN or when the user turned reports off. Safe to call again. */
export function startMonitoring(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (started || closing || !dsn || !reportsEnabled()) return;
  Sentry.init({
    dsn,
    enabled: Boolean(dsn) && reportsEnabled(),
    environment: variant(),
    sendDefaultPii: false,
    // Sessions carry the installation id, so they stay off.
    enableAutoSessionTracking: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableCaptureFailedRequests: false,
    beforeSend: (event) => started && reportsEnabled() ? scrubEvent(event) : null,
    beforeBreadcrumb: scrubBreadcrumb,
  });
  started = true;
  Sentry.setTag('channel', variant());
}

/** Sends a handled error. `where` is a short fixed label such as 'db.start'. Never pass user records. */
export function reportError(error: unknown, where: string): void {
  if (!started || !reportsEnabled()) return;
  Sentry.captureException(error, { tags: { where } });
}

/** Stores the user's choice and applies it right away. */
export function setReportsEnabled(on: boolean): Promise<void> {
  storage.set(REPORTS_KEY, on);
  useReportsStore.setState({ on });
  if (on) startMonitoring();
  else if (started) {
    // Block new reports immediately, then wait for both SDKs to close before restarting.
    started = false;
    closing = Sentry.close().finally(() => {
      closing = null;
      if (reportsEnabled()) startMonitoring();
    });
  }
  return closing ?? Promise.resolve();
}

/**
 * Adds Sentry's touch tracking when startMonitoring has run, and returns the component unchanged otherwise (no DSN,
 * or reports off), because Sentry warns on every launch when wrap runs before init. Route render errors are reported
 * by our ErrorBoundary.
 */
export const wrapRoot: typeof Sentry.wrap = (component) => (started ? Sentry.wrap(component) : component);
