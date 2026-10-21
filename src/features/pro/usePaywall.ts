// The paywall's I/O hook. Every RevenueCat call and its toasts live here, so PaywallSheet only renders.
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { t } from '@/shared/i18n';
import { showToast } from '@/shared/ui';

import { buy, getPackages, restore } from './purchases';
import { pickPlans, type Plan, type PlanId } from './lib/plans';

/** loading and failed cover the offering load; buying and restoring the two actions. */
type OfferingStatus = 'loading' | 'failed' | 'ready';
export type PaywallStatus = OfferingStatus | 'buying' | 'restoring';

export type Paywall = {
  status: PaywallStatus;
  plans: Plan[];
  /** The preselected plan, or null before the packages have loaded. */
  selected: PlanId | null;
  select: (id: PlanId) => void;
  reload: () => void;
  purchase: () => Promise<void>;
  restorePurchases: () => Promise<void>;
};

export function usePaywall(): Paywall {
  const [offeringStatus, setOfferingStatus] = useState<OfferingStatus>('loading');
  const [action, setAction] = useState<'buying' | 'restoring' | null>(null);
  const status = action ?? offeringStatus;
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<PlanId | null>(null);
  const [attempt, setAttempt] = useState(0);
  // The async continuations below must not set state once the sheet has closed.
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The offering loads once on mount, and again after a failure through reload().
  useEffect(() => {
    void (async () => {
      if (mounted.current) setOfferingStatus('loading');
      try {
        const list = pickPlans(await getPackages());
        if (!mounted.current) return;
        if (list.length === 0) {
          // No packages mean the SDK is not configured (a dev build without a key) or the store setup is off:
          // the same failed state as a network error, never an empty paywall.
          setOfferingStatus('failed');
          return;
        }
        setPlans(list);
        // Yearly is preselected, monthly stands in when the offering has none. A retried load keeps a valid pick.
        setSelected((prev) => (list.some((plan) => plan.id === prev) ? prev : (list[0]?.id ?? null)));
        setOfferingStatus('ready');
      } catch {
        if (mounted.current) setOfferingStatus('failed');
      }
    })();
    // getPackages and pickPlans are module functions; the attempt number is the only variable.
  }, [attempt]);

  /** Buys the selected plan. A cancelled purchase stays silent. */
  const purchase = async (): Promise<void> => {
    if (!mounted.current || status !== 'ready') return;
    const plan = plans.find((candidate) => candidate.id === selected) ?? null;
    if (plan === null) return;
    setAction('buying');
    try {
      const result = await buy(plan.pkg);
      if (!mounted.current) return;
      if (result === 'bought') {
        showToast(t('paywall.bought'), { check: true });
        router.back();
      } else if (result === 'pending') showToast(t('paywall.pending'));
    } catch {
      if (!mounted.current) return;
      // Never log the error: it can carry receipts. The toast says the purchase failed, nothing else.
      showToast(t('paywall.buyFailed'));
    } finally {
      if (mounted.current) setAction(null);
    }
  };

  /** Restores past purchases and says when the Apple ID has none. */
  const restorePurchases = async (): Promise<void> => {
    if (!mounted.current || status === 'buying' || status === 'restoring') return;
    setAction('restoring');
    try {
      const restored = await restore();
      if (!mounted.current) return;
      if (restored) {
        showToast(t('paywall.restored'), { check: true });
        router.back();
      } else {
        showToast(t('paywall.nothingToRestore'));
      }
    } catch {
      if (!mounted.current) return;
      showToast(t('paywall.restoreFailed'));
    } finally {
      if (mounted.current) setAction(null);
    }
  };

  return {
    status,
    plans,
    selected,
    select: (id) => setSelected(id),
    reload: () => setAttempt((n) => n + 1),
    purchase,
    restorePurchases,
  };
}
