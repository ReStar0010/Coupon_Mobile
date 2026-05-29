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
  const del = jest.fn();
  const axiosMock = {
    create: jest.fn(() => ({
      get,
      post,
      delete: del,
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
  listNearby,
  getMerchant,
  flagMerchant,
  blockMerchant,
  getBlockedMerchants,
  unblockMerchant,
} from '../merchants';
import type { Merchant } from '../merchants';

const mockAxiosInstance = (axios.create as jest.Mock)();
const mockGet = mockAxiosInstance.get as jest.Mock;
const mockPost = mockAxiosInstance.post as jest.Mock;
const mockDelete = mockAxiosInstance.delete as jest.Mock;

const sampleMerchant: Merchant = {
  id: 'merchant-1',
  name: 'Test Cafe',
  category: 'Food & Drink',
  lat: -33.8688,
  lng: 151.2093,
  address: '1 Market St, Sydney NSW 2000',
  verified: true,
  logoUrl: 'https://example.com/logo.png',
};

describe('merchants API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ------------------------------------------------------------------ listNearby
  describe('listNearby', () => {
    it('calls GET /api/merchants/nearby/ with lat and lng params', async () => {
      mockGet.mockResolvedValueOnce({ data: [sampleMerchant] });

      const result = await listNearby(-33.8688, 151.2093);

      expect(mockGet).toHaveBeenCalledWith('/api/merchants/nearby/', {
        params: { lat: -33.8688, lng: 151.2093 },
      });
      expect(result).toEqual([sampleMerchant]);
    });

    it('includes radius in params when provided', async () => {
      mockGet.mockResolvedValueOnce({ data: [sampleMerchant] });

      await listNearby(-33.8688, 151.2093, 5000);

      expect(mockGet).toHaveBeenCalledWith('/api/merchants/nearby/', {
        params: { lat: -33.8688, lng: 151.2093, radius: 5000 },
      });
    });

    it('omits radius param when not provided', async () => {
      mockGet.mockResolvedValueOnce({ data: [] });

      await listNearby(0, 0);

      const call = mockGet.mock.calls[0];
      expect(call[1].params).not.toHaveProperty('radius');
    });

    it('returns empty array when no merchants are nearby', async () => {
      mockGet.mockResolvedValueOnce({ data: [] });

      const result = await listNearby(0, 0);

      expect(result).toEqual([]);
    });

    it('propagates network errors via normalizeError', async () => {
      const axiosError = Object.assign(new Error('Network Error'), {
        isAxiosError: true,
        response: { status: 503, data: { detail: 'Service unavailable' } },
      });
      mockGet.mockRejectedValueOnce(axiosError);

      await expect(listNearby(0, 0)).rejects.toMatchObject({
        name: 'ApiRequestError',
        status: 503,
        message: 'Service unavailable',
      });
    });
  });

  // ------------------------------------------------------------------ getMerchant
  describe('getMerchant', () => {
    it('calls GET /api/merchants/:id/ and returns the merchant', async () => {
      mockGet.mockResolvedValueOnce({ data: sampleMerchant });

      const result = await getMerchant('merchant-1');

      expect(mockGet).toHaveBeenCalledWith('/api/merchants/merchant-1/');
      expect(result).toEqual(sampleMerchant);
    });

    it('propagates 404 errors', async () => {
      const axiosError = Object.assign(new Error('Not Found'), {
        isAxiosError: true,
        response: { status: 404, data: { detail: 'Not found.' } },
      });
      mockGet.mockRejectedValueOnce(axiosError);

      await expect(getMerchant('unknown-id')).rejects.toMatchObject({
        name: 'ApiRequestError',
        status: 404,
      });
    });
  });

  // ------------------------------------------------------------------ flagMerchant
  describe('flagMerchant', () => {
    it('posts the flag reason to /api/merchants/:id/flag/', async () => {
      mockPost.mockResolvedValueOnce({ data: {} });

      await flagMerchant('merchant-1', 'Fake deals');

      expect(mockPost).toHaveBeenCalledWith('/api/merchants/merchant-1/flag/', {
        reason: 'Fake deals',
        details: '',
      });
    });

    it('returns void on success', async () => {
      mockPost.mockResolvedValueOnce({ data: {} });

      const result = await flagMerchant('merchant-1', 'spam');

      expect(result).toBeUndefined();
    });

    it('propagates errors via normalizeError', async () => {
      const axiosError = Object.assign(new Error('Forbidden'), {
        isAxiosError: true,
        response: { status: 403, data: { detail: 'Forbidden' } },
      });
      mockPost.mockRejectedValueOnce(axiosError);

      await expect(flagMerchant('merchant-1', 'spam')).rejects.toMatchObject({
        name: 'ApiRequestError',
        status: 403,
      });
    });
  });

  // ------------------------------------------------------------------ blockMerchant
  describe('blockMerchant', () => {
    it('posts to /api/merchants/:id/block/ with no body', async () => {
      mockPost.mockResolvedValueOnce({ data: {} });

      await blockMerchant('merchant-1');

      expect(mockPost).toHaveBeenCalledWith('/api/merchants/merchant-1/block/');
    });

    it('returns void on success', async () => {
      mockPost.mockResolvedValueOnce({ data: {} });

      const result = await blockMerchant('merchant-1');

      expect(result).toBeUndefined();
    });

    it('propagates errors via normalizeError', async () => {
      const axiosError = Object.assign(new Error('Server Error'), {
        isAxiosError: true,
        response: { status: 500, data: { detail: 'Internal server error' } },
      });
      mockPost.mockRejectedValueOnce(axiosError);

      await expect(blockMerchant('merchant-1')).rejects.toMatchObject({
        name: 'ApiRequestError',
        status: 500,
      });
    });
  });

  // ------------------------------------------------------------------ getBlockedMerchants
  describe('getBlockedMerchants', () => {
    it('calls GET /api/merchants/blocked/ and returns list', async () => {
      mockGet.mockResolvedValueOnce({ data: [sampleMerchant] });

      const result = await getBlockedMerchants();

      expect(mockGet).toHaveBeenCalledWith('/api/merchants/blocked/');
      expect(result).toEqual([sampleMerchant]);
    });

    it('returns empty array when no merchants are blocked', async () => {
      mockGet.mockResolvedValueOnce({ data: [] });

      const result = await getBlockedMerchants();

      expect(result).toEqual([]);
    });

    it('propagates errors via normalizeError', async () => {
      const axiosError = Object.assign(new Error('Unauthorized'), {
        isAxiosError: true,
        response: { status: 401, data: { detail: 'Authentication required' } },
      });
      mockGet.mockRejectedValueOnce(axiosError);

      await expect(getBlockedMerchants()).rejects.toMatchObject({
        name: 'ApiRequestError',
        status: 401,
      });
    });
  });

  // ------------------------------------------------------------------ unblockMerchant
  describe('unblockMerchant', () => {
    it('sends DELETE to /api/merchants/:id/block/', async () => {
      mockDelete.mockResolvedValueOnce({ data: {} });

      await unblockMerchant('merchant-1');

      expect(mockDelete).toHaveBeenCalledWith('/api/merchants/merchant-1/block/');
    });

    it('returns void on success', async () => {
      mockDelete.mockResolvedValueOnce({ data: {} });

      const result = await unblockMerchant('merchant-1');

      expect(result).toBeUndefined();
    });

    it('propagates errors via normalizeError', async () => {
      const axiosError = Object.assign(new Error('Not Found'), {
        isAxiosError: true,
        response: { status: 404, data: { detail: 'Block record not found' } },
      });
      mockDelete.mockRejectedValueOnce(axiosError);

      await expect(unblockMerchant('merchant-1')).rejects.toMatchObject({
        name: 'ApiRequestError',
        status: 404,
        message: 'Block record not found',
      });
    });
  });
});
