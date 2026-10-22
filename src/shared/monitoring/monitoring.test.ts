import * as Sentry from '@sentry/react-native';
import { DrizzleQueryError } from 'drizzle-orm';
import {
  reportError,
  reportsEnabled,
  scrubBreadcrumb,
  scrubEvent,
  setReportsEnabled,
  startMonitoring,
} from './index';


jest.mock('react-native-mmkv', () => jest.requireActual<typeof import('@/shared/storage/test-support')>('@/shared/storage/test-support').mmkvMock);

describe('monitoring', () => {
  const originalDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  beforeEach(async () => {
    await setReportsEnabled(false);
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://public@example.com/1';
    await setReportsEnabled(true);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await setReportsEnabled(false);
    if (originalDsn === undefined) delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    else process.env.EXPO_PUBLIC_SENTRY_DSN = originalDsn;
  });

  it('scrubEvent removes user and server_name and keeps other fields', () => {
    const event = { message: 'boom', user: { id: 'abc' }, server_name: 'phone' };
    expect(scrubEvent(event)).toEqual({ message: 'boom' });
  });

  it('scrubBreadcrumb drops console crumbs and keeps the rest', () => {
    expect(scrubBreadcrumb({ category: 'console' })).toBeNull();
    const crumb = { category: 'navigation' };
    expect(scrubBreadcrumb(crumb)).toBe(crumb);
  });

  it('removes Drizzle parameters from messages, linked errors and breadcrumbs but keeps stacks', () => {
    const error = new DrizzleQueryError('insert into notes values (?, ?, ?)', ['Private note', 'Secret body', 12], new Error('database full'));
    const frames = [{ filename: 'data.ts', function: 'addNote', lineno: 52 }];
    const event: Sentry.Event = {
      message: error.message,
      logentry: { message: error.message, params: ['Private note'] },
      exception: { values: [
        { type: error.name, value: error.message, stacktrace: { frames } },
        { type: 'Error', value: `Wrapped: ${error.message}` },
        { type: 'Error', value: 'database full' },
      ] },
      breadcrumbs: [{ category: 'sentry.event', message: error.message }],
    };

    const scrubbed = scrubEvent(event);
    expect(JSON.stringify(scrubbed)).not.toContain('Private note');
    expect(JSON.stringify(scrubbed)).not.toContain('params:');
    expect(scrubbed.exception?.values?.[0]?.stacktrace?.frames).toEqual(frames);
    expect(scrubbed.exception?.values?.[1]?.value).toBe('Database query failed');
    expect(scrubbed.exception?.values?.[2]?.value).toBe('database full');
  });

  it('blocks handled and automatic reports while off', async () => {
    // Reinitialize so this test can inspect the actual beforeSend callback.
    await setReportsEnabled(false);
    await setReportsEnabled(true);
    const beforeSend = jest.mocked(Sentry.init).mock.calls.at(-1)?.[0].beforeSend;
    expect(reportsEnabled()).toBe(true);
    await setReportsEnabled(false);
    expect(reportsEnabled()).toBe(false);
    reportError(new Error('x'), 'db.start');
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(beforeSend?.({ type: undefined, message: 'automatic error' }, {})).toBeNull();
  });

  it('sends a handled error with its label while enabled', () => {
    reportError(new Error('x'), 'db.start');
    expect(Sentry.captureException).toHaveBeenCalledWith(new Error('x'), { tags: { where: 'db.start' } });
  });

  it('waits for shutdown before restarting when toggled off then on', async () => {
    let finishClose!: () => void;
    jest.mocked(Sentry.close).mockReturnValueOnce(new Promise<void>((resolve) => { finishClose = resolve; }));
    const shutdown = setReportsEnabled(false);
    const restart = setReportsEnabled(true);
    startMonitoring();
    reportError(new Error('during shutdown'), 'db.start');
    expect(Sentry.close).toHaveBeenCalledTimes(1);
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();

    finishClose();
    await Promise.all([shutdown, restart]);
    expect(Sentry.init).toHaveBeenCalledTimes(1);
    reportError(new Error('after restart'), 'db.start');
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('keeps reporting off when the final choice during shutdown is off', async () => {
    let finishClose!: () => void;
    jest.mocked(Sentry.close).mockReturnValueOnce(new Promise<void>((resolve) => { finishClose = resolve; }));
    const shutdown = setReportsEnabled(false);
    void setReportsEnabled(true);
    void setReportsEnabled(false);
    finishClose();
    await shutdown;
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.close).toHaveBeenCalledTimes(1);
    expect(reportsEnabled()).toBe(false);
  });

  it('does not start without a DSN or reinitialize an active client', async () => {
    startMonitoring();
    expect(Sentry.init).not.toHaveBeenCalled();
    await setReportsEnabled(false);
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    await setReportsEnabled(true);
    expect(Sentry.init).not.toHaveBeenCalled();
    reportError(new Error('no DSN'), 'db.start');
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
