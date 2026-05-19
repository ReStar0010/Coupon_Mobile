const mockPost = jest.fn();

jest.mock('../client', () => ({
  apiClient: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

import { acceptShare } from '../sharing';

describe('acceptShare', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POSTs to /api/coupon/share/<token>/accept/ and returns BE payload', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        message: 'ok',
        coupon_id: 42,
        coupon_name: '阿明早餐券',
        acquisition_method: 'public_pool',
      },
    });
    const res = await acceptShare('abc');
    expect(mockPost).toHaveBeenCalledWith('/api/coupon/share/abc/accept/', {});
    expect(res.coupon_id).toBe(42);
  });

  it('URL-encodes the token to defend against odd characters', async () => {
    mockPost.mockResolvedValueOnce({ data: {} });
    await acceptShare('foo/bar?baz');
    expect(mockPost).toHaveBeenCalledWith(
      '/api/coupon/share/foo%2Fbar%3Fbaz/accept/',
      {},
    );
  });

  it('rethrows a normalized error on failure', async () => {
    mockPost.mockRejectedValueOnce(Object.assign(new Error('claimed'), { status: 409 }));
    await expect(acceptShare('abc')).rejects.toThrow();
  });
});
