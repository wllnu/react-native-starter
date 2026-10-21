import { Stack, useIsFocused } from "expo-router";
import { useEffect, type ReactElement } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { configurePurchases } from "@/features/pro";
import { startAnalytics, track } from "@/shared/analytics";
import { startDatabase } from "@/shared/db/client";
import { t } from "@/shared/i18n";
import { startMonitoring, wrapRoot } from "@/shared/monitoring";
import { radius, sizes, useTheme } from "@/shared/theme";
import { ConfirmHost, Toast } from "@/shared/ui";

// Before the first render, so a crash while starting up is caught too. It does no I/O worth waiting for.
startMonitoring();
startAnalytics();
track("app_opened");

export { ErrorBoundary } from "@/shared/monitoring/ErrorBoundary";

/**
 * Every screen hosts confirm() itself, and only the focused one renders it. A Modal presents from the screen it is
 * mounted in, and iOS shows nothing when that screen is already presenting a sheet, so one host at the root would
 * never appear over a sheet.
 */
function ScreenLayout({ children }: { children: ReactElement }) {
  const focused = useIsFocused();
  return (
    <>
      {children}
      {focused ? <ConfirmHost /> : null}
    </>
  );
}

function RootLayout() {
  const { colors } = useTheme();
  useEffect(() => {
    // After the first frame, so the database open and migrations never hold it up.
    void startDatabase();
    configurePurchases();
  }, []);
  // A form sheet. Copy these options for a new sheet route.
  const sheet = {
    presentation: "formSheet",
    sheetGrabberVisible: true,
    sheetCornerRadius: radius.xl,
    contentStyle: { backgroundColor: colors.canvas },
  } as const;
  return (
    <GestureHandlerRootView style={styles.fill}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <Stack
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}
            screenLayout={({ children }) => <ScreenLayout>{children}</ScreenLayout>}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="note/[id]"
              options={{
                headerShown: true,
                title: "",
                headerBackTitle: t("tab.notes"),
                headerStyle: { backgroundColor: colors.canvas },
                headerTintColor: colors.ink,
                headerShadowVisible: false,
              }}
            />
            {/* lazy: the tall detent keeps the pinned foot simple. Size it to the content if a short form looks empty. */}
            <Stack.Screen name="new-note" options={{ ...sheet, sheetAllowedDetents: [0.93] }} />
            <Stack.Screen name="paywall" options={{ ...sheet, sheetAllowedDetents: [0.93] }} />
          </Stack>
          {/* Sheets present above this, so each sheet that shows a toast hosts its own. This one clears the tab bar. */}
          <Toast bottomOffset={sizes.control} />
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default wrapRoot(RootLayout);

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
