// Drives the sheet through the global react-native-purchases mock (jest.setup.js): the SDK is
// configured with a fake key and `getOfferings` is pointed at a fake offering, so no app module is mocked.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import Purchases from 'react-native-purchases';
import type { CustomerInfo, MakePurchaseResult, PurchasesOfferings, PurchasesPackage } from 'react-native-purchases';

import { t } from '@/shared/i18n';
import { useToastStore } from '@/shared/ui';

import { PaywallSheet } from './PaywallSheet';
import { configurePurchases } from './purchases';
import { useProStore } from './store';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canDismiss: jest.fn(() => true), dismissAll: jest.fn(), navigate: jest.fn() },
}));
jest.mock('react-native-mmkv', () => jest.requireActual<typeof import('@/shared/storage/test-support')>('@/shared/storage/test-support').mmkvMock);

process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'test';
configurePurchases();

const proCustomer: CustomerInfo = { entitlements: { active: { pro: {} } } } as unknown as CustomerInfo;
const freeCustomer: CustomerInfo = { entitlements: { active: {} } } as unknown as CustomerInfo;
const purchaseResult = {
  customerInfo: proCustomer,
  productIdentifier: 'pro_yearly',
} as unknown as MakePurchaseResult;
// The store took the purchase but the entitlement is not active (Ask to Buy, or a setup problem).
const pendingResult = {
  customerInfo: freeCustomer,
  productIdentifier: 'pro_yearly',
} as unknown as MakePurchaseResult;

type PkgFixture = { packageType: string; price: string; perMonth?: string | null };

const pkg = ({ packageType, price, perMonth = null }: PkgFixture): PurchasesPackage =>
  ({ packageType, product: { priceString: price, pricePerMonthString: perMonth } }) as unknown as PurchasesPackage;

const annualPkg = pkg({ packageType: 'ANNUAL', price: '$24.99', perMonth: '$2.08' });
const monthlyPkg = pkg({ packageType: 'MONTHLY', price: '$3.99' });

