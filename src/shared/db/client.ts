import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { openDatabaseAsync } from 'expo-sqlite';
import { create } from 'zustand';
import migrations from '../../../drizzle/migrations';
import { reportError } from '../monitoring';

export type Db = ExpoSQLiteDatabase;

const DB_NAME = 'app.db';

export type DatabaseStatus = 'starting' | 'ready' | 'failed';
const useStatusStore = create<{ status: DatabaseStatus }>(() => ({ status: 'starting' }));
/** Gate the screens that read data on `'ready'`. The data hooks throw before that. */
export const useDatabaseStatus = (): DatabaseStatus => useStatusStore((s) => s.status);

let db: Db | null = null;
let starting: Promise<void> | null = null;

async function open(): Promise<void> {
  // The async open and migrate keep the first frame free. enableChangeListener feeds useLiveQuery.
  const client = await openDatabaseAsync(DB_NAME, { enableChangeListener: true });
  // SQLite leaves foreign keys off per connection. Cascades need them on.
  await client.execAsync('PRAGMA foreign_keys = ON');
  const opened = drizzle(client);
  await migrate(opened, migrations);
  db = opened;
  useStatusStore.setState({ status: 'ready' });
}

/** Opens and migrates the database. Call it once the first frame is up (an effect in the root layout). Safe to call again: a failed start retries. */
export function startDatabase(): Promise<void> {
  if (!starting) {
    useStatusStore.setState({ status: 'starting' });
    starting = open().catch((error: unknown) => {
      starting = null;
      useStatusStore.setState({ status: 'failed' });
      console.error('database failed to start', error);
      reportError(error, 'db.start');
    });
  }
  return starting;
}

/** The open database. Only valid once the status is 'ready'. */
export function getDb(): Db {
  if (!db) throw new Error('The database is not ready');
  return db;
}
