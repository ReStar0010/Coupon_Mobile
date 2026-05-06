export interface Multiplier {
  v: number;
  color: string;
  label: string;
}

export const MULTS: Multiplier[] = [
  { v: 0, color: '#2E2E2E', label: 'x0' },
  { v: 1, color: '#555555', label: 'x1' },
  { v: 2, color: '#888888', label: 'x2' },
  { v: 3, color: '#FFAD31', label: 'x3' },
  { v: 4, color: '#CC8800', label: 'x4' },
  { v: 5, color: '#6B4FFF', label: 'x5' },
];

export function getFloor(gems: number, players: number): number {
  if (players >= 3) return 3;
  if (players >= 2) return 2;
  if (gems >= 3) return 1;
  return 0;
}

export interface ChargeState {
  glow: boolean;
  lightning: number;
  particles: number;
  vignette: number;
  vibrate: boolean;
  intensity: number;
}

export function getCharge(gems: number): ChargeState {
  if (gems <= 1) {
    return { glow: true, lightning: 0, particles: 0, vignette: 0, vibrate: false, intensity: 0.18 };
  }
  if (gems === 2) {
    return { glow: true, lightning: 0, particles: 0, vignette: 0.2, vibrate: false, intensity: 0.40 };
  }
  if (gems === 3) {
    return { glow: true, lightning: 4, particles: 6, vignette: 0.45, vibrate: false, intensity: 0.62 };
  }
  if (gems === 4) {
    return { glow: true, lightning: 6, particles: 12, vignette: 0.65, vibrate: true, intensity: 0.82 };
  }
  return { glow: true, lightning: 9, particles: 22, vignette: 0.85, vibrate: true, intensity: 1.0 };
}
