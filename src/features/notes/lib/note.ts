import { z } from 'zod';

export const TITLE_MAX = 80;
export const BODY_MAX = 2000;

/** What the create form saves. Parse the form's text with it, never trust it raw. */
export const NewNoteSchema = z.object({
  title: z.string().trim().min(1).max(TITLE_MAX),
  body: z.string().trim().max(BODY_MAX),
});
export type NewNote = z.infer<typeof NewNoteSchema>;

export type Note = NewNote & {
  id: string;
  /** Milliseconds since the epoch. */
  createdAt: number;
};

export const NoteSortSchema = z.enum(['newest', 'oldest']);
export type NoteSort = z.infer<typeof NoteSortSchema>;

/** "21 Oct 2026" in the device's locale. */
export function noteDate(createdAt: number, locale?: string): string {
  return new Date(createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}
