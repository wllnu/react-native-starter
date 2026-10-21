import { asc, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import { track } from '@/shared/analytics';
import { getDb } from '@/shared/db/client';
import { useRows } from '@/shared/db/live';
import { notes } from '@/shared/db/schema';
import type { NewNote, Note, NoteSort } from './lib/note';

// ---------- reads ----------
// Call these below the database gate (useDatabaseStatus() === 'ready'). `ready` is false until the first read lands.
// Live queries re-render when the table changes, so nothing here copies rows into a store.

export function useNotes(sort: NoteSort): { data: Note[]; ready: boolean } {
  const order = sort === 'newest' ? desc(notes.createdAt) : asc(notes.createdAt);
  return useRows(getDb().select().from(notes).orderBy(order), [sort]);
}

/** One note, or null once the read landed and the note does not exist. */
export function useNote(id: string): { data: Note | null; ready: boolean } {
  const { data, ready } = useRows(getDb().select().from(notes).where(eq(notes.id, id)), [id]);
  return { data: data[0] ?? null, ready };
}

// ---------- writes ----------

/** Saves a note parsed with NewNoteSchema. */
export function addNote(input: NewNote, now = Date.now()): Note {
  const note: Note = { id: randomUUID(), title: input.title, body: input.body, createdAt: now };
  getDb().insert(notes).values(note).run();
  track('note_created', { hasBody: note.body ? 'yes' : 'no' });
  return note;
}

export function deleteNote(id: string): void {
  getDb().delete(notes).where(eq(notes.id, id)).run();
}
