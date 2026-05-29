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
  getTransaction,
  listTransactions,
  type HistoryEntry,
  type HistoryEntryDetail,
  type HistoryPage,
} from '../transactions';

const mockAxiosInstance = (axios.create as jest.Mock)();
const mockGet = mockAxiosInstance.get as jest.Mock;

const rawCoupon = {
  id: 42,
  kind: 'coupon_redeem',
  type: 'coupon' as const,
  store: '阿明早餐店',
  detail: '$25 折抵 — 阿明早餐店',
  amount: 25,
  usedAt: '2026-05-06 09:14',
  balanceAfterGems: 0,
  balanceAfterCouPoints: 0,
};

const rawCoupoint = {
  id: 7,
  kind: 'spinner_solo',
  type: 'coupoint' as const,
  store: null,
  detail: '轉盤兌換 +5 CouPoint',
  amount: 5,
  usedAt: '2026-05-04 12:00',
  balanceAfterGems: 2,
  balanceAfterCouPoints: 5,
};

describe('transactions API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listTransactions', () => {
    it('calls GET /api/wallet/transactions/ with default type=all and no cursor', async () => {
      const page: HistoryPage = { items: [], nextCursor: null };
      mockGet.mockResolvedValueOnce({ data: page });

      const result = await listTransactions();

      expect(mockGet).toHaveBeenCalledWith('/api/wallet/transactions/', {
        params: { type: 'all' },
      });
      expect(result).toEqual({ items: [], nextCursor: null });
    });

    it('serialises raw int ids to strings', async () => {
      mockGet.mockResolvedValueOnce({
        data: { items: [rawCoupon], nextCursor: 41 },
      });

      const result = await listTransactions('coupon', 10);

      expect(result.items).toHaveLength(1);
      const row: HistoryEntry = result.items[0];
      expect(row.id).toBe('42');
      expect(typeof row.id).toBe('string');
      expect(result.nextCursor).toBe(41);
    });

    it('forwards limit and cursor as query params', async () => {
      mockGet.mockResolvedValueOnce({
        data: { items: [], nextCursor: null },
      });

      await listTransactions('coupoint', 50, 100);

      expect(mockGet).toHaveBeenCalledWith('/api/wallet/transactions/', {
        params: { type: 'coupoint', limit: '50', cursor: '100' },
      });
    });

    it('omits limit and cursor when not provided', async () => {
      mockGet.mockResolvedValueOnce({
        data: { items: [], nextCursor: null },
      });

      await listTransactions('coupon');

      const [, opts] = mockGet.mock.calls[0];
      expect(opts.params).toEqual({ type: 'coupon' });
      expect(opts.params).not.toHaveProperty('limit');
      expect(opts.params).not.toHaveProperty('cursor');
    });

    it('omits cursor when explicitly null', async () => {
      mockGet.mockResolvedValueOnce({
        data: { items: [], nextCursor: null },
      });

      await listTransactions('all', 25, null);

      const [, opts] = mockGet.mock.calls[0];
      expect(opts.params).not.toHaveProperty('cursor');
    });

    it('preserves bucket information from server', async () => {
      mockGet.mockResolvedValueOnce({
        data: { items: [rawCoupon, rawCoupoint], nextCursor: null },
      });

      const result = await listTransactions('all');

      expect(result.items[0].type).toBe('coupon');
      expect(result.items[1].type).toBe('coupoint');
    });

    it('passes server-supplied null store through unchanged', async () => {
      mockGet.mockResolvedValueOnce({
        data: { items: [rawCoupoint], nextCursor: null },
      });

      const result = await listTransactions('coupoint');

      expect(result.items[0].store).toBeNull();
    });

    it('propagates normalised errors', async () => {
      const axiosError = Object.assign(new Error('Bad Request'), {
        isAxiosError: true,
        response: { status: 400, data: { error: 'INVALID_TRANSACTION_FILTER' } },
      });
      mockGet.mockRejectedValueOnce(axiosError);

      await expect(listTransactions('all')).rejects.toMatchObject({
        name: 'ApiRequestError',
        status: 400,
      });
    });
  });

  describe('getTransaction', () => {
    it('calls GET /api/wallet/transactions/<id>/ and returns the entry', async () => {
      mockGet.mockResolvedValueOnce({ data: rawCoupon });

      const result = await getTransaction(42);

      expect(mockGet).toHaveBeenCalledWith('/api/wallet/transactions/42/');
      expect(result.id).toBe('42');
      expect(result.store).toBe('阿明早餐店');
      expect(result.amount).toBe(25);
    });

    it('accepts a string id', async () => {
      mockGet.mockResolvedValueOnce({ data: rawCoupon });

      await getTransaction('42');

      expect(mockGet).toHaveBeenCalledWith('/api/wallet/transactions/42/');
    });

    it('exposes the optional coupon reference when present', async () => {
      mockGet.mockResolvedValueOnce({
        data: { ...rawCoupon, coupon: { id: 99, name: '買一送一' } },
      });

      const result: HistoryEntryDetail = await getTransaction(42);

      expect(result.coupon).toEqual({ id: 99, name: '買一送一' });
    });

    it('omits coupon when server did not include one', async () => {
      mockGet.mockResolvedValueOnce({ data: rawCoupon });

      const result = await getTransaction(42);

      expect(result.coupon).toBeUndefined();
    });

    it('propagates 404 errors via normalizeError', async () => {
      const axiosError = Object.assign(new Error('Not Found'), {
        isAxiosError: true,
        response: { status: 404, data: { error: 'TRANSACTION_NOT_FOUND' } },
      });
      mockGet.mockRejectedValueOnce(axiosError);

      await expect(getTransaction(99)).rejects.toMatchObject({
        name: 'ApiRequestError',
        status: 404,
      });
    });
  });
});
