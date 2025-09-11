import { defaultConfig } from '@tamagui/config/v4';
import { createTamagui } from 'tamagui';
import { tokens } from './token';

export const config = createTamagui({
  ...defaultConfig,
  tokens: {
    ...defaultConfig.tokens,
    ...tokens,
  },
});

export type MyConf = typeof config;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends MyConf {}
}
