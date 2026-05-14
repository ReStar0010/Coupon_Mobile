import { apiClient } from './client';
import { normalizeError } from './errors';

export interface UserProfile {
  id: string;
  email: string;
  phone: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  phoneVerified: boolean;
}

export interface UpdateProfileData {
  displayName?: string;
  avatarUrl?: string;
}

export interface DeleteAccountData {
  password: string;
  acknowledgments: string[];
}

export type FeedbackType = 'bug' | 'feature';

export interface FeedbackPayload {
  feedback_type: FeedbackType;
  details: string;
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

/**
 * Delete the authenticated consumer account.
 * Calls the existing /api/account/delete/ endpoint (password-protected) —
 * the /api/profile/ endpoint family is GET+PATCH only.
 */
export async function deleteAccount(password: string, acknowledgments: string[] = ['DATA_LOSS']): Promise<void> {
  try {
    await apiClient.post('/api/account/delete/', { password, acknowledgments });
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function submitFeedback(feedbackType: FeedbackType, details: string): Promise<void> {
  try {
    const body: FeedbackPayload = { feedback_type: feedbackType, details };
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
