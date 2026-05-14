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
  /** Base multiplier rolled by the server: 0..5. */
  multiplier: number;
  /** Bonus multiplier set only when `multiplier === 5`. */
  meltdownMultiplier: number | null;
  /** Pre-debit gem count used as the reward base. */
  gemsUsed: number;
  /** Total CouPoints credited this spin (= gemsUsed × multiplier × (meltdownMultiplier ?? 1)). */
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
 * Trigger a solo spinner draw. The server owns the RNG, debits 1 gem, credits
 * the prize CouPoints, writes a ledger row, and returns the result for the FE
 * to animate towards.
 *
 * The optional `gems` argument is a client-side balance snapshot used for
 * desync detection — if it disagrees with the server-side balance, the server
 * returns 409 (WALLET_GEMS_DESYNC) and the FE should `refreshWallet()` before
 * retrying.
 */
export async function drawSpinner(gems?: number): Promise<SpinnerDrawResult> {
  try {
    const body = gems !== undefined ? { gems } : {};
    const response = await apiClient.post<SpinnerDrawResult>('/api/spinner/draw/', body);
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
