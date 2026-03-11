/**
 * API 配置
 *
 * 生產環境 URL 永遠寫死在程式碼中，確保 production build 絕不會使用錯誤的後端。
 * Staging 僅在 __DEV__ 模式下可透過 EXPO_PUBLIC_USE_STAGING 開啟，不影響 production/development build。
 *
 * 模式: 'production' | 'local' | 'local-network'
 */
type BackendMode = 'production' | 'local' | 'local-network';

/** 生產環境 API URL - 寫死於程式碼，production build 永遠使用此 */
const PRODUCTION_API_URL = 'https://coupon-mobile.onrender.com';

// 1. 集中讀取與處理環境變數（僅在 __DEV__ 時有意義）
const ENV = {
  MODE: (process.env.EXPO_PUBLIC_BACKEND_MODE ?? 'production') as BackendMode,
  PORT: Number(process.env.EXPO_PUBLIC_LOCAL_PORT ?? 8000),
  HOST: (process.env.EXPO_PUBLIC_LOCAL_HOST ?? '').trim(),
  USE_STAGING: process.env.EXPO_PUBLIC_USE_STAGING === 'true',
  STAGING_URL: (process.env.EXPO_PUBLIC_STAGING_API_URL ?? '').trim(),
  DEV_OVERRIDE_URL: (process.env.EXPO_PUBLIC_API_URL ?? '').trim(),
};

// 2. 工具函數：標準化 URL (移除結尾斜線，確保有 protocol)
const normalizeUrl = (url: string): string => {
  if (!url) return '';
  const hasProtocol = url.startsWith('http://') || url.startsWith('https://');
  return (hasProtocol ? url : `https://${url}`).replace(/\/+$/, '');
};

// 3. 核心邏輯：解析 Base URL
const resolveBaseUrl = (): string => {
  // Production 與 release build：永遠使用生產 URL，忽略所有 env
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    return normalizeUrl(PRODUCTION_API_URL);
  }

  switch (ENV.MODE) {
    case 'local':
      return `http://localhost:${ENV.PORT}`;

    case 'local-network': {
      return normalizeUrl(ENV.HOST);
    }

    case 'production':
    default: {
      // 僅在 __DEV__ 時：可選 staging 或 dev override
      if (ENV.USE_STAGING && ENV.STAGING_URL) {
        return normalizeUrl(ENV.STAGING_URL);
      }
      if (ENV.DEV_OVERRIDE_URL) {
        return normalizeUrl(ENV.DEV_OVERRIDE_URL);
      }
      return normalizeUrl(PRODUCTION_API_URL);
    }
  }
};

const API_BASE_URL = resolveBaseUrl();

export const API_URL = `${API_BASE_URL}/api`;

// 4. 調試與 Log (僅在非 Production 顯示)
export const getApiConfig = () => ({
  mode: ENV.MODE,
  baseUrl: API_BASE_URL,
  apiUrl: API_URL,
});

if (process.env.NODE_ENV !== 'production') {
  console.log('\n🔧 [API Config]', JSON.stringify(getApiConfig(), null, 2), '\n');
}
