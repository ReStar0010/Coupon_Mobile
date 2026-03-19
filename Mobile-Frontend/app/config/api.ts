export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || 'https://coupon-mobile.onrender.com';

export const API_URL = `${API_BASE_URL}/api`;

export const getApiConfig = () => ({ baseUrl: API_BASE_URL, apiUrl: API_URL });

if (process.env.NODE_ENV !== 'production') {
  console.log('\n🔧 [API Config]', JSON.stringify(getApiConfig(), null, 2), '\n');
}
