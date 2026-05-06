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
  const patch = jest.fn();
  const del = jest.fn();
  const axiosMock = {
    create: jest.fn(() => ({
      get,
      post,
      patch,
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
  getProfile,
  updateProfile,
  deleteAccount,
  submitFeedback,
  getWallet,
} from '../profile';
import type { UserProfile, WalletData } from '../profile';

const mockAxiosInstance = (axios.create as jest.Mock)();
const mockGet = mockAxiosInstance.get as jest.Mock;
const mockPost = mockAxiosInstance.post as jest.Mock;
const mockPatch = mockAxiosInstance.patch as jest.Mock;
const mockDelete = mockAxiosInstance.delete as jest.Mock;

const sampleProfile: UserProfile = {
  id: 'user-1',
  email: 'test@example.com',
  phone: '+61400000000',
  displayName: 'Test User',
  avatarUrl: 'https://example.com/avatar.png',
  phoneVerified: true,
};

const sampleWallet: WalletData = {
  gems: 150,
  couPoints: 3200,
};

describe('profile API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ------------------------------------------------------------------ getProfile
  describe('getProfile', () => {
    it('calls GET /api/profile/ and returns the user profile', async () => {
      mockGet.mockResolvedValueOnce({ data: sampleProfile });

      const result = await getProfile();

      expect(mockGet).toHaveBeenCalledWith('/api/profile/');
      expect(result).toEqual(sampleProfile);
    });

    it('propagates 401 errors via normalizeError', async () => {
      const axiosError = Object.assign(new Error('Unauthorized'), {
        isAxiosError: true,
        response: { status: 401, data: { detail: 'Authentication credentials were not provided.' } },
      });
      mockGet.mockRejectedValueOnce(axiosError);

      await expect(getProfile()).rejects.toMatchObject({
        name: 'ApiRequestError',
        status: 401,
        message: 'Authentication credentials were not provided.',
      });
    });

    it('propagates network errors via normalizeError', async () => {
      const axiosError = Object.assign(new Error('Network Error'), {
        isAxiosError: true,
        response: undefined,
      });
      mockGet.mockRejectedValueOnce(axiosError);

      await expect(getProfile()).rejects.toMatchObject({
        name: 'ApiRequestError',
        status: 0,
      });
    });
  });

  // ------------------------------------------------------------------ updateProfile
  describe('updateProfile', () => {
    it('patches /api/profile/ with provided data and returns updated profile', async () => {
      const updated = { ...sampleProfile, displayName: 'New Name' };
      mockPatch.mockResolvedValueOnce({ data: updated });

      const result = await updateProfile({ displayName: 'New Name' });

      expect(mockPatch).toHaveBeenCalledWith('/api/profile/', { displayName: 'New Name' });
      expect(result.displayName).toBe('New Name');
    });

    it('sends only the fields provided in the update payload', async () => {
      mockPatch.mockResolvedValueOnce({ data: sampleProfile });

      await updateProfile({ avatarUrl: 'https://example.com/new.png' });

      expect(mockPatch).toHaveBeenCalledWith('/api/profile/', {
        avatarUrl: 'https://example.com/new.png',
      });
      expect(mockPatch.mock.calls[0][1]).not.toHaveProperty('displayName');
    });

    it('handles partial updates with phone field', async () => {
      const updated = { ...sampleProfile, phone: '+61411111111' };
      mockPatch.mockResolvedValueOnce({ data: updated });

      const result = await updateProfile({ phone: '+61411111111' });

      expect(mockPatch).toHaveBeenCalledWith('/api/profile/', { phone: '+61411111111' });
      expect(result.phone).toBe('+61411111111');
    });

    it('propagates validation errors via normalizeError', async () => {
      const axiosError = Object.assign(new Error('Bad Request'), {
        isAxiosError: true,
        response: { status: 400, data: { detail: 'Invalid phone number format.' } },
      });
      mockPatch.mockRejectedValueOnce(axiosError);

      await expect(updateProfile({ phone: 'not-a-phone' })).rejects.toMatchObject({
        name: 'ApiRequestError',
        status: 400,
        message: 'Invalid phone number format.',
      });
    });
  });

  // ------------------------------------------------------------------ deleteAccount
  describe('deleteAccount', () => {
    it('sends DELETE to /api/profile/', async () => {
      mockDelete.mockResolvedValueOnce({ data: {} });

      await deleteAccount();

      expect(mockDelete).toHaveBeenCalledWith('/api/profile/');
    });

    it('returns void on success', async () => {
      mockDelete.mockResolvedValueOnce({ data: {} });

      const result = await deleteAccount();

      expect(result).toBeUndefined();
    });

    it('propagates errors via normalizeError', async () => {
      const axiosError = Object.assign(new Error('Forbidden'), {
        isAxiosError: true,
        response: { status: 403, data: { detail: 'Cannot delete account with active subscriptions.' } },
      });
      mockDelete.mockRejectedValueOnce(axiosError);

      await expect(deleteAccount()).rejects.toMatchObject({
        name: 'ApiRequestError',
        status: 403,
        message: 'Cannot delete account with active subscriptions.',
      });
    });
  });

  // ------------------------------------------------------------------ submitFeedback
  describe('submitFeedback', () => {
    it('posts to /api/feedback/ with message only when rating is omitted', async () => {
      mockPost.mockResolvedValueOnce({ data: {} });

      await submitFeedback('Great app!');

      expect(mockPost).toHaveBeenCalledWith('/api/feedback/', { message: 'Great app!' });
      expect(mockPost.mock.calls[0][1]).not.toHaveProperty('rating');
    });

    it('includes rating in the post body when provided', async () => {
      mockPost.mockResolvedValueOnce({ data: {} });

      await submitFeedback('Love it', 5);

      expect(mockPost).toHaveBeenCalledWith('/api/feedback/', {
        message: 'Love it',
        rating: 5,
      });
    });

    it('returns void on success', async () => {
      mockPost.mockResolvedValueOnce({ data: {} });

      const result = await submitFeedback('Test message');

      expect(result).toBeUndefined();
    });

    it('handles edge case with rating of 0', async () => {
      mockPost.mockResolvedValueOnce({ data: {} });

      await submitFeedback('Poor experience', 0);

      expect(mockPost).toHaveBeenCalledWith('/api/feedback/', {
        message: 'Poor experience',
        rating: 0,
      });
    });

    it('propagates server errors via normalizeError', async () => {
      const axiosError = Object.assign(new Error('Server Error'), {
        isAxiosError: true,
        response: { status: 500, data: { error: 'Feedback submission failed' } },
      });
      mockPost.mockRejectedValueOnce(axiosError);

      await expect(submitFeedback('Test')).rejects.toMatchObject({
        name: 'ApiRequestError',
        status: 500,
        message: 'Feedback submission failed',
      });
    });
  });

  // ------------------------------------------------------------------ getWallet
  describe('getWallet', () => {
    it('calls GET /api/wallet/ and returns wallet data', async () => {
      mockGet.mockResolvedValueOnce({ data: sampleWallet });

      const result = await getWallet();

      expect(mockGet).toHaveBeenCalledWith('/api/wallet/');
      expect(result).toEqual(sampleWallet);
    });

    it('returns zero balances correctly', async () => {
      const emptyWallet: WalletData = { gems: 0, couPoints: 0 };
      mockGet.mockResolvedValueOnce({ data: emptyWallet });

      const result = await getWallet();

      expect(result.gems).toBe(0);
      expect(result.couPoints).toBe(0);
    });

    it('propagates errors via normalizeError', async () => {
      const axiosError = Object.assign(new Error('Not Found'), {
        isAxiosError: true,
        response: { status: 404, data: { detail: 'Wallet not found.' } },
      });
      mockGet.mockRejectedValueOnce(axiosError);

      await expect(getWallet()).rejects.toMatchObject({
        name: 'ApiRequestError',
        status: 404,
        message: 'Wallet not found.',
      });
    });
  });
});
