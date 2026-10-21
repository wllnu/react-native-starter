import { openURL } from "expo-linking";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Switch, View } from "react-native";

import { MANAGE_URL, paywallEnabled, useIsPro } from "@/features/pro";
import { setAnalyticsEnabled } from "@/shared/analytics";
import { t } from "@/shared/i18n";
import { setReportsEnabled, useReportsEnabled } from "@/shared/monitoring";
import { spacing, useTheme } from "@/shared/theme";
import { Card, ListRow, showToast, Text } from "@/shared/ui";

/** The Settings tab: the usage and crash reports switch, and the Pro row where Pro is sold. */
export function SettingsScreen() {
  const { colors } = useTheme();
  const reports = useReportsEnabled();
  const isPro = useIsPro();

  // One switch covers Sentry and Aptabase. monitoring stores the choice; analytics follows it.
  const toggleReports = (on: boolean) => {
    void setReportsEnabled(on);
    setAnalyticsEnabled(on);
    showToast(t(on ? "settings.reportsOnDone" : "settings.reportsOffDone"));
  };

  return (
    <ScrollView style={[styles.fill, { backgroundColor: colors.canvas }]} contentContainerStyle={styles.body}>
      <View style={styles.group}>
        <Card>
          <ListRow
            title={t("settings.reports")}
            trailing={
              <Switch
                accessibilityLabel={t("settings.reports")}
                value={reports}
                onValueChange={toggleReports}
                trackColor={{ false: colors.faint, true: colors.ink }}
                ios_backgroundColor={colors.faint}
                thumbColor={colors["on-ink"]}
              />
            }
          />
        </Card>
        <Text type="caption" color="muted" style={styles.hint}>
          {t("settings.reportsHint")}
        </Text>
      </View>
      {paywallEnabled() ? (
        <Card>
          {isPro ? (
            <ListRow title={t("settings.manage")} onPress={() => void openURL(MANAGE_URL)} />
          ) : (
            <ListRow title={t("settings.pro")} onPress={() => router.push("/paywall")} />
          )}
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { padding: spacing[4], gap: spacing[3] },
  group: { gap: spacing[2] },
  hint: { paddingHorizontal: spacing[4] },
});
