// The only file in the app that imports react-native-purchases. Everything else goes through src/features/pro,
// the way shared/storage is the only file that imports MMKV.
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { setPro } from './store';
import { env } from '@/shared/env';

// Re-exported for index.ts, which is the only surface other files may import.
export type { PurchasesPackage };

const ENTITLEMENT = 'pro';

let configuredFlag = false;

/** True when the `pro` entitlement is active for this customer. */
const hasPro = (customerInfo: CustomerInfo): boolean => customerInfo.entitlements.active[ENTITLEMENT] !== undefined;

// A user cancel comes through as an error with code PURCHASE_CANCELLED_ERROR, which the SDK normalizes to
// userCancelled true on every rejection it passes on.
const isCancelled = (error: unknown): boolean => (error as { userCancelled?: boolean | null })?.userCancelled === true;

// lazy: iOS only. Add an Android key and configure with it on Android to sell there (see paywallEnabled in store.ts).
/** Configures RevenueCat once, from the root layout. A no-op off iOS, without a key, or when already configured. */
export function configurePurchases(): void {
  const apiKey = env('EXPO_PUBLIC_REVENUECAT_IOS_KEY');
  if (Platform.OS !== 'ios' || configuredFlag || !apiKey) return;
  Purchases.configure({ apiKey });
  configuredFlag = true;
  // The SDK fires the listener with its cached info, and again on every purchase, renewal or refund.
  Purchases.addCustomerInfoUpdateListener((customerInfo) => setPro(hasPro(customerInfo)));
}

export const isConfigured = (): boolean => configuredFlag;

/** The packages of the current offering. Throws when configurePurchases has not run. */
export async function getPackages(): Promise<PurchasesPackage[]> {
  if (!configuredFlag) throw new Error('RevenueCat is not configured');
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

/**
 * Buys a package. Returns 'bought' when the entitlement came active, 'pending' when the store took the purchase
 * but the entitlement is not active yet (Ask to Buy awaiting approval, or the product is not attached to the
 * entitlement), and 'cancelled' when the user backed out.
 */
export async function buy(pkg: PurchasesPackage): Promise<'bought' | 'cancelled' | 'pending'> {
  if (!configuredFlag) throw new Error('RevenueCat is not configured');
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const active = hasPro(customerInfo);
    setPro(active);
    return active ? 'bought' : 'pending';
  } catch (error) {
    if (isCancelled(error)) return 'cancelled';
    throw error;
  }
}

/** Restores past purchases from the user's store account. False when nothing was active afterwards. */
export async function restore(): Promise<boolean> {
  if (!configuredFlag) throw new Error('RevenueCat is not configured');
  const customerInfo = await Purchases.restorePurchases();
  const active = hasPro(customerInfo);
  setPro(active);
  return active;
}