// Test only. Stands in for expo-sqlite with better-sqlite3 (in memory), so the real Drizzle Expo driver, migrator and
// write functions run in Jest. Use it as: jest.mock('expo-sqlite', () => jest.requireActual<typeof import('@/shared/db/test-support')>('@/shared/db/test-support').createExpoSqliteMock())
import Database from 'better-sqlite3';

type Params = unknown[];

export function createExpoSqliteMock() {
  return {
    openDatabaseAsync: async () => {
      const raw = new Database(':memory:');
      return {
        execAsync: async (sql: string) => {
          raw.exec(sql);
        },
        prepareSync: (sql: string) => {
          const stmt = raw.prepare(sql);
          return {
            executeSync: (params: Params) => {
              if (stmt.reader) {
                const rows = stmt.raw(false).all(...params);
                return { getAllSync: () => rows, getFirstSync: () => rows[0] ?? null, changes: 0, lastInsertRowId: 0 };
              }
              const info = stmt.run(...params);
              return { getAllSync: () => [], getFirstSync: () => null, changes: info.changes, lastInsertRowId: Number(info.lastInsertRowid) };
            },
            executeForRawResultSync: (params: Params) => {
              const rows = stmt.raw(true).all(...params);
              return { getAllSync: () => rows, getFirstSync: () => rows[0] ?? null };
            },
          };
        },
      };
    },
    addDatabaseChangeListener: () => ({ remove: () => undefined }),
  };
}
