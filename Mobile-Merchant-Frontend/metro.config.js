/** @type {import('expo/metro-config').MetroConfig} */
const path = require('path');
const { pathToFileURL } = require('url');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { withTamagui } = require('@tamagui/metro-plugin');

// On Windows, ESM loader requires file:// URLs; raw paths (e.g. C:\...) trigger "Received protocol 'c:'"
const projectRoot = __dirname;
const config = getSentryExpoConfig(projectRoot, {
  isCSSEnabled: true,
});

// Tamagui may dynamically import the config; use file URL on Windows to avoid ESM loader error
const tamaguiConfigPath = path.resolve(projectRoot, 'tamagui.config.ts');
const tamaguiConfigResolved =
  process.platform === 'win32' ? pathToFileURL(tamaguiConfigPath).href : tamaguiConfigPath;

module.exports = withTamagui(config, {
  components: ['tamagui'],
  config: tamaguiConfigResolved,
  outputCSS: './tamagui-web.css',
});
