export const colors = {
  bg: '#FAFAF8',
  card: '#FFFFFF',
  fg: '#333333',
  muted: '#888888',
  // Form-input placeholder text. Deliberately darker than `muted` so it stays
  // legible on the white input card; still lighter than `fg` typed text.
  placeholder: '#555555',
  subtle: '#DDDDDD',
  canvas: '#1A1A1A',
  yellow: '#FFAD31',
  yellowLight: '#FFF4DE',
  purple: '#6B4FFF',
  purpleLight: '#DDD6FF',
  green: '#00C896',
  red: '#EE3355',
  border: '#333333',
} as const;

export type ColorKey = keyof typeof colors;
