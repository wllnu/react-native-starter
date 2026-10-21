import { router } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";

import { startDatabase, useDatabaseStatus } from "@/shared/db/client";
import { t } from "@/shared/i18n";
import { radius, spacing, useTheme } from "@/shared/theme";
import { ListRow, QuietButton, Text, TextButton } from "@/shared/ui";

import { useNotes } from "./data";
import { noteDate } from "./lib/note";
import { setSort, useSort } from "./store";

/** The Notes tab: every note as a list row, newest first. */
export function NotesScreen() {
  const { colors } = useTheme();
  const status = useDatabaseStatus();
  if (status === "failed") {
    return (
      <View style={[styles.centre, { backgroundColor: colors.canvas }]}>
        <Text type="secondary" color="secondary" style={styles.text}>
          {t("notes.dbFailed")}
        </Text>
        <QuietButton label={t("notes.retry")} filled onPress={() => void startDatabase()} />
      </View>
    );
  }
  if (status !== "ready") return <View style={[styles.fill, { backgroundColor: colors.canvas }]} />;
  return <NotesList />;
}

function NotesList() {
  const { colors } = useTheme();
  const sort = useSort();
  const { data: notes, ready } = useNotes(sort);
  if (!ready) return <View style={[styles.fill, { backgroundColor: colors.canvas }]} />;

  if (notes.length === 0) {
    return (
      <View style={[styles.centre, { backgroundColor: colors.canvas }]}>
        <Text type="secondary" color="secondary" style={styles.text}>
          {t("notes.empty")}
        </Text>
        <QuietButton label={t("notes.add")} icon="plus" filled onPress={() => router.push("/new-note")} />
      </View>
    );
  }

  return (
    <FlatList
      style={[styles.fill, { backgroundColor: colors.canvas }]}
      contentContainerStyle={styles.list}
      data={notes}
      keyExtractor={(note) => note.id}
      ListHeaderComponent={
        notes.length > 1 ? (
          <View style={styles.sort}>
            <TextButton
              label={t(sort === "newest" ? "notes.showOldest" : "notes.showNewest")}
              onPress={() => setSort(sort === "newest" ? "oldest" : "newest")}
            />
          </View>
        ) : null
      }
      // The rows form one card: the first and last round their outer corners.
      renderItem={({ item, index }) => (
        <View
          style={[
            styles.cell,
            { backgroundColor: colors.surface },
            index === 0 ? styles.first : null,
            index === notes.length - 1 ? styles.last : null,
          ]}
        >
          <ListRow
            title={item.title}
            value={noteDate(item.createdAt)}
            divider={index > 0}
            onPress={() => router.push({ pathname: "/note/[id]", params: { id: item.id } })}
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing[4], gap: spacing[3] },
  text: { textAlign: "center" },
  list: { padding: spacing[4] },
  sort: { alignItems: "flex-end", paddingBottom: spacing[2] },
  cell: { overflow: "hidden" },
  first: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  last: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
});
