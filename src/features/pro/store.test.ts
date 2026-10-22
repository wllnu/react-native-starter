import { act, renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { storage } from '@/shared/storage';
import { env } from '@/shared/env';
import { z } from 'zod';
import { PRO_KEY, getIsPro, paywallEnabled, setPro, useIsPro } from './store';

jest.mock('react-native-mmkv', () => jest.requireActual<typeof import('@/shared/storage/test-support')>('@/shared/storage/test-support').mmkvMock);

describe('pro store', () => {
  it('isPro starts false with empty storage', () => {
    expect(getIsPro()).toBe(false);
    expect(storage.getJSON(PRO_KEY, z.boolean())).toBeNull();
  });

  it('setPro flips getIsPro and writes pro.active to storage', async () => {
    const { result } = await renderHook(() => useIsPro());
    await act(async () => {
      setPro(true);
    });
    expect(result.current).toBe(true);
    expect(getIsPro()).toBe(true);
    expect(storage.getJSON(PRO_KEY, z.boolean())).toBe(true);
    await act(async () => {
      setPro(false);
    });
    expect(getIsPro()).toBe(false);
    expect(storage.getJSON(PRO_KEY, z.boolean())).toBe(false);
  });
});

describe('paywallEnabled', () => {
  afterEach(() => {
    // Puts Platform.OS back after replaceProperty.
    jest.restoreAllMocks();
  });

  it('is off on Android', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    expect(paywallEnabled()).toBe(false);
  });

  it('is on on iOS with a RevenueCat key', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    expect(paywallEnabled()).toBe(true);
  });

  it('is off on iOS without a RevenueCat key, so nobody sees a paywall that cannot sell', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const key = env('EXPO_PUBLIC_REVENUECAT_IOS_KEY');
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    try {
      expect(paywallEnabled()).toBe(false);
    } finally {
      process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = key;
    }
  });
});
