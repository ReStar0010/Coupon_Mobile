import { defaultConfig } from '@tamagui/config/v4';
import { createTamagui } from 'tamagui';
import { tokens } from './app/constants/token';

export const config = createTamagui({
  ...defaultConfig,
  tokens: {
    ...defaultConfig.tokens,
    color: {
      ...defaultConfig.tokens.color,
      ...tokens.color,
    },
    space: {
      ...defaultConfig.tokens.space,
      ...tokens.space,
    },
    size: {
      ...defaultConfig.tokens.size,
      ...tokens.size,
    },
    radius: {
      ...defaultConfig.tokens.radius,
      ...tokens.radius,
    },
    zIndex: {
      ...defaultConfig.tokens.zIndex,
      ...tokens.zIndex,
    },
  },
  fonts: {
    ...defaultConfig.fonts,
    body: {
      ...defaultConfig.fonts.body,
      size: {
        ...defaultConfig.fonts.body.size,
        xs: 12,
        sm: 14,
        md: 16,
        lg: 20,
        xl: 24,
        heading: 30,
        true: 16,
      },
    },
  },
});

export type MyConf = typeof config;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends MyConf {}
}
