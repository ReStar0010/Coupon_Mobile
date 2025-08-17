import { defaultConfig } from '@tamagui/config/v4';
import { createTamagui, createTokens } from 'tamagui';
import { tokens } from './token';

export const tamaguiConfig = createTamagui(defaultConfig);

export type MyConf = typeof tamaguiConfig;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends MyConf {}
}