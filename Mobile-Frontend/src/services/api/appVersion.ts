import { Platform } from 'react-native';
import { apiClient } from './client';
import { normalizeError } from './errors';

export interface AppVersionInfo {
  platform: 'ios' | 'android';
  /** Force-update floor — current native build must be >= this. */
  minVersion: string;
  /** Recommended floor — current native build < latestVersion → soft banner. */
  latestVersion: string;
  /** Deep link / web URL into App Store or Play Store for this platform. */
  storeUrl: string;
}

/**
 * Fetch the platform-specific minimum + latest version metadata.
 *
 * Public endpoint — works before login so a too-old install can be
 * blocked from authenticating. Surfaces a normalized error if the call
 * fails so the caller can decide whether to fall through (treat as
 * "no information" and let the user in).
 */
export async function getVersionInfo(): Promise<AppVersionInfo> {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  try {
    const response = await apiClient.get<AppVersionInfo>('/api/app/version-info/', {
      params: { platform },
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}
