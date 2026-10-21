import { act, render, screen } from "@testing-library/react-native";

import { ConfirmHost, confirm, useConfirmStore } from "./Confirm";
import { pressAndDismiss } from "./test-support";

describe("ConfirmHost", () => {
  beforeEach(() => {
    useConfirmStore.setState({ options: undefined });
  });

  it("renders nothing visible before confirm() is called", async () => {
    await render(<ConfirmHost />);
    expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    await act(async () => {
      confirm({ title: "Delete note", confirmLabel: "Delete", onConfirm: jest.fn() });
    });
    expect(screen.getByRole("button", { name: "Delete" })).toBeOnTheScreen();
    expect(screen.getByText("Delete note")).toBeOnTheScreen();
  });

  it("runs onConfirm and not onCancel from the confirm row", async () => {
    const calls: string[] = [];
    await render(<ConfirmHost />);
    await act(async () => {
      confirm({
        title: "Delete note",
        confirmLabel: "Delete",
        onConfirm: () => calls.push("confirm"),
        onCancel: () => calls.push("cancel"),
      });
    });
    await pressAndDismiss("Delete");
    expect(calls).toEqual(["confirm"]);
    expect(useConfirmStore.getState().options).toBeUndefined();
  });

  it("runs onCancel and not onConfirm from the cancel row", async () => {
    const calls: string[] = [];
    await render(<ConfirmHost />);
    await act(async () => {
      confirm({
        title: "Delete note",
        confirmLabel: "Delete",
        onConfirm: () => calls.push("confirm"),
        onCancel: () => calls.push("cancel"),
      });
    });
    await pressAndDismiss("Cancel");
    expect(calls).toEqual(["cancel"]);
    expect(useConfirmStore.getState().options).toBeUndefined();
  });
});