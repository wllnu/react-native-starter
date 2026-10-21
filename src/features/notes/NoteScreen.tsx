import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { useDatabaseStatus } from "@/shared/db/client";
import { t } from "@/shared/i18n";
import { spacing, useTheme } from "@/shared/theme";
import { Card, confirm, showToast, Text, TextButton } from "@/shared/ui";

import { deleteNote, useNote } from "./data";
import { noteDate } from "./lib/note";

export type NoteScreenProps = {
  /** Parsed by the route. */
  id: string;
};

/** One note: title, date and text, with delete last. */
export function NoteScreen({ id }: NoteScreenProps) {
  const { colors } = useTheme();
  if (useDatabaseStatus() !== "ready") return <View style={[styles.fill, { backgroundColor: colors.canvas }]} />;
  return <NoteContent id={id} />;
}

function NoteContent({ id }: NoteScreenProps) {
  const { colors } = useTheme();
  const { data: note, ready } = useNote(id);
  if (!ready) return <View style={[styles.fill, { backgroundColor: colors.canvas }]} />;
  if (!note) {
    return (
      <View style={[styles.fill, styles.body, { backgroundColor: colors.canvas }]}>
        <Text type="secondary" color="secondary">
          {t("note.missing")}
        </Text>
      </View>
    );
  }

  const remove = () =>
    confirm({
      title: t("note.deleteConfirm"),
      confirmLabel: t("note.delete"),
      destructive: true,
      onConfirm: () => {
        // Leave first, so the screen never shows the note as missing.
        router.back();
        deleteNote(note.id);
        showToast(t("note.deleted"));
      },
    });

  return (
    <ScrollView style={[styles.fill, { backgroundColor: colors.canvas }]} contentContainerStyle={styles.body}>
      <Card padded contentStyle={styles.card}>
        <Text type="heading" accessibilityRole="header">
          {note.title}
        </Text>
        <Text type="caption" color="muted">
          {noteDate(note.createdAt)}
        </Text>
        {note.body ? <Text selectable>{note.body}</Text> : null}
      </Card>
      <View style={styles.danger}>
        <TextButton label={t("note.delete")} destructive onPress={remove} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { padding: spacing[4] },
  card: { gap: spacing[2] },
  danger: { alignItems: "center", paddingTop: spacing[12] },
});
