// Reanimated and Worklets need native runtimes that Jest does not have. Their own mocks run animations to the end value at once.
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => ({
  ...require("react-native-reanimated/mock"),
  // The mock has no reduced-motion hook.
  useReducedMotion: () => false,
}));
// The keyboard controller throws on import without its native module. This is the package's own mock.
jest.mock("react-native-keyboard-controller", () => require("react-native-keyboard-controller/jest"));
// Gives useSafeAreaInsets a fixed value without a provider.
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);
// Builds that sell Pro have a RevenueCat key, and paywallEnabled checks for one.
process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = "test";
// RevenueCat needs its native module, which Jest does not have. getOfferings resolves without an offering.
jest.mock("react-native-purchases", () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    getOfferings: jest.fn().mockResolvedValue({ current: null }),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    getCustomerInfo: jest.fn(),
  },
}));
// Sentry needs its native module. Tests only check what we pass to it.
jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  wrap: (component) => component,
  captureException: jest.fn(),
  setTag: jest.fn(),
  close: jest.fn(() => Promise.resolve()),
}));
// Aptabase needs its native module. Tests only check what we pass to it.
jest.mock("@aptabase/react-native", () => ({
  __esModule: true,
  default: { init: jest.fn(), trackEvent: jest.fn(), dispose: jest.fn() },
}));
// MMKV needs its native module. The Map stand-in lets any module that reads a stored setting load.
jest.mock("react-native-mmkv", () => jest.requireActual("./src/shared/storage/test-support").mmkvMock);
// jest-expo's expo-crypto mock returns undefined from randomUUID, which SQLite would store as a NULL primary key.
jest.mock("expo-crypto", () => ({ randomUUID: () => jest.requireActual("crypto").randomUUID() }));
