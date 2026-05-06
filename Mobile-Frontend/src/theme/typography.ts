export const fontFamilies = {
  regular: 'SpaceGrotesk_400Regular',
  medium: 'SpaceGrotesk_500Medium',
  semiBold: 'SpaceGrotesk_600SemiBold',
  bold: 'SpaceGrotesk_700Bold',
  extraBold: 'SpaceGrotesk_800ExtraBold',
  monoRegular: 'JetBrainsMono_400Regular',
  monoSemiBold: 'JetBrainsMono_600SemiBold',
} as const;

export const fontWeights = {
  400: fontFamilies.regular,
  500: fontFamilies.medium,
  600: fontFamilies.semiBold,
  700: fontFamilies.bold,
  800: fontFamilies.extraBold,
} as const;

export const fontSizes = {
  display: 58,
  h1: 32,
  h2: 22,
  h3: 18,
  body: 15,
  caption: 12,
  monoLg: 18,
  monoSm: 13,
} as const;

export type FontSizeKey = keyof typeof fontSizes;
export type FontFamilyKey = keyof typeof fontFamilies;
