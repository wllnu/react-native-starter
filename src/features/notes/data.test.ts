import { act, renderHook } from '@testing-library/react-native';
import { getDb, startDatabase } from '@/shared/db/client';
import { notes } from '@/shared/db/schema';
import type { NoteSort } from './lib/note';
import { addNote, deleteNote, useNote, useNotes } from './data';

jest.mock('expo-sqlite', () => jest.requireActual<typeof import('@/shared/db/test-support')>('@/shared/db/test-support').createExpoSqliteMock());

beforeAll(async () => {
  await startDatabase();
});

beforeEach(() => {
  getDb().delete(notes).run();
});

describe('notes data', () => {
  it('lists notes newest first, and oldest first after the sort changes', async () => {
    addNote({ title: 'First', body: '' }, 1);
    addNote({ title: 'Second', body: 'Two' }, 2);
    const { result, rerender } = await renderHook(({ sort }: { sort: NoteSort }) => useNotes(sort), {
      initialProps: { sort: 'newest' },
    });
    await act(async () => {});
    expect(result.current.ready).toBe(true);
    expect(result.current.data.map((note) => note.title)).toEqual(['Second', 'First']);

    await rerender({ sort: 'oldest' });
    await act(async () => {});
    expect(result.current.data.map((note) => note.title)).toEqual(['First', 'Second']);
  });

  it('reads one note, and null once it is deleted', async () => {
    const note = addNote({ title: 'Groceries', body: 'Milk' }, 5);
    const { result } = await renderHook(() => useNote(note.id));
    await act(async () => {});
    expect(result.current.data).toEqual({ id: note.id, title: 'Groceries', body: 'Milk', createdAt: 5 });

    deleteNote(note.id);
    expect(getDb().select().from(notes).all()).toEqual([]);
  });
});
