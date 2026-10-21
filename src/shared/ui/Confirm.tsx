import { create } from "zustand";

import { ActionSheet } from "./ActionSheet";

export type ConfirmOptions = {
  title: string;
  body?: string;
  /** Label of the confirming row. */
  confirmLabel: string;
  /** Draws the confirming row as destructive. */
  destructive?: boolean;
  /** Label of the ink cancel row. Defaults to t("ui.cancel"). */
  cancelLabel?: string;
  onConfirm: () => void;
  /** Runs when the sheet is dismissed without confirming. */
  onCancel?: () => void;
};

type ConfirmState = {
  options: ConfirmOptions | undefined;
  /** Set when the confirming row ran, so the sheet close that immediately precedes it skips onCancel. */
  confirmed: boolean;
  show: (options: ConfirmOptions) => void;
  close: () => void;
  confirm: () => void;
};

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  options: undefined,
  confirmed: false,
  show: (options) => set({ options, confirmed: false }),
  close: () => {
    // ActionSheet runs this close right before a row press in the same tick, so the microtask is the
    // earliest moment a confirm could have been marked. The scrim and cancel row get clear + onCancel;
    // a confirming press has already set the flag and emptied the store by then, and must not cancel.
    const closing = get().options;
    queueMicrotask(() => {
      if (!get().confirmed && get().options === closing) {
        set({ options: undefined });
        closing?.onCancel?.();
      }
    });
  },
  confirm: () => {
    const { options } = get();
    set({ options: undefined, confirmed: true });
    options?.onConfirm();
  },
}));

/** Asks the user to confirm inside an action sheet. Mount ConfirmHost in the focused screen to render it. */
export function confirm(options: ConfirmOptions) {
  useConfirmStore.getState().show(options);
}

/**
 * The action sheet behind confirm(). Holds no state of its own, so nothing renders until confirm() sets options.
 * Confirming clears the options and calls onConfirm only; the sheet's own close handles cancel and scrim dismissals.
 */
export function ConfirmHost() {
  const options = useConfirmStore((state) => state.options);
  const close = useConfirmStore((state) => state.close);
  const confirmAction = useConfirmStore((state) => state.confirm);

  if (!options) {
    return null;
  }

  return (
    <ActionSheet
      visible
      onClose={close}
      message={options.body === undefined ? { body: options.title } : { title: options.title, body: options.body }}
      actions={[{ label: options.confirmLabel, destructive: options.destructive, onPress: confirmAction }]}
      cancelLabel={options.cancelLabel}
    />
  );
}