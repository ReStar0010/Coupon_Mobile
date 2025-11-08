/**
 * Color constants matching Figma design tokens
 */
export const colors = {
  // Primary colors
  primary: '#FFAD31', // act-yellow
  secondary: '#333333', // sec-black
  
  // Background colors
  background: '#F8F8F8', // color2
  white: '#FFFFFF',
  
  // Border colors
  border: '#C7C7C7', // color8
  
  // Text colors
  textPrimary: '#333333', // sec-black
  textSecondary: '#8F8F8F', // color9
  
  // Semantic colors
  error: '#EF4444',
  success: '#4ADE80',
} as const;

export type ColorKey = keyof typeof colors;

