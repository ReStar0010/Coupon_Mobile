import { transformApiCoupon, getSharePendingIndicatorLabel } from '../couponUtils';
import type { ApiCoupon } from '../types';

const baseApiCoupon: ApiCoupon = {
  id: 1,
  store_name: 'S',
  store_id: 1,
  coupon_name: 'C',
  coupon_detail: 'D',
  start_date: '2025-01-01T00:00:00Z',
  expiry_date: '2030-01-01T00:00:00Z',
  coupon_type: 'exclusive',
  estimated_savings: null,
  is_redeemed: false,
};

describe('getSharePendingIndicatorLabel', () => {
  it('returns null when not in pool and no private pending share', () => {
    expect(
      getSharePendingIndicatorLabel({ isInPool: false, hasPendingPrivateShare: false }),
    ).toBeNull();
  });

  it('returns public-pool copy when in pool', () => {
    expect(getSharePendingIndicatorLabel({ isInPool: true, hasPendingPrivateShare: false })).toBe(
      '交換池 · 等待對方領取',
    );
  });

  it('returns private-share copy when wallet coupon has pending private share', () => {
    expect(
      getSharePendingIndicatorLabel({ isInPool: false, hasPendingPrivateShare: true }),
    ).toBe('私人分享 · 等待對方回覆');
  });

  it('prefers public-pool when both would apply (defensive)', () => {
    expect(getSharePendingIndicatorLabel({ isInPool: true, hasPendingPrivateShare: true })).toBe(
      '交換池 · 等待對方領取',
    );
  });
});

describe('transformApiCoupon', () => {
  it('maps has_pending_private_share from API', () => {
    const out = transformApiCoupon({
      ...baseApiCoupon,
      has_pending_private_share: true,
    });
    expect(out.hasPendingPrivateShare).toBe(true);
  });

  it('defaults hasPendingPrivateShare to false when omitted', () => {
    const out = transformApiCoupon(baseApiCoupon);
    expect(out.hasPendingPrivateShare).toBe(false);
  });
});
