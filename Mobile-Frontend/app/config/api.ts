/**
 * API 配置
 * 模式: 'production' | 'local' | 'local-network'
 */
type BackendMode = 'production' | 'local' | 'local-network';

const PROD_FALLBACK_URL = 'https://coupon-mobile.onrender.com';

// 1. 集中讀取與處理環境變數
const ENV = {
  MODE: (process.env.EXPO_PUBLIC_BACKEND_MODE ?? 'production') as BackendMode,
  PORT: Number(process.env.EXPO_PUBLIC_LOCAL_PORT ?? 8000),
  HOST: (process.env.EXPO_PUBLIC_LOCAL_HOST ?? '').trim(),
  PROD_URL: (process.env.EXPO_PUBLIC_API_URL ?? '').trim(),
};

// 2. 工具函數：標準化 URL (移除結尾斜線，確保有 protocol)
const normalizeUrl = (url: string): string => {
  if (!url) return '';
  const hasProtocol = url.startsWith('http://') || url.startsWith('https://');
  return (hasProtocol ? url : `https://${url}`).replace(/\/+$/, '');
};

// 3. 核心邏輯：解析 Base URL
const resolveBaseUrl = (): string => {
  switch (ENV.MODE) {
    case 'local':
      return `http://localhost:${ENV.PORT}`;

    case 'local-network': {
      if (!ENV.HOST) {
        throw new Error('[API Config] Missing EXPO_PUBLIC_LOCAL_HOST for local-network mode.');
      }
      // 判斷是否為 Tunnel (包含 domain 特徵或已指定 protocol)
      const isTunnel = /^(http|https):|\.(loca\.lt|ngrok)/.test(ENV.HOST);
      return isTunnel ? normalizeUrl(ENV.HOST) : `http://${ENV.HOST}:${ENV.PORT}`;
    }

    case 'production':
    default:
      return normalizeUrl(ENV.PROD_URL || PROD_FALLBACK_URL);
  }
};

const API_BASE_URL = resolveBaseUrl();

export const API_URL = `${API_BASE_URL}/api`;

// 4. 調試與 Log (僅在非 Production 顯示)
export const getApiConfig = () => ({ mode: ENV.MODE, baseUrl: API_BASE_URL, apiUrl: API_URL });

if (process.env.NODE_ENV !== 'production') {
  console.log('\n🔧 [API Config]', JSON.stringify(getApiConfig(), null, 2), '\n');
}
