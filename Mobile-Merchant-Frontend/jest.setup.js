// Stable API base URL for tests (api.ts reads EXPO_PUBLIC_* at load time)
process.env.EXPO_PUBLIC_BACKEND_MODE = 'production';
process.env.EXPO_PUBLIC_API_URL = 'https://test-api.example.com';
process.env.NODE_ENV = 'test';

const mockAsyncStorage = {
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  clear: jest.fn(() => Promise.resolve()),
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockAsyncStorage,
}));

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

require('@testing-library/jest-native/extend-expect');
