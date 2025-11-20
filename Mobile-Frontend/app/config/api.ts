/**
 * API 配置
 * 
 * 使用方式：
 * 1. 修改 BACKEND_MODE 來切換不同的後端
 * 2. 如果使用 'local-network'，請設置 YOUR_LOCAL_IP
 * 
 * 模式說明：
 * - 'production': 使用 Render.com 生產環境
 * - 'local': 使用 localhost (僅適用於模擬器/瀏覽器)
 * - 'local-network': 使用本地網絡 IP (適用於 Expo Go 在真實設備上)
 */

// ============================================
// 🔧 配置區域 - 在這裡修改後端設置
// ============================================

// 選擇後端模式：'production' | 'local' | 'local-network'
const BACKEND_MODE = 'local-network' as 'production' | 'local' | 'local-network';

// 如果使用 'local-network'，請設置您的本地 IP 地址
// Windows: 在 PowerShell 中運行 `ipconfig` 查看 IPv4 地址
// Mac/Linux: 在終端中運行 `ifconfig` 或 `ip addr` 查看 IP 地址
const YOUR_LOCAL_IP = 'coupro-123.loca.lt'; // 替換為您的實際 IP 地址

// ============================================
// 自動配置（不需要修改）
// ============================================

let API_BASE_URL: string;

switch (BACKEND_MODE) {
  case 'production':
    // 優先使用環境變數，如果沒有則使用生產環境 URL
    API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://coupon-mobile.onrender.com';
    break;
  
  case 'local':
    // 使用 localhost（僅適用於模擬器或瀏覽器）
    API_BASE_URL = 'http://localhost:8000';
    break;
  
  case 'local-network':
    // 使用本地網絡 IP（適用於 Expo Go 在真實設備上）
    // 如果是 tunnel URL (.loca.lt 或 .ngrok)，不需要添加端口
    const isTunnel = YOUR_LOCAL_IP.includes('.loca.lt') || YOUR_LOCAL_IP.includes('.ngrok');
    API_BASE_URL = isTunnel 
      ? `https://${YOUR_LOCAL_IP}`      // Tunnel：不需要端口
      : `http://${YOUR_LOCAL_IP}:8000`; // 本地 IP：需要端口和 http
    break;
  
  default:
    API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://coupon-mobile.onrender.com';
}

export const API_URL = `${API_BASE_URL}/api`;

// 導出用於調試
export const getApiConfig = () => ({
  mode: BACKEND_MODE,
  baseUrl: API_BASE_URL,
  apiUrl: API_URL,
});

// 在開發模式下打印當前配置
if (process.env.NODE_ENV !== 'production') {
  const config = getApiConfig();
  console.log('\n' + '='.repeat(50));
  console.log('🔧 當前後端配置');
  console.log('='.repeat(50));
  console.log(`模式: ${config.mode}`);
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`API URL: ${config.apiUrl}`);
  console.log('='.repeat(50) + '\n');
}
