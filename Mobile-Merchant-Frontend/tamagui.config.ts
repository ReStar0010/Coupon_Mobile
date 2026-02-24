import { defaultConfig } from '@tamagui/config/v4';
import { createTamagui } from 'tamagui';
import { tokens } from './constants/tokens';

const baseTokens = defaultConfig.tokens as any;

export const config = createTamagui({
  ...defaultConfig,
  settings: {
    ...defaultConfig.settings,
    onlyAllowShorthands: false,
  },
  tokens: {
    ...baseTokens,
    color: {
      ...baseTokens.color,
      ...tokens.color,
    },
    space: {
      ...baseTokens.space,
      ...tokens.space,
    },
    size: {
      ...baseTokens.size,
      ...tokens.size,
    },
    radius: {
      ...baseTokens.radius,
      ...tokens.radius,
    },
    zIndex: {
      ...baseTokens.zIndex,
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
