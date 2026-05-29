module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated plugin must be listed LAST
      'react-native-reanimated/plugin',
    ],
  };
};
