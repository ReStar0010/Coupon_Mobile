import { apiClient } from './client';
import { normalizeError } from './errors';

export interface CouPointSpendResponse {
  /** Post-debit CouPoint balance. */
  couPoints: number;
  store: {
    id: number;
    name: string;
    address: string;
  };
  transactionId: number;
  amount: number;
}

/**
 * Spend CouPoints at a merchant by scanning their QR code.
 * `amount` must be a positive multiple of 5.
 *
 * Named without the `use` prefix so ESLint's react-hooks rule doesn't
 * mistake this for a custom React hook.
 */
export async function submitCouPointSpend(
  qrToken: string,
  amount: number,
): Promise<CouPointSpendResponse> {
  try {
    const response = await apiClient.post<CouPointSpendResponse>('/api/coupoints/use/', {
      qrToken,
      amount,
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}
