import { createMMKV } from 'react-native-mmkv';
import type { z } from 'zod';

// The only file that imports MMKV. Values are JSON text. Never put tokens or passwords here (use expo-secure-store).
const mmkv = createMMKV();

/** The stored value if it parses against `schema`, otherwise null. A bad value is left in place, not deleted. */
function getJSON<T>(key: string, schema: z.ZodType<T>): T | null {
  const raw = mmkv.getString(key);
  if (raw === undefined) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch {
    // not JSON: handled like a schema mismatch
  }
  console.warn('storage: value did not match its schema', key);
  return null;
}

function set(key: string, value: unknown): void {
  mmkv.set(key, JSON.stringify(value));
}

function remove(key: string): void {
  mmkv.remove(key);
}

export const storage = { getJSON, set, remove };
