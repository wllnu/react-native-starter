import { act, fireEvent, screen } from "@testing-library/react-native";

/**
 * Presses an ActionSheet row, then finishes the native dismiss iOS reports through the Modal's onDismiss.
 * The mocked Modal is the first host element and unmounts once hidden, so its handler is read before the press.
 */
export async function pressAndDismiss(name: string) {
  const onDismiss = (screen.root!.props as { onDismiss: () => void }).onDismiss;
  await fireEvent.press(screen.getByRole("button", { name }));
  await act(async () => onDismiss());
}
