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
    rules: {
      'react/display-name': 'off',
    },
  },
];
