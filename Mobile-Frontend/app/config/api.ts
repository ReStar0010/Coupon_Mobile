let API_BASE_URL = "https://coupon-mobile.onrender.com";

// API_BASE_URL = "https://coupon-mobile-dev.onrender.com";
// let API_BASE_URL = "https://coupro-123.loca.lt";

export const API_URL = `${API_BASE_URL}/api`;

export const getApiConfig = () => ({ baseUrl: API_BASE_URL, apiUrl: API_URL });

if (process.env.NODE_ENV !== 'production') {
  console.log('\n🔧 [API Config]', JSON.stringify(getApiConfig(), null, 2), '\n');
}
