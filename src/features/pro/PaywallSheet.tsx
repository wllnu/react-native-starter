// The paywall sheet: what Pro adds, the two store plans, one buy button, restore and the legal links.
// All RevenueCat I/O lives in the usePaywall hook.
import { openURL } from "expo-linking";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { t } from "@/shared/i18n";
import { radius, spacing, touchMin, useFocusRing, useTheme } from "@/shared/theme";
import {
  Disclosure,
  PrimaryButton,
  QuietButton,
  SheetFoot,
  SheetHead,
  Text,
  TextButton,
  Toast,
} from "@/shared/ui";

import type { Plan, PlanId } from "./lib/plans";
import { PRIVACY_URL, TERMS_URL } from "./links";
import { useIsPro } from "./store";
import { usePaywall } from "./usePaywall";

/** A TextButton look with accessibilityRole "link", which TextButton (always "button") cannot carry. */
function LinkButton({ label, url }: { label: string; url: string }) {
  const { colors } = useTheme();
  const focus = useFocusRing(colors.ink);
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => void openURL(url)}
      {...focus.handlers}
      style={({ pressed }) => [styles.link, { opacity: pressed ? 0.5 : 1 }, focus.style]}
    >
      <Text type="secondary-strong" color="ink">
        {label}
      </Text>
    </Pressable>
  );
}

/** One plan choice: the name, the price line and, for the yearly plan, its per-month price. */
function PlanRow({ plan, selected, onSelect }: { plan: Plan; selected: boolean; onSelect: (id: PlanId) => void }) {
  const { colors } = useTheme();
  const focus = useFocusRing(selected ? colors["on-ink"] : colors.ink, true);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => onSelect(plan.id)}
      {...focus.handlers}
      style={({ pressed }) => [
        styles.plan,
        // Selection is an ink fill, like the current tab (DESIGN.md).
        { backgroundColor: selected ? colors.ink : pressed ? colors.fill : "transparent" },
        focus.style,
      ]}
    >
      <Text type="body-strong" color={selected ? "on-ink" : "ink"}>
        {plan.id === "yearly" ? t("paywall.yearly") : t("paywall.monthly")}
      </Text>
      <Text type="secondary" color={selected ? "on-ink-muted" : "secondary"}>
        {plan.id === "yearly"
          ? t("paywall.perYear", { price: plan.price })
          : t("paywall.perMonth", { price: plan.price })}
      </Text>
      {plan.id === "yearly" && plan.perMonth !== null ? (
        <Text type="secondary" color={selected ? "on-ink-muted" : "muted"}>
          {t("paywall.yearlyPerMonth", { price: plan.perMonth })}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function PaywallSheet() {
  const { colors } = useTheme();
  const { status, plans, selected, select, reload, purchase, restorePurchases } = usePaywall();
  const isPro = useIsPro();
  const busy = status === "buying" || status === "restoring";

  return (
    <View style={[styles.fill, { backgroundColor: colors.canvas }]}>
      <SheetHead title={t("paywall.title")} onClose={() => router.back()} />
      <ScrollView style={styles.fill} contentContainerStyle={styles.body}>
        <Text type="secondary" color="secondary">
          {t("paywall.pitch")}
        </Text>
        <Disclosure title={t("paywall.title")}>
          <Text type="secondary" color="secondary">
            {t("paywall.info")}
          </Text>
        </Disclosure>
        {isPro ? (
          <Text type="secondary" color="secondary">
            {t("paywall.active")}
          </Text>
        ) : status === "loading" ? (
          <Text type="secondary" color="muted">
            {t("paywall.loading")}
          </Text>
        ) : status === "failed" ? (
          <View style={styles.failed}>
            <Text type="secondary" color="secondary">
              {t("paywall.loadFailed")}
            </Text>
            <QuietButton label={t("paywall.retry")} onPress={reload} />
          </View>
        ) : (
          <View accessibilityRole="radiogroup" style={styles.plans}>
            {/* eslint-disable-next-line no-restricted-syntax -- always two plans inside a radiogroup; a FlatList here would nest in the sheet's ScrollView */}
            {plans.map((plan) => (
              <PlanRow key={plan.id} plan={plan} selected={selected === plan.id} onSelect={select} />
            ))}
          </View>
        )}
      </ScrollView>
      <SheetFoot>
        <View style={styles.foot}>
          {isPro ? null : (
            <>
              <PrimaryButton
                label={t("paywall.buy")}
                disabled={status !== "ready"}
                onPress={() => void purchase()}
              />
              <Text type="caption" color="muted" style={styles.renews}>
                {t("paywall.renews")}
              </Text>
            </>
          )}
          <View style={styles.links}>
            <TextButton label={t("paywall.restore")} disabled={busy} onPress={() => void restorePurchases()} />
            <LinkButton label={t("paywall.terms")} url={TERMS_URL} />
            <LinkButton label={t("paywall.privacy")} url={PRIVACY_URL} />
          </View>
        </View>
      </SheetFoot>
      <Toast announce={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingHorizontal: spacing[4], paddingBottom: spacing[6], gap: spacing[3] },
  plans: { gap: spacing[2] },
  plan: {
    minHeight: touchMin,
    borderRadius: radius.md,
    alignItems: "flex-start",
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    gap: spacing[1],
  },
  failed: { gap: spacing[2] },
  foot: { gap: spacing[2] },
  renews: { textAlign: "center" },
  links: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  link: {
    minHeight: touchMin,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[1],
  },
});