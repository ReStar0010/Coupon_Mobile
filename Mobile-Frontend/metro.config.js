/** @type {import('expo/metro-config').MetroConfig} */
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const projectRoot = __dirname;
const config = getSentryExpoConfig(projectRoot);

module.exports = config;
