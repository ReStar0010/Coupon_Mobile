import type { Coupon } from './coupons';
import { apiClient } from './client';
import { normalizeError } from './errors';

export interface SpinnerState {
  gems: number;
  multiplier: number;
}

export interface DrawResult {
  coupon: Coupon;
  pointsEarned: number;
}

export async function drawCoupon(gems: number): Promise<DrawResult> {
  try {
    const response = await apiClient.post<DrawResult>('/api/spinner/draw/', { gems });
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function getSpinnerState(): Promise<SpinnerState> {
  try {
    const response = await apiClient.get<SpinnerState>('/api/spinner/');
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}
