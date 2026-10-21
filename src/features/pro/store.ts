import { Platform } from 'react-native';
import { create } from 'zustand';
import { z } from 'zod';
import { storage } from '@/shared/storage';

export const PRO_KEY = 'pro.active';

type State = { isPro: boolean };

/**
 * Read once from MMKV at import, so the first frame never waits on RevenueCat. A cached boolean of whether the
 * subscription is active, not a token: it unlocks nothing a RevenueCat check would not unlock again.
 */
export const useProStore = create<State>()(() => ({
  isPro: storage.getJSON(PRO_KEY, z.boolean()) ?? false,
}));

// MMKV writes are synchronous, so a crash mid-set loses nothing.
useProStore.subscribe((state, prev) => {
  if (state.isPro !== prev.isPro) storage.set(PRO_KEY, state.isPro);
});

/** Writes the entitlement state. Called by purchases.ts, which keeps the store in step with RevenueCat. */
export const setPro = (isPro: boolean): void => useProStore.setState({ isPro });

/**
 * False where nothing can be bought, so the paywall and the Pro rows in Settings stay off. That includes a build
 * without a RevenueCat key, such as a fresh clone or a TestFlight build made before the store is set up.
 * lazy: iOS only. Add EXPO_PUBLIC_REVENUECAT_ANDROID_KEY here and in purchases.ts to sell on Android.
 */
export const paywallEnabled = (): boolean => Platform.OS === 'ios' && !!process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;

export const getIsPro = (): boolean => useProStore.getState().isPro;

// ---------- selectors ----------

export const useIsPro = (): boolean => useProStore((s) => s.isPro);
