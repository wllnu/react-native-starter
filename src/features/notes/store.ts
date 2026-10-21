import { create } from 'zustand';
import { storage } from '@/shared/storage';
import { NoteSortSchema, type NoteSort } from './lib/note';

const SORT_KEY = 'notes.sort';

// Client state only: how the list is sorted. The notes stay in SQLite and are read through live queries.
// Read once from MMKV at import. A stored value that fails the schema falls back to the default.
const useNotesStore = create<{ sort: NoteSort }>()(() => ({
  sort: storage.getJSON(SORT_KEY, NoteSortSchema) ?? 'newest',
}));

export const useSort = (): NoteSort => useNotesStore((s) => s.sort);

export function setSort(sort: NoteSort): void {
  storage.set(SORT_KEY, sort);
  useNotesStore.setState({ sort });
}
