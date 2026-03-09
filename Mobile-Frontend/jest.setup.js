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

jest.mock('@/app/config/api', () => ({
  API_URL: 'https://test-api.example.com/api',
}));

require('@testing-library/jest-native/extend-expect');
