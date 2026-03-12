/**
 * Token Utilities - Centralized token storage and JWT operations
 *
 * This module consolidates all token-related operations including:
 * - AsyncStorage operations for token persistence
 * - In-memory cache for synchronous access after initialization
 * - Optional JWT decoding for proactive refresh
 * - Token expiration checking
 *
 * IMPORTANT: Call initStorage() on app startup before accessing tokens!
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';

/**
 * Storage keys - single source of truth for key names
 */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  // Legacy keys kept for cleanup during logout
  LEGACY_KEYS: ['user_id', 'email', 'is_logged_in', 'auth_token', 'user_info'],
} as const;

/**
 * In-memory token cache for synchronous access
 * Tokens are loaded from AsyncStorage on app startup via initStorage()
 */
let tokenStorage: {
  access_token: string | null;
  refresh_token: string | null;
} = {
  access_token: null,
  refresh_token: null,
};

/**
 * Initialize storage - loads tokens from AsyncStorage into memory
 * MUST be called on app startup before any token access!
 */
export const initStorage = async (): Promise<void> => {
  try {
    const accessToken = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    tokenStorage.access_token = accessToken;
    tokenStorage.refresh_token = refreshToken;
    console.log('[TokenStorage] Loaded tokens from AsyncStorage:', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
    });
  } catch (error) {
    console.error('[TokenStorage] Failed to load tokens from AsyncStorage:', error);
    Sentry.captureException(error, { data: { context: 'tokenUtils.initStorage' } });
    // Keep in-memory storage as fallback
    console.log('[TokenStorage] Using in-memory storage fallback');
  }
};

/**
 * Decoded JWT payload structure
 */
export interface DecodedToken {
  exp: number; // Expiration timestamp (Unix)
  iat: number; // Issued at timestamp (Unix)
  user_id?: number;
  token_type?: string;
  jti?: string; // JWT ID
}

/**
 * Token state returned by getTokenState
 */
export interface TokenState {
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExp: number | null; // Unix timestamp
  refreshTokenExp: number | null; // Unix timestamp
}

/**
 * Get current token state (synchronous - reads from memory)
 * Includes optional expiration times if tokens can be decoded
 */
export function getTokenState(): TokenState {
  const access = tokenStorage.access_token;
  const refresh = tokenStorage.refresh_token;

  return {
    accessToken: access,
    refreshToken: refresh,
    accessTokenExp: access ? getTokenExpiration(access) : null,
    refreshTokenExp: refresh ? getTokenExpiration(refresh) : null,
  };
}

/**
 * Store tokens in both memory and AsyncStorage
 * @param accessToken JWT access token
 * @param refreshToken JWT refresh token
 */
export async function storeTokens(accessToken: string, refreshToken: string): Promise<void> {
  // Update in-memory cache immediately
  tokenStorage.access_token = accessToken;
  tokenStorage.refresh_token = refreshToken;

  console.log('[TokenStorage] Saving tokens:', {
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken,
  });

  try {
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.ACCESS_TOKEN, accessToken],
      [STORAGE_KEYS.REFRESH_TOKEN, refreshToken],
    ]);
    console.log('[TokenStorage] Tokens saved to AsyncStorage');
  } catch (error) {
    console.error('[TokenStorage] Failed to save tokens to AsyncStorage:', error);
    Sentry.captureException(error, { data: { context: 'tokenUtils.storeTokens' } });
    // In-memory storage still works as fallback
  }
}

/**
 * Clear all auth tokens from both memory and AsyncStorage
 * Also cleans up legacy keys for backward compatibility
 */
export async function clearTokens(): Promise<void> {
  // Clear in-memory cache immediately
  tokenStorage.access_token = null;
  tokenStorage.refresh_token = null;

  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.ACCESS_TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
      ...STORAGE_KEYS.LEGACY_KEYS,
    ]);
    console.log('[TokenStorage] Tokens cleared from AsyncStorage');
  } catch (error) {
    console.error('[TokenStorage] Failed to clear tokens from AsyncStorage:', error);
    Sentry.captureException(error, { data: { context: 'tokenUtils.clearTokens' } });
  }
}

/**
 * Get access token from memory (synchronous)
 * Returns null if initStorage() hasn't been called
 */
export function getAccessToken(): string | null {
  return tokenStorage.access_token;
}

/**
 * Get refresh token from memory (synchronous)
 * Returns null if initStorage() hasn't been called
 */
export function getRefreshToken(): string | null {
  return tokenStorage.refresh_token;
}

