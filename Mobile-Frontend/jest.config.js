/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testTimeout: 15000,
  maxWorkers: '50%',
  workerIdleMemoryLimit: '512MB',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.(test|spec).(ts|tsx|js)', '**/?(*.)+(test|spec).(ts|tsx|js)'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/app/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-shadow-2)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/__tests__/**',
    '!**/node_modules/**',
    '!src/theme/index.ts',
    '!src/state/index.ts',
    '!src/theme/FontProvider.tsx',
    '!src/theme/shadows.tsx',
  ],
  coverageThreshold: {
    global: {
      lines: 80,
      branches: 80,
    },
  },
  testEnvironment: 'node',
};
