import { router, Tabs } from "expo-router";

import { t } from "@/shared/i18n";
import { spacing, useTheme } from "@/shared/theme";
import { Icon, IconButton } from "@/shared/ui";

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.canvas },
        headerShadowVisible: false,
        headerTintColor: colors.ink,
        headerRightContainerStyle: { paddingRight: spacing[2] },
        sceneStyle: { backgroundColor: colors.canvas },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tab.notes"),
          tabBarIcon: ({ focused }) => <Icon name="note" color={focused ? "accent" : "muted"} />,
          headerRight: () => (
            <IconButton icon="plus" label={t("notes.add")} variant="plain" onPress={() => router.push("/new-note")} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tab.settings"),
          tabBarIcon: ({ focused }) => <Icon name="settings" color={focused ? "accent" : "muted"} />,
        }}
      />
    </Tabs>
  );
}
