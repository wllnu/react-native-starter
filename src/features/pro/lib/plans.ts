// Pure mapping of RevenueCat packages to the two plans the paywall shows. No React, no SDK call.

import type { PurchasesPackage } from 'react-native-purchases';

export type PlanId = 'yearly' | 'monthly';

export type Plan = {
  id: PlanId;
  /** The RevenueCat package, handed back to buy() untouched. */
  pkg: PurchasesPackage;
  /** The store's localized price, such as "$24.99". */
  price: string;
  /** The store's localized per-month price of the yearly plan. Only set for yearly. */
  perMonth: string | null;
};

/** The yearly and monthly packages of an offering, yearly first so the paywall can preselect it. Packages of other types are ignored. */
export function pickPlans(packages: PurchasesPackage[]): Plan[] {
  const plans: Plan[] = [];
  const yearly = packages.find((pkg) => pkg.packageType === 'ANNUAL');
  if (yearly !== undefined) {
    plans.push({
      id: 'yearly',
      pkg: yearly,
      price: yearly.product.priceString,
      perMonth: yearly.product.pricePerMonthString,
    });
  }
  const monthly = packages.find((pkg) => pkg.packageType === 'MONTHLY');
  if (monthly !== undefined) {
    plans.push({ id: 'monthly', pkg: monthly, price: monthly.product.priceString, perMonth: null });
  }
  return plans;
}