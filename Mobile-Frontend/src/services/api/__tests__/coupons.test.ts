jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../../../services/auth/tokenStore', () => ({
  getAccessToken: jest.fn().mockResolvedValue('test-token'),
  getRefreshToken: jest.fn().mockResolvedValue(null),
  setTokens: jest.fn().mockResolvedValue(undefined),
  clearTokens: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('axios', () => {
  const get = jest.fn();
  const post = jest.fn();
  const axiosMock = {
    create: jest.fn(() => ({
      get,
      post,
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    })),
  };
  return { ...axiosMock, default: axiosMock };
});

import axios from 'axios';
import { getCoupon, listMyCoupons, redeemCoupon, shareCoupon } from '../coupons';
import type { Coupon } from '../coupons';

const mockAxiosInstance = (axios.create as jest.Mock)();
const mockGet = mockAxiosInstance.get as jest.Mock;
const mockPost = mockAxiosInstance.post as jest.Mock;

const sampleCoupon: Coupon = {
  id: 'coupon-1',
  store: 'Test Store',
  detail: '10% off',
  expires: '2026-12-31',
  amount: 10,
  status: 'active',
  tier: 'gold',
};

describe('coupons API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listMyCoupons', () => {
    it('returns coupon array from /api/coupons/', async () => {
      mockGet.mockResolvedValueOnce({ data: [sampleCoupon] });

      const result = await listMyCoupons();

      expect(mockGet).toHaveBeenCalledWith('/api/coupons/');
      expect(result).toEqual([sampleCoupon]);
    });
  });

  describe('getCoupon', () => {
    it('fetches a single coupon by id', async () => {
      mockGet.mockResolvedValueOnce({ data: sampleCoupon });

      const result = await getCoupon('coupon-1');

      expect(mockGet).toHaveBeenCalledWith('/api/coupons/coupon-1/');
      expect(result).toEqual(sampleCoupon);
    });
  });

  describe('redeemCoupon', () => {
    it('posts to the correct redeem URL', async () => {
      const response = { ...sampleCoupon, status: 'redeemed' as const };
      mockPost.mockResolvedValueOnce({ data: response });

      const result = await redeemCoupon('coupon-1');

      expect(mockPost).toHaveBeenCalledWith('/api/coupons/coupon-1/redeem/');
      expect(result.status).toBe('redeemed');
    });
  });

  describe('shareCoupon', () => {
    it('posts recipient phone to the share URL', async () => {
      const response = { ...sampleCoupon, status: 'shared' as const };
      mockPost.mockResolvedValueOnce({ data: response });

      const result = await shareCoupon('coupon-1', '+61400000000');

      expect(mockPost).toHaveBeenCalledWith(
        '/api/coupons/coupon-1/share/',
        { recipientPhone: '+61400000000' },
      );
      expect(result.status).toBe('shared');
    });
  });
});
