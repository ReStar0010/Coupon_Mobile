/**
 * Unit tests for services/newsAPI.ts
 *
 * Verifies HTTP method, URL, body, response parsing, and error propagation
 * for listNews / createNews / deleteNews against a mocked global.fetch.
 */

import { saveTokens, clearTokens, getApiConfig } from '../api';
import {
  listNews,
  createNews,
  deleteNews,
  STORE_NEWS_MAX_LENGTH,
} from '../../services/newsAPI';

const ENDPOINTS = {
  list: '/merchant/news/',
  create: '/merchant/news/',
  delete: (id: number) => `/merchant/news/${id}/`,
};

describe('newsAPI (unit)', () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
    await clearTokens();
    await saveTokens('test-access', 'test-refresh');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('STORE_NEWS_MAX_LENGTH', () => {
    it('matches backend contract of 200 characters', () => {
      expect(STORE_NEWS_MAX_LENGTH).toBe(200);
    });
  });

  describe('listNews', () => {
    it('GETs /merchant/news/ with auth header and returns items', async () => {
      const items = [
        { id: 1, body: 'hello', created_at: '2026-05-13T10:00:00Z' },
        { id: 2, body: 'world', created_at: '2026-05-14T10:00:00Z' },
      ];
      const fetchMock = jest.fn(() =>
        Promise.resolve(new Response(JSON.stringify(items), { status: 200 })),
      );
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await listNews();

      expect(result).toEqual(items);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      const [url, init] = call;
      expect(url).toBe(`${getApiConfig().apiUrl}${ENDPOINTS.list}`);
      expect(init.method).toBe('GET');
      const headers = init.headers as Headers;
      expect(headers.get('Authorization')).toBe('Bearer test-access');
    });

    it('unwraps DRF-style paginated { results: [...] } response', async () => {
      const payload = {
        results: [{ id: 7, body: 'paginated', created_at: '2026-05-14T00:00:00Z' }],
      };
      global.fetch = jest.fn(() =>
        Promise.resolve(new Response(JSON.stringify(payload), { status: 200 })),
      ) as unknown as typeof fetch;

      const result = await listNews();

      expect(result).toEqual(payload.results);
    });

    it('returns [] when backend returns an unexpected shape', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ foo: 'bar' }), { status: 200 })),
      ) as unknown as typeof fetch;

      const result = await listNews();

      expect(result).toEqual([]);
    });

    it('throws ApiError with statusCode on 500', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ error: 'boom' }), { status: 500 })),
      ) as unknown as typeof fetch;

      await expect(listNews()).rejects.toMatchObject({ statusCode: 500 });
    });
  });

  describe('createNews', () => {
    it('POSTs body and returns created row', async () => {
      const created = { id: 42, body: 'new item', created_at: '2026-05-14T11:00:00Z' };
      const fetchMock = jest.fn(() =>
        Promise.resolve(new Response(JSON.stringify(created), { status: 201 })),
      );
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await createNews('new item');

      expect(result).toEqual(created);
      const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      const [url, init] = call;
      expect(url).toBe(`${getApiConfig().apiUrl}${ENDPOINTS.create}`);
      expect(init.method).toBe('POST');
      expect(init.body).toBe(JSON.stringify({ body: 'new item' }));
    });

    it('throws ApiError with statusCode 400 when validation fails', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ body: ['Ensure this field has no more than 200 characters.'] }), {
            status: 400,
          }),
        ),
      ) as unknown as typeof fetch;

      await expect(createNews('x'.repeat(201))).rejects.toMatchObject({ statusCode: 400 });
    });

    it('propagates 429 rate-limit errors', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: 'rate_limit_exceeded', message: 'Too many' }), {
            status: 429,
          }),
        ),
      ) as unknown as typeof fetch;

      await expect(createNews('hi')).rejects.toMatchObject({ statusCode: 429 });
    });
  });

  describe('deleteNews', () => {
    it('DELETEs /merchant/news/<id>/ and returns success on 204 No Content', async () => {
      const fetchMock = jest.fn(() => Promise.resolve(new Response(null, { status: 204 })));
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await deleteNews(99);

      expect(result).toEqual({ success: true });
      const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      const [url, init] = call;
      expect(url).toBe(`${getApiConfig().apiUrl}${ENDPOINTS.delete(99)}`);
      expect(init.method).toBe('DELETE');
    });

    it('throws ApiError with statusCode 404 when row missing', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ detail: 'Not found' }), { status: 404 })),
      ) as unknown as typeof fetch;

      await expect(deleteNews(404)).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
