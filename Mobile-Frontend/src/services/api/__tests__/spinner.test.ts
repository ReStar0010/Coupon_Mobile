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
import { drawCoupon, getSpinnerState } from '../spinner';
import type { SpinnerState, DrawResult } from '../spinner';
import type { Coupon } from '../coupons';

const mockAxiosInstance = (axios.create as jest.Mock)();
const mockGet = mockAxiosInstance.get as jest.Mock;
const mockPost = mockAxiosInstance.post as jest.Mock;

const sampleCoupon: Coupon = {
  id: 'coupon-spin-1',
  store: 'Spinner Cafe',
  detail: '20% off your next visit',
  expires: '2026-12-31',
  amount: 20,
  status: 'active',
  tier: 'gold',
};

const sampleSpinnerState: SpinnerState = {
  gems: 500,
  multiplier: 2,
};

const sampleDrawResult: DrawResult = {
  coupon: sampleCoupon,
  pointsEarned: 100,
};

describe('spinner API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ------------------------------------------------------------------ drawCoupon
  describe('drawCoupon', () => {
    it('posts gems count to /api/spinner/draw/ and returns draw result', async () => {
      mockPost.mockResolvedValueOnce({ data: sampleDrawResult });

      const result = await drawCoupon(50);

      expect(mockPost).toHaveBeenCalledWith('/api/spinner/draw/', { gems: 50 });
      expect(result).toEqual(sampleDrawResult);
    });

    it('returns the coupon embedded in the draw result', async () => {
      mockPost.mockResolvedValueOnce({ data: sampleDrawResult });

      const result = await drawCoupon(50);

      expect(result.coupon).toEqual(sampleCoupon);
      expect(result.coupon.id).toBe('coupon-spin-1');
    });

    it('returns the pointsEarned from the draw result', async () => {
      mockPost.mockResolvedValueOnce({ data: sampleDrawResult });

      const result = await drawCoupon(50);

      expect(result.pointsEarned).toBe(100);
    });

    it('sends the exact gem value provided by the caller', async () => {
      mockPost.mockResolvedValueOnce({ data: sampleDrawResult });

      await drawCoupon(1);

      expect(mockPost).toHaveBeenCalledWith('/api/spinner/draw/', { gems: 1 });
    });

    it('handles large gem amounts', async () => {
      mockPost.mockResolvedValueOnce({ data: sampleDrawResult });

      await drawCoupon(9999);

      expect(mockPost).toHaveBeenCalledWith('/api/spinner/draw/', { gems: 9999 });
    });

    it('propagates 402 insufficient gems errors via normalizeError', async () => {
      const axiosError = Object.assign(new Error('Payment Required'), {
        isAxiosError: true,
        response: { status: 402, data: { detail: 'Insufficient gems' } },
      });
      mockPost.mockRejectedValueOnce(axiosError);

      await expect(drawCoupon(999)).rejects.toMatchObject({
        name: 'ApiRequestError',
        status: 402,
        message: 'Insufficient gems',
      });
    });

    it('propagates 429 rate limit errors via normalizeError', async () => {
      const axiosError = Object.assign(new Error('Too Many Requests'), {
        isAxiosError: true,
        response: { status: 429, data: { detail: 'Too many draw attempts' } },
      });
      mockPost.mockRejectedValueOnce(axiosError);

      await expect(drawCoupon(50)).rejects.toMatchObject({
        name: 'ApiRequestError',
        status: 429,
        message: 'Too many draw attempts',
      });
    });

    it('propagates network errors via normalizeError', async () => {
      const axiosError = Object.assign(new Error('Network Error'), {
        isAxiosError: true,
        response: undefined,
      });
      mockPost.mockRejectedValueOnce(axiosError);

      await expect(drawCoupon(50)).rejects.toMatchObject({
        name: 'ApiRequestError',
        status: 0,
      });
    });
  });

  // ------------------------------------------------------------------ getSpinnerState
  describe('getSpinnerState', () => {
    it('calls GET /api/spinner/ and returns spinner state', async () => {
      mockGet.mockResolvedValueOnce({ data: sampleSpinnerState });

      const result = await getSpinnerState();

      expect(mockGet).toHaveBeenCalledWith('/api/spinner/');
      expect(result).toEqual(sampleSpinnerState);
    });

    it('returns the gems balance from the spinner state', async () => {
      mockGet.mockResolvedValueOnce({ data: sampleSpinnerState });

      const result = await getSpinnerState();

      expect(result.gems).toBe(500);
    });

    it('returns the multiplier from the spinner state', async () => {
      mockGet.mockResolvedValueOnce({ data: sampleSpinnerState });

      const result = await getSpinnerState();

      expect(result.multiplier).toBe(2);
    });

    it('returns zero gems when user has no gems', async () => {
      const emptyState: SpinnerState = { gems: 0, multiplier: 1 };
      mockGet.mockResolvedValueOnce({ data: emptyState });

      const result = await getSpinnerState();

      expect(result.gems).toBe(0);
      expect(result.multiplier).toBe(1);
    });

    it('propagates 401 unauthenticated errors via normalizeError', async () => {
      const axiosError = Object.assign(new Error('Unauthorized'), {
        isAxiosError: true,
        response: { status: 401, data: { detail: 'Authentication credentials were not provided.' } },
      });
      mockGet.mockRejectedValueOnce(axiosError);

      await expect(getSpinnerState()).rejects.toMatchObject({
        name: 'ApiRequestError',
        status: 401,
        message: 'Authentication credentials were not provided.',
      });
    });

    it('propagates 503 server errors via normalizeError', async () => {
      const axiosError = Object.assign(new Error('Service Unavailable'), {
        isAxiosError: true,
        response: { status: 503, data: { message: 'Spinner service is temporarily down' } },
      });
      mockGet.mockRejectedValueOnce(axiosError);

      await expect(getSpinnerState()).rejects.toMatchObject({
        name: 'ApiRequestError',
        status: 503,
        message: 'Spinner service is temporarily down',
      });
    });
  });
});
