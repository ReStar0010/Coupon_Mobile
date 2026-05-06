import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function setTokens(access: string, refresh: string): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(ACCESS_TOKEN_KEY, access),
    AsyncStorage.setItem(REFRESH_TOKEN_KEY, refresh),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(ACCESS_TOKEN_KEY),
    AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
  ]);
}
