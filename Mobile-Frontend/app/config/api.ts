const PRODUCTION_URL = process.env.EXPO_PUBLIC_API_URL;
const STAGING_URL = process.env.EXPO_STAGING_API_URL;

// Default production; staging only when EXPO_PUBLIC_USE_STAGING_API exists and is exactly "true"
const useStaging = process.env.EXPO_PUBLIC_USE_STAGING_API === 'true';

const API_BASE_URL = useStaging ? STAGING_URL : PRODUCTION_URL;
export const API_URL = `${API_BASE_URL}/api`;

export const getApiConfig = () => ({ baseUrl: API_BASE_URL, apiUrl: API_URL });

if (process.env.NODE_ENV !== 'production') {
  console.log('\n🔧 [API Config]', JSON.stringify(getApiConfig(), null, 2), '\n');
}
