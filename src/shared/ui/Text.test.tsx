import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { colors } from "@/shared/theme";

import { Text, typeStyle } from "./Text";

describe("typeStyle", () => {
  it("keeps roles in sentence case, except the kicker", () => {
    expect(typeStyle("body")).toMatchObject({ textTransform: "none", fontWeight: "400" });
    expect(typeStyle("body").fontFamily).toBeUndefined();
    expect(typeStyle("kicker")).toMatchObject({ textTransform: "uppercase", fontWeight: "700" });
  });

  it("uses tabular figures everywhere", () => {
    expect(typeStyle("title").fontVariant).toEqual(["tabular-nums"]);
    expect(typeStyle("secondary").fontVariant).toEqual(["tabular-nums"]);
  });
});

describe("Text", () => {
  it("caps Dynamic Type per role and applies the colour token", async () => {
    await render(
      <Text type="title" color="muted">
        3
      </Text>,
    );
    const node = screen.getByText("3");
    expect(node.props.maxFontSizeMultiplier).toBeLessThan(2);
    const style = StyleSheet.flatten(node.props.style) as { color?: string };
    expect(style.color).toBe(colors.muted);
  });
});
