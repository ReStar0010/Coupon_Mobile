module.exports = function (api) {
  api.cache(true);

  const isWeb = process.env.TAMAGUI_TARGET === 'web' || process.env.EXPO_WEB === 'true';
  const isDev = process.env.NODE_ENV === 'development';

  return {
    presets: [
      // 注意：Babel 會從右到左套用 presets
      // 讓 nativewind/babel 先跑沒問題
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      [
        '@tamagui/babel-plugin',
        {
          components: ['tamagui'],
          config: './tamagui.config.ts',
          logTimings: true,
          // Web 端先不要關掉抽取（很多錯誤都是抽取被關掉造成）
          // 若要在 iOS/Android 開發期關掉，也請對 web 強制開啟
          disableExtraction: isWeb ? false : isDev,
          platform: 'web', // 這行是重點，避免去 require 到 *.native.ts / src
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};

// module.exports = function (api) {
//   api.cache(true);

//   return {
//     presets: [
//       ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
//       'nativewind/babel'
//     ],
//     plugins: [
//       [
//         '@tamagui/babel-plugin',
//         {
//           components: ['tamagui'],
//           config: './tamagui.config.ts',
//           logTimings: true,
//           disableExtraction: process.env.NODE_ENV === 'development',
//         },
//       ],
//       // NOTE: this is only necessary if you are using reanimated for animations
//       'react-native-reanimated/plugin',
//     ],
//   };
// };
