const globals = require('globals');

let expoConfig = [];
try {
  const expo = require('eslint-config-expo/flat');
  expoConfig = Array.isArray(expo) ? expo : [expo];
} catch {
  // eslint-config-expo not installed — run: npm install eslint-config-expo --save-dev
}

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/*', '.tamagui/**', 'node_modules/**'],
  },
  {
    files: ['**/__tests__/**', '**/*.test.{js,jsx,ts,tsx}', '**/*.spec.{js,jsx,ts,tsx}', 'jest.setup.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
  {
    rules: {
      'react/display-name': 'off',
      'import/no-unresolved': [2, { ignore: ['../tamagui-web.css'] }],
    },
  },
];
