import { act, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import { Toast, showToast, useToastStore } from "./Toast";

describe("toast store", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useToastStore.setState({ message: "", check: false, visible: false, id: 0 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows a message and hides it after a moment", async () => {
    showToast("Note saved · 52 min", { check: true });
    expect(useToastStore.getState()).toMatchObject({ message: "Note saved · 52 min", check: true, visible: true, id: 1 });
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(useToastStore.getState().visible).toBe(false);
  });

  it("restarts the timer when a second toast replaces the first", async () => {
    showToast("One");
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    showToast("Two");
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(useToastStore.getState()).toMatchObject({ message: "Two", visible: true, id: 2 });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(useToastStore.getState().visible).toBe(false);
  });

  it("bumps the id when the same message is shown twice", () => {
    showToast("Note added");
    showToast("Note added");
    expect(useToastStore.getState().id).toBe(2);
  });

  it("hides on request", () => {
    showToast("Note added");
    useToastStore.getState().hide();
    expect(useToastStore.getState().visible).toBe(false);
  });
});

describe("Toast", () => {
  beforeEach(() => {
    useToastStore.setState({ message: "", check: false, visible: false, id: 0 });
  });

  it("announces each message to screen readers, and says nothing before the first", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
    await render(<Toast />);
    expect(announce).not.toHaveBeenCalled();
    await act(async () => {
      showToast("Note added");
    });
    expect(announce).toHaveBeenCalledWith("Note added");
    expect(screen.getByText("Note added")).toBeOnTheScreen();
    await act(async () => {
      showToast("Note added");
    });
    expect(announce).toHaveBeenCalledTimes(2);
    await act(async () => {
      useToastStore.getState().hide();
    });
    announce.mockRestore();
  });
});
