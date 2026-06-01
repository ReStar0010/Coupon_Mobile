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
import {
  login,
  logout,
  normalizeTwPhone,
  refreshToken,
  registerWithPhone,
  sendRegistrationOtp,
  sendPasswordResetOtp,
  resetPasswordWithOtp,
} from '../auth';

const mockAxiosInstance = (axios.create as jest.Mock)();
const mockPost = mockAxiosInstance.post as jest.Mock;

describe('auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearTokens.mockResolvedValue(undefined);
  });

  describe('login', () => {
    it('POSTs email/password to /api/login/ with client_type=user', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          message: 'Login successful',
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          user_id: 1,
          token_type: 'Bearer',
          expires_in: 600,
        },
      });

      const result = await login('test@example.com', undefined, 'password123');

      expect(mockPost).toHaveBeenCalledWith('/api/login/', {
        email: 'test@example.com',
        password: 'password123',
        client_type: 'user',
      });
      // Service normalises the BE snake_case envelope.
      expect(result).toEqual({ access: 'access-token', refresh: 'refresh-token' });
    });

    it('uses phone_number (snake_case) when phone is supplied', async () => {
      mockPost.mockResolvedValueOnce({
        data: { access_token: 'a', refresh_token: 'r' },
      });

      await login(undefined, '0912345678', 'password123');

      expect(mockPost).toHaveBeenCalledWith('/api/login/', {
        phone_number: '0912345678',
        password: 'password123',
        client_type: 'user',
      });
    });
  });

  describe('logout', () => {
    it('clears tokens locally without calling a backend route', async () => {
      await logout();
      expect(mockPost).not.toHaveBeenCalled();
      expect(mockClearTokens).toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('posts refresh_token (snake_case) and normalises the response', async () => {
      mockPost.mockResolvedValueOnce({
        data: { access_token: 'new-access', refresh_token: 'new-refresh' },
      });

      const result = await refreshToken('old-refresh-token');

      expect(mockPost).toHaveBeenCalledWith('/api/token/refresh/', {
        refresh_token: 'old-refresh-token',
      });
      expect(result).toEqual({ access: 'new-access', refresh: 'new-refresh' });
    });
  });

  describe('normalizeTwPhone', () => {
    it('strips dashes, spaces, and parens from a 09XXXXXXXX number', () => {
      expect(normalizeTwPhone('0912-345-678')).toBe('0912345678');
      expect(normalizeTwPhone(' 0912 345 678 ')).toBe('0912345678');
      expect(normalizeTwPhone('(0912)345678')).toBe('0912345678');
    });

    it('accepts an already-normalized 09XXXXXXXX number', () => {
      expect(normalizeTwPhone('0912345678')).toBe('0912345678');
    });

    it('throws on numbers that are not 10 digits starting with 09', () => {
      expect(() => normalizeTwPhone('1912345678')).toThrow();
      expect(() => normalizeTwPhone('091234567')).toThrow();
      expect(() => normalizeTwPhone('09123456789')).toThrow();
    });

    it('throws on +886 international format (BE requires local 09 format)', () => {
      // BE only accepts 09XXXXXXXX; we surface this as a clear FE error
      // rather than letting the BE 400 propagate.
      expect(() => normalizeTwPhone('+886912345678')).toThrow();
    });

    it('throws on strings with letters or empty input', () => {
      expect(() => normalizeTwPhone('not-a-phone')).toThrow();
      expect(() => normalizeTwPhone('')).toThrow();
    });
  });

  describe('sendRegistrationOtp', () => {
    it('POSTs phone_number to /api/register/send-otp/ and returns detail', async () => {
      mockPost.mockResolvedValueOnce({ data: { detail: 'OTP sent' } });

      const result = await sendRegistrationOtp('0912345678');

      expect(mockPost).toHaveBeenCalledWith('/api/register/send-otp/', {
        phone_number: '0912345678',
      });
      expect(result).toEqual({ detail: 'OTP sent' });
    });
  });

  describe('registerWithPhone', () => {
    it('POSTs phone+otp+password and normalises the token envelope', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          access_token: 'reg-access',
          refresh_token: 'reg-refresh',
          message: 'Account created',
        },
      });

      const result = await registerWithPhone('0912345678', '123456', 'pw12345678');

      expect(mockPost).toHaveBeenCalledWith('/api/register/verify-otp/', {
        phone_number: '0912345678',
        otp_code: '123456',
        password: 'pw12345678',
      });
      expect(result).toEqual({ access: 'reg-access', refresh: 'reg-refresh' });
    });
  });

  describe('sendPasswordResetOtp', () => {
    it('POSTs phone_number to the phone reset send-otp endpoint', async () => {
      mockPost.mockResolvedValueOnce({
        data: { message: 'sent', cooldown_seconds: 60, expires_in_seconds: 600 },
      });

      const result = await sendPasswordResetOtp('0912345678');

      expect(mockPost).toHaveBeenCalledWith('/api/forgot-password/phone/send-otp/', {
        phone_number: '0912345678',
      });
      expect(result.message).toBe('sent');
    });

    it('normalises network errors via normalizeError', async () => {
      mockPost.mockRejectedValueOnce(new Error('boom'));
      await expect(sendPasswordResetOtp('0912345678')).rejects.toThrow();
    });
  });

  describe('resetPasswordWithOtp', () => {
    it('POSTs phone+otp+new_password (snake_case) to the phone reset endpoint', async () => {
      mockPost.mockResolvedValueOnce({ data: { message: '密碼已重設成功' } });

      const result = await resetPasswordWithOtp('0912345678', '123456', 'pw12345678');

      expect(mockPost).toHaveBeenCalledWith('/api/forgot-password/phone/reset/', {
        phone_number: '0912345678',
        otp_code: '123456',
        new_password: 'pw12345678',
      });
      expect(result.message).toBe('密碼已重設成功');
    });

    it('normalises network errors via normalizeError', async () => {
      mockPost.mockRejectedValueOnce(new Error('boom'));
      await expect(
        resetPasswordWithOtp('0912345678', '123456', 'pw12345678'),
      ).rejects.toThrow();
    });
  });
});
