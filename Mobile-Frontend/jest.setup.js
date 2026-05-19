const mockSecureStore = {
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
};

const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  clear: jest.fn(),
};

jest.mock('expo-secure-store', () => ({
  getItemAsync: mockSecureStore.getItemAsync,
  setItemAsync: mockSecureStore.setItemAsync,
  deleteItemAsync: mockSecureStore.deleteItemAsync,
}));

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  withScope: jest.fn((fn) => fn && fn({ setTag: jest.fn(), setExtra: jest.fn() })),
}));

jest.mock('@react-native-firebase/perf', () => ({
  __esModule: true,
  default: () => ({
    newHttpMetric: () => ({
      start: () => Promise.resolve(),
      stop: () => Promise.resolve(),
      setHttpResponseCode: () => {},
      setResponseContentType: () => {},
    }),
  }),
}));

// Official mock from react-native-safe-area-context — supplies a zero-inset
// SafeAreaProvider/useSafeAreaInsets so screens using insets render in tests.
// The shipped mock puts everything on `default`; we expose it as named exports
// so imports like `{ useSafeAreaInsets }` resolve correctly.
jest.mock('react-native-safe-area-context', () => {
  const mock = require('react-native-safe-area-context/jest/mock');
  return mock.default || mock;
});

require('@testing-library/jest-native/extend-expect');
