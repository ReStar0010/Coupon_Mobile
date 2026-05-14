/**
 * Store News API Service
 *
 * Handles merchant store news (店家近況) CRUD:
 *   GET    /api/merchant/news/        → list this merchant's StoreNews
 *   POST   /api/merchant/news/        → create a (<= 200 char) news item
 *   DELETE /api/merchant/news/<id>/   → delete a news item
 */

import { fetchAPI, parseResponse } from '../utils/api';

// ============================================
// TypeScript Interfaces
// ============================================

export interface StoreNewsItem {
  id: number;
  body: string;
  created_at: string;
}

export interface CreateStoreNewsRequest {
  body: string;
}

export interface CreateStoreNewsResponse {
  id: number;
  body: string;
  created_at: string;
}

export interface DeleteStoreNewsResponse {
  success?: boolean;
  message?: string;
}

/** Max body length per backend contract */
export const STORE_NEWS_MAX_LENGTH = 200;

// ============================================
// API Functions
// ============================================

/**
 * List the current merchant's StoreNews items, newest first.
 *
 * Tolerant of two backend response shapes:
 *   - bare array:                 [ ... ]
 *   - DRF-style paginated object: { results: [ ... ] }
 */
export async function listNews(): Promise<StoreNewsItem[]> {
  const response = await fetchAPI('/merchant/news/', { method: 'GET' });
  const data = await parseResponse<StoreNewsItem[] | { results?: StoreNewsItem[] }>(response);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

/**
 * Create a new StoreNews item.
 *
 * @throws ApiError when body is empty, > 200 chars, or rate limited (429).
 */
export async function createNews(body: string): Promise<CreateStoreNewsResponse> {
  const response = await fetchAPI('/merchant/news/', {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  return parseResponse<CreateStoreNewsResponse>(response);
}

/**
 * Delete an existing StoreNews item owned by this merchant.
 *
 * Note: DELETE often returns 204 No Content. `parseResponse` calls `response.json()`
 * which would throw on an empty body — so we short-circuit on no-content responses.
 */
export async function deleteNews(id: number): Promise<DeleteStoreNewsResponse> {
  const response = await fetchAPI(`/merchant/news/${id}/`, { method: 'DELETE' });
  if (!response.ok) {
    // Re-use parseResponse's structured error handling for non-2xx responses.
    return parseResponse<DeleteStoreNewsResponse>(response);
  }
  if (response.status === 204) {
    return { success: true };
  }
  // Some backends return JSON on DELETE; some don't. Be defensive.
  try {
    return await response.json();
  } catch {
    return { success: true };
  }
}
