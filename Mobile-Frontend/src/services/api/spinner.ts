import { apiClient } from './client';
import { normalizeError } from './errors';

export interface SpinnerState {
  gems: number;
  /** Lowest multiplier that can be rolled this spin (computed server-side from gems + players). */
  floor: number;
  /** ISO timestamp of the last solo spin, or null if never spun. */
  lastSpinAt: string | null;
}

export interface SpinnerDrawResult {
  /** Multiplier rolled by the server: 0..5. */
  multiplier: number;
  /** @deprecated Meltdown was removed; the server always returns null. */
  meltdownMultiplier?: number | null;
  /** Bet amount (1..5) — the reward base. */
  gemsUsed: number;
  /** Total CouPoints credited this spin (= gemsUsed × multiplier). */
  pointsEarned: number;
  /** Post-debit gem balance. */
  gems: number;
  /** Post-credit CouPoint balance. */
  couPoints: number;
  /** Wallet ledger row id for this transaction. */
  transactionId: number;
  /** Floor used for this draw. */
  floor: number;
  /** ISO timestamp of when the server rolled. */
  spunAt: string;
}

/**
 * Trigger a solo spinner draw. The server owns the RNG, debits `bet` gems,
 * credits the prize CouPoints, writes a ledger row, and returns the result
 * for the FE to animate towards.
 */
export async function drawSpinner(bet: number): Promise<SpinnerDrawResult> {
  try {
    const response = await apiClient.post<SpinnerDrawResult>('/api/spinner/draw/', { bet });
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
