import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// One table per entity. After a change here, run `pnpm db:generate` and add the matching case to migrations.test.ts.
export const notes = sqliteTable(
  'notes',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    /** Milliseconds since the epoch. */
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('notes_created_idx').on(t.createdAt)],
);
