import { fireEvent, render, screen } from "@testing-library/react-native";

import { Text } from "./Text";
import { Disclosure } from "./Disclosure";

describe("Disclosure", () => {
  it("hides its body until the header is pressed", async () => {
    await render(
      <Disclosure title="Details">
        <Text>Shown when the header is pressed.</Text>
      </Disclosure>,
    );
    expect(screen.queryByText("Shown when the header is pressed.")).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByText("Shown when the header is pressed.")).toBeOnTheScreen();
  });

  it("closes again on a second press and reports its state", async () => {
    await render(
      <Disclosure title="Details">
        <Text>Body</Text>
      </Disclosure>,
    );
    const header = screen.getByRole("button", { name: "Details" });
    expect(header).toBeCollapsed();
    await fireEvent.press(header);
    expect(header).toBeExpanded();
    await fireEvent.press(header);
    expect(screen.queryByText("Body")).not.toBeOnTheScreen();
  });

  it("starts open when asked and reads the summary in its name", async () => {
    await render(
      <Disclosure defaultOpen title="Details" summary="3 items">
        <Text>Body</Text>
      </Disclosure>,
    );
    expect(screen.getByText("Body")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Details, 3 items" })).toBeExpanded();
  });
});
