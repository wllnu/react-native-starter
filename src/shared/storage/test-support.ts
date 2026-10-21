// Test only. react-native-mmkv needs its native module, so Jest swaps in a Map:
// jest.mock('react-native-mmkv', () => jest.requireActual<typeof import('@/shared/storage/test-support')>('@/shared/storage/test-support').mmkvMock)
const values = new Map<string, string>();

export const mmkvMock = {
  createMMKV: () => ({
    getString: (key: string) => values.get(key),
    set: (key: string, value: string) => {
      values.set(key, value);
    },
    remove: (key: string) => values.delete(key),
  }),
};
