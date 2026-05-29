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
import {
  getCoupon,
  listMyCoupons,
  redeemCoupon,
  shareCoupon,
  listDailyDrawTemplates,
  dailyDraw,
} from '../coupons';
import type { Coupon, DailyDrawTemplate, DailyDrawResult } from '../coupons';

const mockAxiosInstance = (axios.create as jest.Mock)();
const mockGet = mockAxiosInstance.get as jest.Mock;
const mockPost = mockAxiosInstance.post as jest.Mock;

const sampleCoupon: Coupon = {
  id: 'coupon-1',
  store: 'Test Store',
  detail: '10% off',
  expires: '12/31',
  amount: 10,
  status: 'active',
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
    it('posts the redeem code to the redeem URL', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          message: 'ok',
          coupon_name: 'Test',
          coupon_detail: '10% off',
          savings_amount: 10,
          redeemed_at: '2026-05-14T00:00:00Z',
          redemption_id: 42,
        },
      });

      const result = await redeemCoupon('coupon-1', 'ABCDEF');

      expect(mockPost).toHaveBeenCalledWith('/api/coupons/coupon-1/redeem/', {
        redeem_code: 'ABCDEF',
      });
      expect(result.redemption_id).toBe(42);
    });
  });

  describe('shareCoupon', () => {
    it('posts recipient phone to the share URL with the BE-shaped key', async () => {
      mockPost.mockResolvedValueOnce({
        data: { share_link: 'https://example/share/tok', token: 'tok' },
      });

      const result = await shareCoupon('coupon-1', '+61400000000');

      expect(mockPost).toHaveBeenCalledWith(
        '/api/coupons/coupon-1/share/',
        { to_phone_number: '+61400000000' },
      );
      expect(result.token).toBe('tok');
    });
  });

  // ── Daily draw (Phase: locate/daily-draw/swipe-back sub-sprint) ───────────

  describe('listDailyDrawTemplates', () => {
    it('GETs /api/daily-draw-templates/ and unwraps the active_templates array', async () => {
      const fixture: DailyDrawTemplate[] = [
        {
          id: 1,
          store_id: 10,
          store_name: '阿明早餐店',
          coupon_name: '現金折抵 $25',
          image_url: null,
          estimated_savings: 25,
          expiry_date: '2026-12-31T00:00:00Z',
          remaining_quantity: 50,
        },
        {
          id: 2,
          store_id: 11,
          store_name: '鼎泰豐',
          coupon_name: '現金折抵 $50',
          image_url: null,
          estimated_savings: 50,
          expiry_date: '2026-12-31T00:00:00Z',
          remaining_quantity: 30,
        },
      ];
      mockGet.mockResolvedValueOnce({ data: { active_templates: fixture } });

      const result = await listDailyDrawTemplates();

      expect(mockGet).toHaveBeenCalledWith('/api/daily-draw-templates/');
      expect(result).toEqual(fixture);
    });

    it('returns an empty array when the BE sends no templates', async () => {
      mockGet.mockResolvedValueOnce({ data: { active_templates: [] } });
      const result = await listDailyDrawTemplates();
      expect(result).toEqual([]);
    });

    it('tolerates a missing active_templates key by returning []', async () => {
      mockGet.mockResolvedValueOnce({ data: {} });
      const result = await listDailyDrawTemplates();
      expect(result).toEqual([]);
    });
  });

  describe('dailyDraw', () => {
    it('POSTs template_id to /api/coupon/daily-draw/ and normalises a win', async () => {
      const beWin = {
        success: true,
        coupon: {
          id: 99,
          name: '現金折抵 $25',
          detail: '$25 現金折抵',
          important_notes: null,
          image_url: null,
          store_name: '阿明早餐店',
          expiry_date: '2026-12-31T00:00:00Z',
          redeem_code: 'ABCDEF',
          estimated_savings: 25,
        },
        message: 'Congratulations! ...',
      };
      mockPost.mockResolvedValueOnce({ data: beWin });

      const result: DailyDrawResult = await dailyDraw(1);

      expect(mockPost).toHaveBeenCalledWith('/api/coupon/daily-draw/', { template_id: 1 });
      expect(result.success).toBe(true);
      expect(result.coupon).toEqual(beWin.coupon);
      expect(result.message).toBe(beWin.message);
    });

    it('normalises a miss response (success=false, no coupon)', async () => {
      const beMiss = { success: false, message: 'Better luck next time!' };
      mockPost.mockResolvedValueOnce({ data: beMiss });

      const result = await dailyDraw(2);

      expect(result.success).toBe(false);
      expect(result.coupon).toBeUndefined();
      expect(result.message).toBe('Better luck next time!');
    });

    it('propagates network errors via normalizeError', async () => {
      const axiosError = Object.assign(new Error('Server Error'), {
        isAxiosError: true,
        response: { status: 500, data: { detail: 'Draw failed' } },
      });
      mockPost.mockRejectedValueOnce(axiosError);

      await expect(dailyDraw(1)).rejects.toMatchObject({
        name: 'ApiRequestError',
        status: 500,
      });
    });
  });
});
