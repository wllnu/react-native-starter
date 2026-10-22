---
id: rn-monetization
title: In-app purchases and entitlements
paths: **/*.ts, **/*.tsx
when: The change touches purchases, entitlements, paywalls, or features gated on a paid plan.
---

## rn-monetization/entitlement-hook-only
Severity: error
Rule: Gate paid features on the pro feature's entitlement hook (`useIsPro` or `getIsPro` from `@/features/pro`).
Violated when: the changed lines outside `src/features/pro/` read `customerInfo.entitlements` or `.entitlements.active`, or call `Purchases.getCustomerInfo(` to decide access.
Followed when: paid-feature checks in the changed lines call `useIsPro()` or `getIsPro()`, and no direct RevenueCat read appears outside `src/features/pro/`.

Good:
```tsx
import { useIsPro } from "@/features/pro";

function ReportsScreen() {
  const isPro = useIsPro();
  return isPro ? <AdvancedReports /> : <UpgradeHint />;
}
```

Bad:
```tsx
import Purchases from "react-native-purchases";

const canExport = async (): Promise<boolean> => {
  const info = await Purchases.getCustomerInfo();
  return info.entitlements.active["pro"] !== undefined;
};
```

## rn-monetization/no-local-entitlement-flag
Severity: error
Rule: Set entitlement flags such as `isPro` or `isPremium` only from RevenueCat customer info.
Violated when: an `isPro`, `isPremium` or similar flag is set to a literal `true`, follows a debug, screenshot or dev toggle, or its storage key such as `PRO_KEY` is written with any value other than the flag itself.
Followed when: the flag changes only through a setter fed by RevenueCat `customerInfo`, such as `setPro(hasPro(customerInfo))`, and storage only mirrors it as a startup cache.

Good:
```ts
const hasPro = (info: CustomerInfo): boolean =>
  info.entitlements.active[ENTITLEMENT] !== undefined;
setPro(hasPro(customerInfo));
```

Bad:
```ts
// Grants Pro without a purchase, for screenshots.
storage.set(PRO_KEY, true);
setPro(true);
```

## rn-monetization/restore-purchases
Severity: warning
Rule: Offer a restore-purchases action next to the buy button on every paywall.
Violated when: the changed lines render a buy or purchase button (`onPress` calling `purchase(`, `buy(` or `Purchases.purchasePackage(`) with no restore action calling `restorePurchases(`, `restore(` or `Purchases.restorePurchases(`.
Followed when: the paywall in the changed lines also renders a restore control wired to `restorePurchases(`, `restore(` or `Purchases.restorePurchases(`.

Good:
```tsx
<PrimaryButton label={t("paywall.buy")} disabled={status !== "ready"} onPress={() => void purchase()} />
<TextButton label={t("paywall.restore")} disabled={busy} onPress={() => void restorePurchases()} />
```

Bad:
```tsx
<PrimaryButton label={t("paywall.buy")} disabled={status !== "ready"} onPress={() => void purchase()} />
```