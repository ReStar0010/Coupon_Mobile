import { createTokens } from 'tamagui';

export const tokens = createTokens({
  color: {
    // Primary colors from Figma design
    primary: '#FFAD31', // act-yellow
    secondary: '#333333', // sec-black
    background: '#F8F8F8', // color2
    border: '#C7C7C7', // color8
    textSecondary: '#8F8F8F', // color9
    textPrimary: '#333333', // sec-black
    white: '#FFFFFF',
  },
  space: {
    // Spacing tokens
    0: 0,
    1: 4,
    2: 8,
    3: 13,
    '3-5': 16,
    4: 18,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    true: 16, // Default spacing value
  },
  size: {
    // Size tokens
    0: 0,
    1: 4,
    2: 8,
    3: 13,
    4: 18,
    5: 20,
    inputHeight: 44,
    buttonHeight: 44,
    true: 44, // Default size value (matches input/button height)
  },
  zIndex: {
    // Z-index tokens (keys must exist in size tokens)
    0: 0,
    1: 100,
    2: 200,
    3: 300,
    4: 400,
    5: 500,
  },
  radius: {
    // Border radius tokens
    0: 0,
    1: 4,
    2: 6,
    3: 8,
    4: 9, // Main border radius from design
    5: 12,
    true: 9, // Default border radius
  },
});

