---
id: rn-architecture
title: React Native architecture, state and data
paths: **/*.ts, **/*.tsx
when: The change adds or edits React Native app code such as features, hooks, stores, routes, screens, or data access.
---

## rn-architecture/feature-public-api
Severity: error
Rule: Import another feature only through its `index.ts`.
Violated when: a file outside `features/<name>/` imports from a path deeper than the feature folder, such as `@/features/notes/store` or `../notes/hooks/useNotes`.
Followed when: every import of another feature in the changed lines ends at the feature folder, such as `@/features/notes`.

Good:
```tsx
// src/app/(tabs)/index.tsx
import { useNotes } from "@/features/notes";
```

Bad:
```tsx
// src/app/(tabs)/index.tsx
import { useNotes } from "@/features/notes/hooks/useNotes";
```

## rn-architecture/dependency-direction
Severity: error
Rule: Keep imports pointing down from `app` to `features` to `shared`.
Violated when: a file under `shared/` imports from `features/` or `app/`, or a file under `features/` imports from `app/`.
Followed when: a file under `shared/` imports only from `shared/` or packages, and a file under `features/` imports only from `features/`, `shared/` or packages.

Good:
```ts
// src/shared/api/client.ts
import { mapError } from "@/shared/api/errors";
```

Bad:
```ts
// src/shared/api/client.ts
import { useSessionStore } from "@/features/auth";
```

## rn-architecture/no-io-in-components
Severity: error
Rule: Reach HTTP, SQL and storage from a component only through a feature hook.
Violated when: a `.tsx` file that renders JSX calls `fetch(`, runs a SQL or Drizzle query, or reads or writes MMKV, AsyncStorage or SecureStore inside the component.
Followed when: the component gets its data and actions from hooks such as `useNotes()` and contains no request, query or storage call.

Good:
```tsx
export function NoteList() {
  const { data: notes } = useNotes();
  return <NoteRows notes={notes ?? []} />;
}
```

Bad:
```tsx
export function NoteList() {
  const [notes, setNotes] = useState<Note[]>([]);
  useEffect(() => {
    db.select().from(notesTable).then(setNotes);
  }, []);
  return <NoteRows notes={notes} />;
}
```

## rn-architecture/validate-api-responses
Severity: error
Rule: Parse every API response with a Zod schema before using it.
Violated when: the result of `response.json()` or an HTTP client call is returned or used with an `as` cast or a type annotation and no `.parse(` or `.safeParse(` call.
Followed when: every response body in the changed lines passes through a Zod schema's `.parse(` or `.safeParse(` before it is returned or used.

Good:
```ts
export async function getNote(id: string) {
  const response = await apiClient.get(`/notes/${id}`);
  return NoteSchema.parse(response);
}
```

Bad:
```ts
export async function getNote(id: string) {
  const response = await apiClient.get(`/notes/${id}`);
  return response as Note;
}
```

## rn-architecture/validate-storage-reads
Severity: error
Rule: Parse every value read from device storage with a Zod schema before using it.
Violated when: a value read from MMKV, AsyncStorage or SecureStore goes through `JSON.parse(` and is used with an `as` cast or a type annotation and no `.parse(` or `.safeParse(` on a schema.
Followed when: every structured value read from storage in the changed lines passes through a Zod schema's `.parse(` or `.safeParse(`.

Good:
```ts
const raw = storage.getString("settings");
const settings = SettingsSchema.parse(JSON.parse(raw ?? "{}"));
```

Bad:
```ts
const raw = storage.getString("settings");
const settings = JSON.parse(raw ?? "{}") as Settings;
```

## rn-architecture/validate-route-params
Severity: error
Rule: Parse every incoming route param with a Zod schema before using it.
Violated when: a value from `useLocalSearchParams` or `useGlobalSearchParams` is used without passing through a Zod schema's `.parse(` or `.safeParse(`.
Followed when: the object returned by `useLocalSearchParams` or `useGlobalSearchParams` goes straight into a Zod schema's `.parse(` or `.safeParse(`.

Good:
```tsx
const { id } = NoteParamsSchema.parse(useLocalSearchParams());
const { data: note } = useNote(id);
```

