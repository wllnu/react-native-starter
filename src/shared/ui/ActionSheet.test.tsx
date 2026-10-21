import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { ActionSheet } from "./ActionSheet";
import { pressAndDismiss } from "./test-support";

describe("ActionSheet", () => {
  it("renders nothing while hidden", async () => {
    await render(<ActionSheet visible={false} onClose={jest.fn()} actions={[{ label: "Discard", onPress: jest.fn() }]} />);
    expect(screen.queryByText("Discard")).not.toBeOnTheScreen();
  });

  it("shows the message, the actions and a cancel row", async () => {
    await render(
      <ActionSheet
        visible
        onClose={jest.fn()}
        cancelLabel="Keep going"
        message={{ title: "Unfinished note", body: "You left this note 3 hours ago." }}
        actions={[{ label: "Discard", onPress: jest.fn() }]}
      />,
    );
    expect(screen.getByText("Unfinished note")).toBeOnTheScreen();
    expect(screen.getByText("You left this note 3 hours ago.")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Discard" })).toBeOnTheScreen();
    // The scrim is hidden from screen readers while the sheet is modal, so the cancel row is the only "Keep going" button.
    expect(screen.getByRole("button", { name: "Keep going" })).toBeOnTheScreen();
  });

  it("hides first and closes and runs the pressed action only once the Modal is gone", async () => {
    const calls: string[] = [];
    await render(
      <ActionSheet
        visible
        onClose={() => calls.push("close")}
        actions={[{ label: "Discard", onPress: () => calls.push("discard") }]}
      />,
    );
    // The mocked Modal is the first host element; it unmounts once hidden, so keep its handler.
    const { onDismiss } = screen.root!.props;
    await fireEvent.press(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByText("Discard")).not.toBeOnTheScreen();
    expect(calls).toEqual([]);
    await act(async () => onDismiss());
    expect(calls).toEqual(["close", "discard"]);
  });

  it("ignores a dismiss it did not start", async () => {
    const onClose = jest.fn();
    await render(<ActionSheet visible onClose={onClose} />);
    await act(async () => screen.root!.props.onDismiss());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not run a disabled action", async () => {
    const onPress = jest.fn();
    await render(<ActionSheet visible onClose={jest.fn()} actions={[{ label: "Discard", onPress, disabled: true }]} />);
    await fireEvent.press(screen.getByRole("button", { name: "Discard" }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("marks a selected action and shows its check", async () => {
    await render(
      <ActionSheet
        visible
        onClose={jest.fn()}
        actions={[
          { label: "Kilograms", onPress: jest.fn(), selected: true },
          { label: "Pounds", onPress: jest.fn() },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "Kilograms" })).toBeSelected();
    expect(screen.getByRole("button", { name: "Pounds" })).not.toBeSelected();
  });

  it("underlines a destructive action", async () => {
    await render(
      <ActionSheet visible onClose={jest.fn()} actions={[{ label: "Discard", onPress: jest.fn(), destructive: true }]} />,
    );
    expect(screen.getByText("Discard")).toHaveStyle({ textDecorationLine: "underline" });
  });

  it("falls back to a Cancel row that closes the sheet", async () => {
    const onClose = jest.fn();
    await render(<ActionSheet visible onClose={onClose} />);
    await pressAndDismiss("Cancel");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
