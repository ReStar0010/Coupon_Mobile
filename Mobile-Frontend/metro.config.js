// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });

// const path = require('path');
// const { getDefaultConfig } = require('expo/metro-config');
// const { withNativeWind } = require('nativewind/metro');
// const { withTamagui } = require('@tamagui/metro-plugin');
// const { resolve } = require('metro-resolver');

// let config = getDefaultConfig(__dirname, { isCSSEnabled: true });

// config = withNativeWind(config, { input: './global.css' });
// config = withTamagui(config, {
//   components: ['tamagui'],
//   config: './tamagui.config.ts',
//   outputCSS: './tamagui-web.css',
//   platform: 'web',
// });

// // 你的 web 版地圖（先做其中一個：1 用套件；2 用 stub）
// const webMapsEntry = require.resolve('react-native-web-maps'); 
// // 如果你選擇 stub，改成：
// // const webMapsEntry = path.resolve(__dirname, 'app/shims/react-native-maps.web.tsx');

// // 保留你原本的 alias（Tamagui 轉 dist）
// config.resolver = config.resolver || {};
// config.resolver.alias = {
//   ...(config.resolver.alias || {}),
//   '@tamagui/core': '@tamagui/core/dist/cjs',
//   '@tamagui/web': '@tamagui/web/dist/cjs',
//   '@tamagui/helpers': '@tamagui/helpers/dist/cjs',
// };

// // ★ 關鍵：攔截任何以 react-native-maps 開頭的路徑（含子路徑）
// const prevResolveRequest = config.resolver.resolveRequest;
// config.resolver.resolveRequest = (context, moduleName, platform) => {
//   if (platform === 'web' && /^react-native-maps(\/.*)?$/.test(moduleName)) {
//     return resolve(context, webMapsEntry, platform);
//   }
//   return prevResolveRequest
//     ? prevResolveRequest(context, moduleName, platform)
//     : resolve(context, moduleName, platform);
// };

// module.exports = config;

// const { getDefaultConfig } = require('expo/metro-config');
// const { withNativeWind } = require('nativewind/metro');
// const { withTamagui } = require('@tamagui/metro-plugin');

// /** @type {import('expo/metro-config').MetroConfig} */
// const config = getDefaultConfig(__dirname, {
//   // [Web-only]: Enables CSS support in Metro.
//   isCSSEnabled: true,
// });

// // First apply NativeWind configuration
// const nativeWindConfig = withNativeWind(config, { input: './global.css' });

// // Then apply Tamagui configuration on top of NativeWind
// module.exports = withTamagui(nativeWindConfig, {
//   components: ['tamagui'],
//   config: './tamagui.config.ts',
//   outputCSS: './tamagui-web.css',
// });