Bad:
```tsx
const { id } = useLocalSearchParams<{ id: string }>();
const { data: note } = useNote(id);
```

## rn-architecture/no-server-data-in-store
Severity: error
Rule: Keep data fetched from the API in TanStack Query, not in a Zustand store.
Violated when: a Zustand `create(` store holds an API response, for example an action that awaits a request and passes the result to `set(`.
Followed when: API data in the changed lines is read with `useQuery` or written with `useMutation`, and Zustand stores hold only client state.

Good:
```ts
export function useNotes() {
  return useQuery({ queryKey: ["notes"], queryFn: getNotes });
}
```

Bad:
```ts
export const useNoteStore = create<NoteState>((set) => ({
  notes: [],
  load: async () => set({ notes: await getNotes() }),
}));
```

## rn-architecture/store-selectors
Severity: warning
Rule: Read a Zustand store through a selector.
Violated when: a Zustand store hook such as `useSettingsStore()` is called with no selector argument.
Followed when: every Zustand store hook call in the changed lines passes a selector function.

Good:
```tsx
const unit = useSettingsStore((state) => state.unit);
```

Bad:
```tsx
const { unit } = useSettingsStore();
```

## rn-architecture/live-queries
Severity: warning
Rule: Read SQLite records through a live query instead of copying them into a store.
Violated when: rows returned by a Drizzle or `expo-sqlite` query are passed to a `useState` setter or a Zustand `set(`.
Followed when: SQLite rows in the changed lines are read with `useLiveQuery(`.

Good:
```ts
export function useTags(noteId: string) {
  return useLiveQuery(db.select().from(tags).where(eq(tags.noteId, noteId)));
}
```

Bad:
```ts
export const useTagStore = create<TagState>((set) => ({
  tags: [],
  load: async (id: string) =>
    set({ tags: await db.select().from(tags).where(eq(tags.noteId, id)) }),
}));
```

## rn-architecture/no-param-mirroring
Severity: error
Rule: Never copy a route param into a store.
Violated when: a value from `useLocalSearchParams` or `useGlobalSearchParams` is written to a Zustand store.
Followed when: code that needs the param reads it from the route and no store setter receives it.

Good:
```tsx
const { id } = NoteParamsSchema.parse(useLocalSearchParams());
return <NoteSheet noteId={id} />;
```

Bad:
```tsx
const { id } = NoteParamsSchema.parse(useLocalSearchParams());
const setNoteId = useNoteStore((state) => state.setNoteId);
useEffect(() => setNoteId(id), [id]);
return <NoteSheet />;
```

## rn-architecture/layout-auth-gating
Severity: warning
Rule: Gate authenticated areas in a layout with protected routes, not with redirects inside screens.
Violated when: a screen component returns `<Redirect` or calls `router.replace(` after checking session or auth state.
Followed when: the auth check in the changed lines is a `guard` prop on `Stack.Protected` or `Tabs.Protected` inside a `_layout.tsx`.

Good:
```tsx
// src/app/_layout.tsx
<Stack>
  <Stack.Protected guard={isSignedIn}>
    <Stack.Screen name="(tabs)" />
  </Stack.Protected>
</Stack>
```

Bad:
```tsx
// src/features/progress/components/ProgressScreen.tsx
export function ProgressScreen() {
  const isSignedIn = useSessionStore((state) => state.isSignedIn);
  if (!isSignedIn) return <Redirect href="/sign-in" />;
  return <ProgressGroups />;
}
```

## rn-architecture/typed-app-errors
Severity: warning
Rule: Branch on typed app errors in UI code, not on transport codes.
Violated when: a component compares an error against an HTTP status number, `ECONNABORTED`, or an `NSURLErrorDomain` code.
Followed when: a component that branches on an error compares it only against app error types such as network, authentication, validation, permission or server.

Good:
```tsx
if (error.kind === "network") return <OfflineState onRetry={refetch} />;
```

Bad:
```tsx
if (error.code === "ECONNABORTED") return <OfflineState onRetry={refetch} />;
```
