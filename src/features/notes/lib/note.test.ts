import { NewNoteSchema, TITLE_MAX, noteDate } from './note';

describe('NewNoteSchema', () => {
  it('trims the title and body', () => {
    expect(NewNoteSchema.parse({ title: '  Groceries ', body: ' Milk\n' })).toEqual({ title: 'Groceries', body: 'Milk' });
  });

  it('rejects a title that is empty after trimming', () => {
    expect(NewNoteSchema.safeParse({ title: '   ', body: '' }).success).toBe(false);
  });

  it('rejects a title over the limit', () => {
    expect(NewNoteSchema.safeParse({ title: 'a'.repeat(TITLE_MAX + 1), body: '' }).success).toBe(false);
  });
});

describe('noteDate', () => {
  it('shows day, short month and year', () => {
    expect(noteDate(new Date(2026, 9, 21, 23, 30).getTime(), 'en-GB')).toBe('21 Oct 2026');
  });
});
