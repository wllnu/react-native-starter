// Pure plan mapping: no React, no purchases calls, no store.
import type { PurchasesPackage } from 'react-native-purchases';

import { pickPlans } from './plans';

type Fixture = { packageType: string; price: string; perMonth?: string | null };

/** A minimal package with just the fields the paywall reads. */
const pkg = ({ packageType, price, perMonth = null }: Fixture): PurchasesPackage =>
  ({ packageType, product: { priceString: price, pricePerMonthString: perMonth } }) as unknown as PurchasesPackage;

describe('pickPlans', () => {
  it('returns the yearly plan before the monthly one, with the per-month price on the yearly row', () => {
    const yearly = pkg({ packageType: 'ANNUAL', price: '$24.99', perMonth: '$2.08' });
    const monthly = pkg({ packageType: 'MONTHLY', price: '$3.99' });
    expect(pickPlans([monthly, yearly])).toEqual([
      { id: 'yearly', pkg: yearly, price: '$24.99', perMonth: '$2.08' },
      { id: 'monthly', pkg: monthly, price: '$3.99', perMonth: null },
    ]);
  });

  it('ignores packages of other types', () => {
    const yearly = pkg({ packageType: 'ANNUAL', price: '$24.99', perMonth: '$2.08' });
    expect(
      pickPlans([pkg({ packageType: 'LIFETIME', price: '$199' }), yearly, pkg({ packageType: 'CUSTOM', price: '$9' })]),
    ).toEqual([{ id: 'yearly', pkg: yearly, price: '$24.99', perMonth: '$2.08' }]);
  });

  it('keeps the monthly plan when the offering has no yearly', () => {
    const monthly = pkg({ packageType: 'MONTHLY', price: '$3.99' });
    expect(pickPlans([monthly])).toEqual([{ id: 'monthly', pkg: monthly, price: '$3.99', perMonth: null }]);
  });

  it('returns nothing for an empty offering', () => {
    expect(pickPlans([])).toEqual([]);
  });
});