const offeringsWith = (availablePackages: PurchasesPackage[]): PurchasesOfferings =>
  ({ current: { availablePackages }, all: {} }) as unknown as PurchasesOfferings;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
  // The bought toast hides on a 2400 ms timer that would outlive the tests.
  jest.useFakeTimers();
  useProStore.setState({ isPro: false });
  useToastStore.setState({ message: '', check: false, visible: false, id: 0 });
  jest.mocked(Purchases.purchasePackage).mockResolvedValue(purchaseResult);
  jest.mocked(Purchases.restorePurchases).mockResolvedValue(freeCustomer);
  jest.mocked(Purchases.getOfferings).mockResolvedValue(offeringsWith([annualPkg, monthlyPkg]));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('PaywallSheet', () => {
  it('shows both store prices with the yearly plan preselected', async () => {
    await render(<PaywallSheet />);
    await act(async () => {});

    expect(screen.getByText(t('paywall.perYear', { price: '$24.99' }))).toBeOnTheScreen();
    expect(screen.getByText(t('paywall.yearlyPerMonth', { price: '$2.08' }))).toBeOnTheScreen();
    expect(screen.getByText(t('paywall.perMonth', { price: '$3.99' }))).toBeOnTheScreen();

    const yearly = screen.getByRole('radio', { name: /Yearly/ });
    const monthly = screen.getByRole('radio', { name: /Monthly/ });
    expect(yearly).toBeSelected();
    expect(monthly).not.toBeSelected();
  });

  it('pressing Subscribe buys the selected yearly package and closes the sheet', async () => {
    await render(<PaywallSheet />);
    await act(async () => {});

    await fireEvent.press(screen.getByRole('button', { name: t('paywall.buy') }));
    await act(async () => {});

    expect(jest.mocked(Purchases.purchasePackage)).toHaveBeenCalledWith(annualPkg);
    expect(jest.mocked(router.back)).toHaveBeenCalledTimes(1);
  });

  it('shows the pending toast and keeps the sheet open when the purchase resolves without the entitlement', async () => {
    jest.mocked(Purchases.purchasePackage).mockResolvedValue(pendingResult);
    await render(<PaywallSheet />);
    await act(async () => {});

    await fireEvent.press(screen.getByRole('button', { name: t('paywall.buy') }));
    await act(async () => {});

    expect(useToastStore.getState().message).toBe(t('paywall.pending'));
    expect(useToastStore.getState().id).toBe(1);
    expect(router.back).not.toHaveBeenCalled();
  });

  it('shows a failure with Try again and keeps Subscribe disabled when the prices do not load', async () => {
    jest.mocked(Purchases.getOfferings).mockRejectedValue(new Error('offline'));
    await render(<PaywallSheet />);
    await act(async () => {});

    expect(screen.getByText(t('paywall.loadFailed'))).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: t('paywall.retry') })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: t('paywall.buy') })).toBeDisabled();
    // Restoring needs no package list, so it stays usable while the prices are down.
    expect(screen.getByRole('button', { name: t('paywall.restore') })).toBeEnabled();
  });

  it.each(['empty', 'error'] as const)('keeps price retry available after an %s restore', async (result) => {
    jest.mocked(Purchases.getOfferings).mockRejectedValue(new Error('offline'));
    if (result === 'error') jest.mocked(Purchases.restorePurchases).mockRejectedValue(new Error('offline'));
    await render(<PaywallSheet />);
    await act(async () => {});

    await fireEvent.press(screen.getByRole('button', { name: t('paywall.restore') }));
    await act(async () => {});

    expect(screen.getByText(t('paywall.loadFailed'))).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: t('paywall.buy') })).toBeDisabled();
    expect(screen.getByRole('button', { name: t('paywall.restore') })).toBeEnabled();
    expect(router.back).not.toHaveBeenCalled();

    jest.mocked(Purchases.getOfferings).mockResolvedValue(offeringsWith([annualPkg, monthlyPkg]));
    await fireEvent.press(screen.getByRole('button', { name: t('paywall.retry') }));
    await act(async () => {});
    expect(screen.getByRole('radio', { name: /Yearly/ })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: t('paywall.buy') })).toBeEnabled();
  });

  it('keeps actions disabled when prices finish loading during a restore', async () => {
    const prices = deferred<PurchasesOfferings>();
    const restore = deferred<CustomerInfo>();
    jest.mocked(Purchases.getOfferings).mockReturnValue(prices.promise);
    jest.mocked(Purchases.restorePurchases).mockReturnValue(restore.promise);
    await render(<PaywallSheet />);
    await fireEvent.press(screen.getByRole('button', { name: t('paywall.restore') }));

    await act(async () => {
      prices.resolve(offeringsWith([annualPkg, monthlyPkg]));
    });
    expect(screen.getByRole('button', { name: t('paywall.buy') })).toBeDisabled();
    expect(screen.getByRole('button', { name: t('paywall.restore') })).toBeDisabled();

    await act(async () => {
      restore.resolve(freeCustomer);
    });
    expect(screen.getByRole('button', { name: t('paywall.buy') })).toBeEnabled();
  });

  it('keeps loading prices when restore finishes first', async () => {
    const prices = deferred<PurchasesOfferings>();
    jest.mocked(Purchases.getOfferings).mockReturnValue(prices.promise);
    await render(<PaywallSheet />);
    await fireEvent.press(screen.getByRole('button', { name: t('paywall.restore') }));
    await act(async () => {});

    expect(screen.getByText(t('paywall.loading'))).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: t('paywall.buy') })).toBeDisabled();

    await act(async () => {
      prices.resolve(offeringsWith([annualPkg, monthlyPkg]));
    });
    expect(screen.getByRole('button', { name: t('paywall.buy') })).toBeEnabled();
  });

  it.each(['purchase', 'restore'] as const)('does not navigate or show a toast when %s succeeds after closing', async (action) => {
    const purchase = deferred<MakePurchaseResult>();
    const restore = deferred<CustomerInfo>();
    jest.mocked(Purchases.purchasePackage).mockReturnValue(purchase.promise);
    jest.mocked(Purchases.restorePurchases).mockReturnValue(restore.promise);
    const view = await render(<PaywallSheet />);
    await act(async () => {});
    await fireEvent.press(screen.getByRole('button', { name: t(action === 'purchase' ? 'paywall.buy' : 'paywall.restore') }));
    await view.unmount();

    await act(async () => {
      if (action === 'purchase') purchase.resolve(purchaseResult);
      else restore.resolve(proCustomer);
    });

    expect(useProStore.getState().isPro).toBe(true);
    expect(router.back).not.toHaveBeenCalled();
    expect(useToastStore.getState().id).toBe(0);
  });

  it.each(['purchase', 'restore'] as const)('does not show an error toast when %s fails after closing', async (action) => {
    const purchase = deferred<MakePurchaseResult>();
    const restore = deferred<CustomerInfo>();
    jest.mocked(Purchases.purchasePackage).mockReturnValue(purchase.promise);
    jest.mocked(Purchases.restorePurchases).mockReturnValue(restore.promise);
    const view = await render(<PaywallSheet />);
    await act(async () => {});
    await fireEvent.press(screen.getByRole('button', { name: t(action === 'purchase' ? 'paywall.buy' : 'paywall.restore') }));
    await view.unmount();

    await act(async () => {
      if (action === 'purchase') purchase.reject(new Error('offline'));
      else restore.reject(new Error('offline'));
    });

    expect(router.back).not.toHaveBeenCalled();
    expect(useToastStore.getState().id).toBe(0);
  });
});
