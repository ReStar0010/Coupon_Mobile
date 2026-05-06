import { apiClient } from './client';
import { normalizeError } from './errors';

export interface UserProfile {
  id: string;
  email: string;
  phone?: string;
  displayName?: string;
  avatarUrl?: string;
  phoneVerified: boolean;
}

export interface UpdateProfileData {
  displayName?: string;
  avatarUrl?: string;
  phone?: string;
}

export interface FeedbackData {
  message: string;
  rating?: number;
}

export interface WalletData {
  gems: number;
  couPoints: number;
}

export async function getProfile(): Promise<UserProfile> {
  try {
    const response = await apiClient.get<UserProfile>('/api/profile/');
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function updateProfile(data: UpdateProfileData): Promise<UserProfile> {
  try {
    const response = await apiClient.patch<UserProfile>('/api/profile/', data);
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function deleteAccount(): Promise<void> {
  try {
    await apiClient.delete('/api/profile/');
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function submitFeedback(message: string, rating?: number): Promise<void> {
  try {
    const body: FeedbackData = { message };
    if (rating !== undefined) {
      body.rating = rating;
    }
    await apiClient.post('/api/feedback/', body);
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function getWallet(): Promise<WalletData> {
  try {
    const response = await apiClient.get<WalletData>('/api/wallet/');
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}