/**
 * Check if a refresh token exists (synchronous)
 * This is the single source of truth for login status
 */
export function hasValidRefreshToken(): boolean {
  const refreshToken = tokenStorage.refresh_token;
  return refreshToken !== null && refreshToken.length > 0;
}

/**
 * Async version of hasValidRefreshToken that ensures storage is initialized
 * Use this for initial auth checks
 */
export async function checkHasValidRefreshToken(): Promise<boolean> {
  await initStorage();
  return hasValidRefreshToken();
}

/**
 * Decode JWT payload without verification
 * This is safe because we only use it for reading expiration time,
 * not for authorization decisions.
 *
 * @param token JWT token string
 * @returns Decoded payload or null if decode fails
 */
export function decodeJwtPayload(token: string): DecodedToken | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // JWT payload is the second part (base64url encoded)
    const payload = parts[1];

    // Convert base64url to base64
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');

    // Decode base64
    const jsonPayload = decodeBase64(base64);

    return JSON.parse(jsonPayload);
  } catch (error) {
    // Graceful fallback - token might not be a valid JWT
    return null;
  }
}

/**
 * Decode base64 string (works in React Native without atob)
 */
function decodeBase64(base64: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';

  // Add padding if needed
  const padding = 4 - (base64.length % 4);
  if (padding !== 4) {
    base64 += '='.repeat(padding);
  }

  for (let i = 0; i < base64.length; i += 4) {
    const enc1 = chars.indexOf(base64.charAt(i));
    const enc2 = chars.indexOf(base64.charAt(i + 1));
    const enc3 = chars.indexOf(base64.charAt(i + 2));
    const enc4 = chars.indexOf(base64.charAt(i + 3));

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    output += String.fromCharCode(chr1);
    if (enc3 !== 64) output += String.fromCharCode(chr2);
    if (enc4 !== 64) output += String.fromCharCode(chr3);
  }

  return output;
}

/**
 * Check if a token is expired
 *
 * @param token JWT token string
 * @param bufferSeconds Seconds before actual expiry to consider as expired (default: 60)
 * @returns true if expired, false if valid, null if cannot determine
 */
