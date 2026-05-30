import type { ApiRequestError } from './errors';

const ERROR_MESSAGES: Record<string, string> = {
  SPIN_RATE_LIMITED: '轉太快了，稍等一下再試',
  WALLET_GEMS_DESYNC: '寶石數量不同步，正在重新整理…',
  NO_GEMS_TO_SPIN: '寶石不足，無法轉動',
  INVALID_BET: '下注金額需在 1~5 之間',
  INSUFFICIENT_GEMS: '寶石不足',
  SESSION_EXPIRED: '登入已過期，請重新登入',
  RATE_LIMITED: '操作太頻繁，請稍後再試',
  NOT_AUTHENTICATED: '請先登入',
  AUTHENTICATION_FAILED: '驗證失敗，請重新登入',
  INTERNAL: '系統忙碌，請稍後再試',
  NICKNAME_REQUIRED: '請先設定暱稱，才能分享到 CouMap',
};

export function localizeError(err: unknown, fallback?: string): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as ApiRequestError).code;
    if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  }
  return fallback ?? '發生錯誤，請稍後再試';
}
