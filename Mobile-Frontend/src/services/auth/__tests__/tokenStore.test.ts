import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '../tokenStore';

const mockStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('tokenStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setTokens', () => {
    it('stores both access and refresh tokens', async () => {
      mockStorage.setItem.mockResolvedValueOnce(undefined);
      mockStorage.setItem.mockResolvedValueOnce(undefined);

      await setTokens('access-abc', 'refresh-xyz');

      expect(mockStorage.setItem).toHaveBeenCalledWith('access_token', 'access-abc');
      expect(mockStorage.setItem).toHaveBeenCalledWith('refresh_token', 'refresh-xyz');
      expect(mockStorage.setItem).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAccessToken', () => {
    it('returns stored access token', async () => {
      mockStorage.getItem.mockResolvedValueOnce('access-abc');

      const result = await getAccessToken();

      expect(result).toBe('access-abc');
      expect(mockStorage.getItem).toHaveBeenCalledWith('access_token');
    });

    it('returns null when no token stored', async () => {
      mockStorage.getItem.mockResolvedValueOnce(null);

      const result = await getAccessToken();

      expect(result).toBeNull();
    });
  });

  describe('getRefreshToken', () => {
    it('returns stored refresh token', async () => {
      mockStorage.getItem.mockResolvedValueOnce('refresh-xyz');

      const result = await getRefreshToken();

      expect(result).toBe('refresh-xyz');
      expect(mockStorage.getItem).toHaveBeenCalledWith('refresh_token');
    });

    it('returns null after clearTokens', async () => {
      mockStorage.removeItem.mockResolvedValue(undefined);
      mockStorage.getItem.mockResolvedValueOnce(null);

      await clearTokens();
      const result = await getRefreshToken();

      expect(result).toBeNull();
    });
  });

  describe('clearTokens', () => {
    it('removes both token keys', async () => {
      mockStorage.removeItem.mockResolvedValue(undefined);

      await clearTokens();

      expect(mockStorage.removeItem).toHaveBeenCalledWith('access_token');
      expect(mockStorage.removeItem).toHaveBeenCalledWith('refresh_token');
      expect(mockStorage.removeItem).toHaveBeenCalledTimes(2);
    });
  });
});