export function isTokenExpired(token: string, bufferSeconds: number = 60): boolean | null {
  const decoded = decodeJwtPayload(token);
  if (!decoded || !decoded.exp) {
    return null; // Cannot determine - let server validate
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return decoded.exp - bufferSeconds <= nowSeconds;
}

/**
 * Get token expiration timestamp
 *
 * @param token JWT token string
 * @returns Unix timestamp of expiration, or null if cannot decode
 */
export function getTokenExpiration(token: string): number | null {
  const decoded = decodeJwtPayload(token);
  return decoded?.exp ?? null;
}

/**
 * Get time remaining until token expires
 *
 * @param token JWT token string
 * @returns Seconds until expiration, negative if expired, null if cannot determine
 */
export function getTokenTimeRemaining(token: string): number | null {
  const exp = getTokenExpiration(token);
  if (exp === null) {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return exp - nowSeconds;
}


// /**
//  * Token Utilities - Centralized token storage and JWT operations
//  *
//  * This module consolidates all token-related operations including:
//  * - expo-secure-store for secure token persistence (Keychain / EncryptedSharedPreferences)
//  * - In-memory cache for synchronous access after initialization
//  * - Optional JWT decoding for proactive refresh
//  * - Token expiration checking
//  *
//  * IMPORTANT: Call initStorage() on app startup before accessing tokens!
//  */

// import AsyncStorage from '@react-native-async-storage/async-storage';
// import * as SecureStore from 'expo-secure-store';
// import * as Sentry from '@sentry/react-native';

// /**
//  * Storage keys - single source of truth for key names
//  */
// export const STORAGE_KEYS = {
//   ACCESS_TOKEN: 'access_token',
//   REFRESH_TOKEN: 'refresh_token',
//   // Legacy keys kept for cleanup during logout
//   LEGACY_KEYS: ['user_id', 'email', 'is_logged_in', 'auth_token', 'user_info'],
// } as const;

// /**
//  * In-memory token cache for synchronous access
//  * Tokens are loaded from SecureStore on app startup via initStorage()
//  */
// let tokenStorage: {
//   access_token: string | null;
//   refresh_token: string | null;
// } = {
//   access_token: null,
//   refresh_token: null,
// };

// /**
//  * Initialize storage - loads tokens from SecureStore into memory.
//  * One-time migration: if SecureStore is empty, migrates tokens from AsyncStorage (legacy).
//  * MUST be called on app startup before any token access!
//  */
// export const initStorage = async (): Promise<void> => {
//   try {
//     let [accessToken, refreshToken] = await Promise.all([
//       SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN),
//       SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
//     ]);

//     // One-time migration: existing users may have tokens only in AsyncStorage
//     if (!accessToken && !refreshToken) {
//       const [legacyAccess, legacyRefresh] = await Promise.all([
//         AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
//         AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
//       ]);
//       if (legacyAccess || legacyRefresh) {
//         accessToken = legacyAccess;
//         refreshToken = legacyRefresh;
//         console.log('[TokenStorage] Migrating tokens from AsyncStorage to SecureStore');
//         await Promise.all([
//           accessToken ? SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken) : Promise.resolve(),
//           refreshToken ? SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken) : Promise.resolve(),
//         ]);
//         await AsyncStorage.multiRemove([STORAGE_KEYS.ACCESS_TOKEN, STORAGE_KEYS.REFRESH_TOKEN]);
//       }
//     }

//     tokenStorage.access_token = accessToken;
//     tokenStorage.refresh_token = refreshToken;
//     console.log('[TokenStorage] Loaded tokens from SecureStore:', {
//       hasAccessToken: !!accessToken,
//       hasRefreshToken: !!refreshToken,
//     });
//   } catch (error) {
//     console.error('[TokenStorage] Failed to load tokens from SecureStore:', error);
//     Sentry.captureException(error, { data: { context: 'tokenUtils.initStorage' } });
//     // Keep in-memory storage as fallback
//     console.log('[TokenStorage] Using in-memory storage fallback');
//   }
// };

// /**
//  * Decoded JWT payload structure
//  */
// export interface DecodedToken {
//   exp: number; // Expiration timestamp (Unix)
//   iat: number; // Issued at timestamp (Unix)
//   user_id?: number;
//   token_type?: string;
//   jti?: string; // JWT ID
// }

// /**
//  * Token state returned by getTokenState
//  */
// export interface TokenState {
//   accessToken: string | null;
//   refreshToken: string | null;
//   accessTokenExp: number | null; // Unix timestamp
//   refreshTokenExp: number | null; // Unix timestamp
// }

// /**
//  * Get current token state (synchronous - reads from memory)
//  * Includes optional expiration times if tokens can be decoded
//  */
// export function getTokenState(): TokenState {
//   const access = tokenStorage.access_token;
//   const refresh = tokenStorage.refresh_token;

//   return {
//     accessToken: access,
//     refreshToken: refresh,
//     accessTokenExp: access ? getTokenExpiration(access) : null,
//     refreshTokenExp: refresh ? getTokenExpiration(refresh) : null,
//   };
// }

// /**
//  * Store tokens in both memory and SecureStore
//  * @param accessToken JWT access token
//  * @param refreshToken JWT refresh token
//  */
// export async function storeTokens(accessToken: string, refreshToken: string): Promise<void> {
//   // Update in-memory cache immediately
//   tokenStorage.access_token = accessToken;
//   tokenStorage.refresh_token = refreshToken;

//   console.log('[TokenStorage] Saving tokens:', {
//     hasAccessToken: !!accessToken,
//     hasRefreshToken: !!refreshToken,
//   });

//   try {
//     await Promise.all([
//       SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken),
//       SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken),
//     ]);
//     console.log('[TokenStorage] Tokens saved to SecureStore');
//   } catch (error) {
//     console.error('[TokenStorage] Failed to save tokens to SecureStore:', error);
//     Sentry.captureException(error, { data: { context: 'tokenUtils.storeTokens' } });
//     // In-memory storage still works as fallback
//   }
// }

// /**
//  * Clear all auth tokens from both memory and SecureStore
//  * Also cleans up legacy keys from AsyncStorage for backward compatibility
//  */
// export async function clearTokens(): Promise<void> {
//   // Clear in-memory cache immediately
//   tokenStorage.access_token = null;
//   tokenStorage.refresh_token = null;

//   try {
//     await Promise.all([
//       SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN),
//       SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
//     ]);
//     console.log('[TokenStorage] Tokens cleared from SecureStore');
//   } catch (error) {
//     console.error('[TokenStorage] Failed to clear tokens from SecureStore:', error);
//     Sentry.captureException(error, { data: { context: 'tokenUtils.clearTokens' } });
//   }

//   // Clean up legacy keys that may still exist in AsyncStorage
//   try {
//     await AsyncStorage.multiRemove(STORAGE_KEYS.LEGACY_KEYS);
//     console.log('[TokenStorage] Legacy keys cleared from AsyncStorage');
//   } catch (legacyError) {
//     console.warn('[TokenStorage] Failed to clear legacy keys from AsyncStorage:', legacyError);
//   }
// }

// /**
//  * Get access token from memory (synchronous)
//  * Returns null if initStorage() hasn't been called
//  */
// export function getAccessToken(): string | null {
//   return tokenStorage.access_token;
// }

// /**
//  * Get refresh token from memory (synchronous)
//  * Returns null if initStorage() hasn't been called
//  */
// export function getRefreshToken(): string | null {
//   return tokenStorage.refresh_token;
// }

// /**
//  * Check if a refresh token exists (synchronous)
//  * This is the single source of truth for login status
//  */
// export function hasValidRefreshToken(): boolean {
//   const refreshToken = tokenStorage.refresh_token;
//   return (refreshToken ?? '').length > 0;
// }

// /**
//  * Async version of hasValidRefreshToken that ensures storage is initialized
//  * Use this for initial auth checks
//  */
// export async function checkHasValidRefreshToken(): Promise<boolean> {
//   await initStorage();
//   return hasValidRefreshToken();
// }

// /**
//  * Decode JWT payload without verification
//  * This is safe because we only use it for reading expiration time,
//  * not for authorization decisions.
//  *
//  * @param token JWT token string
//  * @returns Decoded payload or null if decode fails
//  */
// export function decodeJwtPayload(token: string): DecodedToken | null {
//   try {
//     const parts = token.split('.');
//     if (parts.length !== 3) {
//       return null;
//     }

//     // JWT payload is the second part (base64url encoded)
//     const payload = parts[1];

//     // Convert base64url to base64
//     const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');

//     // Decode base64
//     const jsonPayload = decodeBase64(base64);

//     return JSON.parse(jsonPayload);
//   } catch (_error) {
//     // Graceful fallback - token might not be a valid JWT
//     return null;
//   }
// }

// /**
//  * Decode base64 string (works in React Native without atob)
//  */
// function decodeBase64(base64: string): string {
//   const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
//   let output = '';

//   // Add padding if needed
//   const padding = 4 - (base64.length % 4);
//   if (padding !== 4) {
//     base64 += '='.repeat(padding);
//   }

//   for (let i = 0; i < base64.length; i += 4) {
//     const enc1 = chars.indexOf(base64.charAt(i));
//     const enc2 = chars.indexOf(base64.charAt(i + 1));
//     const enc3 = chars.indexOf(base64.charAt(i + 2));
//     const enc4 = chars.indexOf(base64.charAt(i + 3));

//     const chr1 = (enc1 << 2) | (enc2 >> 4);
//     const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
//     const chr3 = ((enc3 & 3) << 6) | enc4;

//     output += String.fromCharCode(chr1);
//     if (enc3 !== 64) output += String.fromCharCode(chr2);
//     if (enc4 !== 64) output += String.fromCharCode(chr3);
//   }

//   return output;
// }

// /**
//  * Check if a token is expired
//  *
//  * @param token JWT token string
//  * @param bufferSeconds Seconds before actual expiry to consider as expired (default: 60)
//  * @returns true if expired, false if valid, null if cannot determine
//  */
// export function isTokenExpired(token: string, bufferSeconds: number = 60): boolean | null {
//   const decoded = decodeJwtPayload(token);
//   if (!decoded || !decoded.exp) {
//     return null; // Cannot determine - let server validate
//   }

//   const nowSeconds = Math.floor(Date.now() / 1000);
//   return decoded.exp - bufferSeconds <= nowSeconds;
// }

// /**
//  * Get token expiration timestamp
//  *
//  * @param token JWT token string
//  * @returns Unix timestamp of expiration, or null if cannot decode
//  */
// export function getTokenExpiration(token: string): number | null {
//   const decoded = decodeJwtPayload(token);
//   return decoded?.exp ?? null;
// }

// /**
//  * Get time remaining until token expires
//  *
//  * @param token JWT token string
//  * @returns Seconds until expiration, negative if expired, null if cannot determine
//  */
// export function getTokenTimeRemaining(token: string): number | null {
//   const exp = getTokenExpiration(token);
//   if (exp === null) {
//     return null;
//   }

//   const nowSeconds = Math.floor(Date.now() / 1000);
//   return exp - nowSeconds;
// }
