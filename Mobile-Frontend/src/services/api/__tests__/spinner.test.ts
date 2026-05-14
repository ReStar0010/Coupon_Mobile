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
import { drawSpinner, getSpinnerState } from '../spinner';
import type { SpinnerState, SpinnerDrawResult } from '../spinner';

const mockAxiosInstance = (axios.create as jest.Mock)();
const mockGet = mockAxiosInstance.get as jest.Mock;
const mockPost = mockAxiosInstance.post as jest.Mock;

const sampleSpinnerState: SpinnerState = {
  gems: 5,
  floor: 1,
  lastSpinAt: '2026-05-14T12:34:56Z',
};

const sampleDrawResult: SpinnerDrawResult = {
  multiplier: 3,
  meltdownMultiplier: null,
  gemsUsed: 5,
  pointsEarned: 15,
  gems: 4,
  couPoints: 15,
  transactionId: 42,
  floor: 1,
  spunAt: '2026-05-14T12:35:00Z',
};

describe('spinner API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('drawSpinner', () => {
    it('POSTs no body when no client snapshot is given', async () => {
      mockPost.mockResolvedValueOnce({ data: sampleDrawResult });

      const result = await drawSpinner();

      expect(mockPost).toHaveBeenCalledWith('/api/spinner/draw/', {});
      expect(result).toEqual(sampleDrawResult);
    });

    it('forwards the client gems snapshot for desync detection', async () => {
      mockPost.mockResolvedValueOnce({ data: sampleDrawResult });

      await drawSpinner(5);

      expect(mockPost).toHaveBeenCalledWith('/api/spinner/draw/', { gems: 5 });
    });

    it('returns the meltdownMultiplier when present', async () => {
      const meltdown: SpinnerDrawResult = {
        ...sampleDrawResult,
        multiplier: 5,
        meltdownMultiplier: 3,
        pointsEarned: 75,
        couPoints: 75,
      };
      mockPost.mockResolvedValueOnce({ data: meltdown });

      const result = await drawSpinner();

      expect(result.meltdownMultiplier).toBe(3);
      expect(result.pointsEarned).toBe(75);
    });

    it('propagates 409 desync errors via normalizeError', async () => {
      const axiosError = Object.assign(new Error('Conflict'), {
        isAxiosError: true,
        response: {
          status: 409,
          data: { error_code: 'WALLET_GEMS_DESYNC', developer_message: 'desync' },
        },
      });
      mockPost.mockRejectedValueOnce(axiosError);

      await expect(drawSpinner(99)).rejects.toMatchObject({
        name: 'ApiRequestError',
        status: 409,
      });
    });

    it('propagates 429 rate limit errors via normalizeError', async () => {
      const axiosError = Object.assign(new Error('Too Many Requests'), {
        isAxiosError: true,
        response: { status: 429, data: { developer_message: 'slow down' } },
      });
      mockPost.mockRejectedValueOnce(axiosError);

      await expect(drawSpinner()).rejects.toMatchObject({
        name: 'ApiRequestError',
        status: 429,
      });
    });
  });

  describe('getSpinnerState', () => {
    it('calls GET /api/spinner/ and returns spinner state', async () => {
      mockGet.mockResolvedValueOnce({ data: sampleSpinnerState });

      const result = await getSpinnerState();

      expect(mockGet).toHaveBeenCalledWith('/api/spinner/');
      expect(result).toEqual(sampleSpinnerState);
    });

    it('handles a state with no prior spins (lastSpinAt: null)', async () => {
      const fresh: SpinnerState = { gems: 3, floor: 1, lastSpinAt: null };
      mockGet.mockResolvedValueOnce({ data: fresh });

      const result = await getSpinnerState();

      expect(result.lastSpinAt).toBeNull();
    });

    it('propagates 401 unauthenticated errors via normalizeError', async () => {
      const axiosError = Object.assign(new Error('Unauthorized'), {
        isAxiosError: true,
        response: { status: 401, data: { detail: 'auth' } },
      });
      mockGet.mockRejectedValueOnce(axiosError);

      await expect(getSpinnerState()).rejects.toMatchObject({
        name: 'ApiRequestError',
        status: 401,
      });
    });
  });
});
