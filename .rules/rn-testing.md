---
id: rn-testing
title: React Native tests
paths: **/*.test.ts, **/*.test.tsx
when: The change adds or edits Jest or React Native Testing Library tests.
---

## rn-testing/await-rntl
Severity: error
Rule: Await `render`, `fireEvent`, `renderHook` and `act` from React Native Testing Library.
Violated when: a call to `render(`, `fireEvent(`, `fireEvent.press(` or another `fireEvent.` method, `renderHook(` or `act(` has no `await` in front of it.
Followed when: every `render(`, `fireEvent`, `renderHook(` and `act(` call in the changed lines is awaited.

Good:
```tsx
await render(<NoteRow note={note} />);
await fireEvent.press(screen.getByRole("button", { name: "Delete note" }));
```

Bad:
```tsx
render(<NoteRow note={note} />);
fireEvent.press(screen.getByRole("button", { name: "Delete note" }));
```

## rn-testing/query-by-role
Severity: warning
Rule: Query elements by role and accessible name, and use `testID` only where no accessible name fits.
Violated when: a `ByTestId` query finds a button, link, text input or visible text.
Followed when: queries in the changed lines use `ByRole`, `ByLabelText` or `ByText` for elements that have a role or text.

Good:
```tsx
const add = screen.getByRole("button", { name: "Add note" });
```

Bad:
```tsx
const add = screen.getByTestId("add-note-button");
```

## rn-testing/mock-network-boundary
Severity: warning
Rule: Mock at the network boundary with MSW, not inside the app's own modules.
Violated when: `jest.mock(` targets a module of the app, such as `@/features/...`, `@/shared/...` or a relative path.
Followed when: fake server behaviour in the changed lines is an MSW handler such as `http.get(` passed to `server.use(` or `setupServer(`.

Good:
```tsx
server.use(http.get("*/notes", () => HttpResponse.json([note])));
```

Bad:
```tsx
jest.mock("@/features/notes/api", () => ({ getNotes: async () => [note] }));
```

## rn-testing/no-react-test-renderer
Severity: error
Rule: Do not import the deprecated `react-test-renderer`.
Violated when: an import path is `react-test-renderer`.
Followed when: components in the changed lines are rendered with `render` from `@testing-library/react-native`.

Good:
```tsx
import { render } from "@testing-library/react-native";
```

Bad:
```tsx
import renderer from "react-test-renderer";
```
