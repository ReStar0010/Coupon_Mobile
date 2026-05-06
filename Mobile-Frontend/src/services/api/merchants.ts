import { apiClient } from './client';
import { normalizeError } from './errors';

export interface Merchant {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address: string;
  verified: boolean;
  logoUrl?: string;
}

export interface FlagReason {
  reason: string;
}

export async function listNearby(
  lat: number,
  lng: number,
  radius?: number,
): Promise<Merchant[]> {
  try {
    const params: Record<string, string | number> = { lat, lng };
    if (radius !== undefined) {
      params.radius = radius;
    }
    const response = await apiClient.get<Merchant[]>('/api/merchants/nearby/', { params });
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function getMerchant(id: string): Promise<Merchant> {
  try {
    const response = await apiClient.get<Merchant>(`/api/merchants/${id}/`);
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function flagMerchant(id: string, reason: string): Promise<void> {
  try {
    await apiClient.post(`/api/merchants/${id}/flag/`, { reason });
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function blockMerchant(id: string): Promise<void> {
  try {
    await apiClient.post(`/api/merchants/${id}/block/`);
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function getBlockedMerchants(): Promise<Merchant[]> {
  try {
    const response = await apiClient.get<Merchant[]>('/api/merchants/blocked/');
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function unblockMerchant(id: string): Promise<void> {
  try {
    await apiClient.delete(`/api/merchants/${id}/block/`);
  } catch (error) {
    throw normalizeError(error);
  }
}
