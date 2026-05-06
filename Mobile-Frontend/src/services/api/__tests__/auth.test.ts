jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockClearTokens = jest.fn<Promise<void>, []>();

jest.mock('../../../services/auth/tokenStore', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  getRefreshToken: jest.fn().mockResolvedValue(null),
  setTokens: jest.fn().mockResolvedValue(undefined),
  clearTokens: () => mockClearTokens(),
}));

jest.mock('axios', () => {
  const post = jest.fn();
  const get = jest.fn();
  const axiosMock = {
    create: jest.fn(() => ({
      post,
      get,
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    })),
    post,
    get,
  };
  return { ...axiosMock, default: axiosMock };
});

import axios from 'axios';
import { login, logout, refreshToken } from '../auth';

const mockAxiosInstance = (axios.create as jest.Mock)();
const mockPost = mockAxiosInstance.post as jest.Mock;

describe('auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearTokens.mockResolvedValue(undefined);
  });

  describe('login', () => {
    it('calls the correct endpoint with credentials', async () => {
      const responseData = {
        access: 'access-token',
        refresh: 'refresh-token',
        user: { id: '1', email: 'test@example.com', phoneVerified: false },
      };
      mockPost.mockResolvedValueOnce({ data: responseData });

      const result = await login('test@example.com', undefined, 'password123');

      expect(mockPost).toHaveBeenCalledWith(
        '/api/auth/login/',
        { email: 'test@example.com', phone: undefined, password: 'password123' },
      );
      expect(result).toEqual(responseData);
    });
  });

  describe('logout', () => {
    it('clears tokens even if API call fails', async () => {
      mockPost.mockRejectedValueOnce(new Error('Network error'));

      await logout();

      expect(mockClearTokens).toHaveBeenCalled();
    });

    it('clears tokens on successful logout', async () => {
      mockPost.mockResolvedValueOnce({ data: {} });

      await logout();

      expect(mockClearTokens).toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('posts refresh token to the correct endpoint', async () => {
      const responseData = { access: 'new-access', refresh: 'new-refresh' };
      mockPost.mockResolvedValueOnce({ data: responseData });

      const result = await refreshToken('old-refresh-token');

      expect(mockPost).toHaveBeenCalledWith(
        '/api/auth/token/refresh/',
        { refresh: 'old-refresh-token' },
      );
      expect(result).toEqual(responseData);
    });
  });
});
