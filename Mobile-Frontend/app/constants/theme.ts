export const COLORS = {
  primary: '#FFAD31',
  primaryDark: '#E69A2E',
  secondary: '#333333',
  background: '#f5f5f5',
  backgroundLight: '#f0f0f0',
  white: '#FFFFFF',
  text: {
    primary: '#000000',
    secondary: '#6b7280',
    light: '#9ca3af',
    error: '#ef4444',
  },
  border: '#e0e0e0',
  shadow: '#000000',
  tag: {
    background: '#FFF5E6',
    text: '#FFAD31',
  },
} as const;

export const SHADOWS = {
  small: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
  },
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
} as const;
