import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { useDatabaseStatus } from "@/shared/db/client";
import { t } from "@/shared/i18n";
import { spacing, useTheme } from "@/shared/theme";
import { Card, Field, KeyboardBar, PrimaryButton, SheetFoot, SheetHead, showToast } from "@/shared/ui";
import { KEYBOARD_TOOLBAR_HEIGHT } from "@/shared/ui/KeyboardBar";

import { addNote } from "./data";
import { BODY_MAX, NewNoteSchema, TITLE_MAX } from "./lib/note";

/** The "New note" form sheet. Closes itself; the root shows the toast. */
export function NewNoteSheet() {
  const { colors } = useTheme();
  if (useDatabaseStatus() !== "ready") return <View style={[styles.fill, { backgroundColor: colors.canvas }]} />;
  return <NewNoteForm />;
}

function NewNoteForm() {
  const { colors } = useTheme();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [titleError, setTitleError] = useState(false);

  const submit = () => {
    const parsed = NewNoteSchema.safeParse({ title, body });
    if (!parsed.success) {
      // maxLength on the fields keeps both under their limits, so only an empty title gets here.
      setTitleError(true);
      return;
    }
    addNote(parsed.data);
    showToast(t("newNote.added"), { check: true });
    router.back();
  };

  return (
    <View style={[styles.fill, { backgroundColor: colors.canvas }]}>
      <SheetHead title={t("newNote.title")} onClose={() => router.back()} />
      <KeyboardAvoidingView behavior="padding" style={styles.fill} keyboardVerticalOffset={KEYBOARD_TOOLBAR_HEIGHT}>
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <Card padded contentStyle={styles.form}>
            <Field
              label={t("newNote.titleLabel")}
              placeholder={t("newNote.titlePlaceholder")}
              autoCapitalize="sentences"
              maxLength={TITLE_MAX}
              onChangeText={(value) => {
                setTitle(value);
                setTitleError(false);
              }}
              {...(titleError ? { error: t("newNote.titleError") } : {})}
            />
            <Field label={t("newNote.bodyLabel")} multiline maxLength={BODY_MAX} onChangeText={setBody} />
          </Card>
        </ScrollView>
        <SheetFoot>
          <PrimaryButton label={t("newNote.add")} onPress={submit} />
        </SheetFoot>
      </KeyboardAvoidingView>
      <KeyboardBar />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingHorizontal: spacing[4], paddingBottom: spacing[6] },
  form: { gap: spacing[4] },
});
