import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

/**
 * A live query with an explicit loading flag. useLiveQuery returns [] until the first read lands,
 * so `ready` is what tells an empty table from a table not read yet. A failed query throws to the route's error boundary.
 * Pass every value the query is built from in `deps`, or it keeps running the first query.
 */
export function useRows<T extends Parameters<typeof useLiveQuery>[0]>(query: T, deps: unknown[] = []) {
  const { data, error, updatedAt } = useLiveQuery(query, deps);
  if (error) throw error;
  return { data, ready: updatedAt !== undefined };
}
