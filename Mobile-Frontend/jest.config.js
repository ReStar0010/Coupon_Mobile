module.exports = {
  preset: 'react-native',
  testEnvironment: 'node',
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|expo|@expo|@tamagui|react-native-maps|react-native-svg|react-native-safe-area-context|expo-router|expo-constants|expo-linking|expo-location|expo-camera|expo-clipboard|expo-sharing|expo-status-bar|expo-updates|expo-dev-client|@react-navigation|react-navigation)/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    '!app/**/*.d.ts',
    '!app/**/__tests__/**',
  ],
  moduleNameMapper: {
    '^expo-router$': '<rootDir>/__mocks__/expo-router.js',
    '^@react-native-async-storage/async-storage$': '<rootDir>/__mocks__/async-storage.js',
  },
};