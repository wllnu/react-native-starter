// The SDK also exports init/trackEvent/dispose as named exports; the mock replaces the documented default export.
/* eslint-disable import/no-named-as-default-member -- the mock replaces the documented default export, so calls must go through it */
import Aptabase from '@aptabase/react-native';
import { env } from '../env';
import { setReportsEnabled } from '../monitoring';
import { setAnalyticsEnabled, startAnalytics, track } from './index';

jest.mock('react-native-mmkv', () => jest.requireActual<typeof import('@/shared/storage/test-support')>('@/shared/storage/test-support').mmkvMock);

describe('analytics', () => {
  const originalKey = env('EXPO_PUBLIC_APTABASE_KEY');

  beforeEach(async () => {
    process.env.EXPO_PUBLIC_APTABASE_KEY = 'A-GB-0000000000';
    setAnalyticsEnabled(false);
    // Reset the reports switch the stored value belongs to, and leave it on.
    await setReportsEnabled(false);
    await setReportsEnabled(true);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await setReportsEnabled(false);
    setAnalyticsEnabled(false);
    if (originalKey === undefined) delete process.env.EXPO_PUBLIC_APTABASE_KEY;
    else process.env.EXPO_PUBLIC_APTABASE_KEY = originalKey;
  });

  it('inits once with the key and tracks typed events while reports are on', () => {
    startAnalytics();
    expect(Aptabase.init).toHaveBeenCalledTimes(1);
    expect(Aptabase.init).toHaveBeenCalledWith('A-GB-0000000000');
    track('note_created', { hasBody: 'yes' });
    expect(Aptabase.trackEvent).toHaveBeenCalledWith('note_created', { hasBody: 'yes' });
  });

  it('does not init or track while reports are off', async () => {
    await setReportsEnabled(false);
    startAnalytics();
    expect(Aptabase.init).not.toHaveBeenCalled();
    track('app_opened');
    expect(Aptabase.trackEvent).not.toHaveBeenCalled();
  });

  it('does not init or track without a key', () => {
    delete process.env.EXPO_PUBLIC_APTABASE_KEY;
    startAnalytics();
    expect(Aptabase.init).not.toHaveBeenCalled();
    track('app_opened');
    expect(Aptabase.trackEvent).not.toHaveBeenCalled();
  });

  it('disposes and stops tracking when disabled after starting', () => {
    startAnalytics();
    setAnalyticsEnabled(false);
    expect(Aptabase.dispose).toHaveBeenCalledTimes(1);
    track('app_opened');
    expect(Aptabase.trackEvent).not.toHaveBeenCalled();
  });
});
