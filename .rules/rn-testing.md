---
id: rn-testing
title: React Native tests
paths: **/*.test.ts, **/*.test.tsx
when: The change adds or edits Jest or React Native Testing Library tests.
---

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


