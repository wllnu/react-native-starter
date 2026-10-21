import { createMMKV } from 'react-native-mmkv';
import { z } from 'zod';
import { storage } from '.';

jest.mock('react-native-mmkv', () => jest.requireActual<typeof import('@/shared/storage/test-support')>('@/shared/storage/test-support').mmkvMock);

const Schema = z.object({ name: z.string(), n: z.number() });

describe('storage', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('reads back what was set', () => {
    storage.set('a', { name: 'x', n: 1 });
    expect(storage.getJSON('a', Schema)).toEqual({ name: 'x', n: 1 });
  });

  it('returns null for a missing key', () => {
    expect(storage.getJSON('missing', Schema)).toBeNull();
  });

  it('returns null when the value does not match the schema', () => {
    storage.set('b', { name: 'x', n: 'one' });
    expect(storage.getJSON('b', Schema)).toBeNull();
  });

  it('returns null for text that is not JSON', () => {
    // a value written by something else
    createMMKV().set('c', '{oops');
    expect(storage.getJSON('c', Schema)).toBeNull();
  });

  it('applies the schema transform', () => {
    storage.set('d', { n: 2 });
    const Doubled = z.object({ n: z.number() }).transform((v) => ({ n: v.n * 2 }));
    expect(storage.getJSON('d', Doubled)).toEqual({ n: 4 });
  });

  it('removes a key', () => {
    storage.set('e', { name: 'x', n: 1 });
    storage.remove('e');
    expect(storage.getJSON('e', Schema)).toBeNull();
  });
});
