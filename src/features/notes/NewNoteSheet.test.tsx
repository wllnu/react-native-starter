import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import { getDb, startDatabase } from "@/shared/db/client";
import { notes } from "@/shared/db/schema";
import { t } from "@/shared/i18n";
import { useToastStore } from "@/shared/ui";

import { NewNoteSheet } from "./NewNoteSheet";

jest.mock("expo-sqlite", () => jest.requireActual<typeof import("@/shared/db/test-support")>("@/shared/db/test-support").createExpoSqliteMock());
jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));

beforeAll(async () => {
  await startDatabase();
});

beforeEach(() => {
  jest.clearAllMocks();
  // The toast hides on a timer that would outlive the test.
  jest.useFakeTimers();
  getDb().delete(notes).run();
});

afterEach(() => {
  jest.useRealTimers();
});

const savedNotes = () => getDb().select({ title: notes.title, body: notes.body }).from(notes).all();

describe("NewNoteSheet", () => {
  it("asks for a title and saves nothing when it is blank", async () => {
    await render(<NewNoteSheet />);
    await fireEvent.changeText(screen.getByLabelText(t("newNote.titleLabel")), "   ");
    await fireEvent.press(screen.getByRole("button", { name: t("newNote.add") }));

    expect(screen.getByText(t("newNote.titleError"))).toBeOnTheScreen();
    expect(savedNotes()).toEqual([]);
    expect(router.back).not.toHaveBeenCalled();
  });

  it("saves the trimmed note, confirms it and closes", async () => {
    await render(<NewNoteSheet />);
    await fireEvent.changeText(screen.getByLabelText(t("newNote.titleLabel")), "  Groceries ");
    await fireEvent.changeText(screen.getByLabelText(t("newNote.bodyLabel")), "Milk");
    await fireEvent.press(screen.getByRole("button", { name: t("newNote.add") }));

    expect(savedNotes()).toEqual([{ title: "Groceries", body: "Milk" }]);
    expect(useToastStore.getState().message).toBe(t("newNote.added"));
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
