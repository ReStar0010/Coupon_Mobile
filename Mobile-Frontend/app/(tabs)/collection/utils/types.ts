// Types and interfaces for Collection components

export type CouponType = {
  className?: string;
  id?: number;
  storeName: string; // 店家名稱
  couponName: string; // 優惠名稱
  description: string; // 優惠內容
  importantNotes?: string; // 注意事項
  startDate: Date; // 有效期限開始
  expiryDate: Date; // 有效期限結束
  couponType: 'store' | 'exclusive'; // 優惠類型: 隨取及用 or 專屬優惠
  sourceUser?: string; // 來源用戶 (如果是朋友贈送的專屬優惠)
  imageUrl?: string; // 店家圖片或優惠券圖片的URL
  tags?: string[]; // 標籤，用於分類搜尋（例如：["飲料", "咖啡"]）
  acquisitionMethod?: string; // 取得方式 (draw, consolidate, transfer, public_pool, qr_claim)
  storeId?: number; // 店家ID，用於判斷商家是否已刪除
  merchantDeleted?: boolean; // 商家是否已刪除帳號
};

// 接口以匹配後端 API 回應
export interface ApiCoupon {
  id: number;
  store_name: string;
  store_id: number;
  coupon_name: string;
  coupon_detail: string;
  important_notes?: string;
  start_date: string;
  expiry_date: string;
  coupon_type: 'store' | 'exclusive';
  estimated_savings: number | null;
  redeem_code?: string;
  image_url?: string;
  original_owner?: string; // User email or ID
  current_holder?: string; // User email or ID
  template_id?: number;
  is_redeemed: boolean; // This is a computed property
  tags?: string[]; // 標籤，用於分類搜尋（例如：["飲料", "咖啡"]）
  acquisition_method?: string; // 取得方式 (draw, consolidate, transfer, public_pool, qr_claim)
  merchant_deleted?: boolean; // 商家是否已刪除帳號
}

// Interface for shared coupons
export interface ShareRequestInfo {
  coupon_id: number;
  coupon_name: string;
  from_user_email: string;
  status: string;
}

// Interface for shared platform voucher (GET /api/platform-voucher/share/<token>/)
export interface VoucherShareRequestInfo {
  voucher_id: number;
  face_value: string;
  currency_code: string;
  from_user_email: string;
  status: string;
  is_public?: boolean;
}

// Interface for daily draw template
export interface DrawTemplate {
  id: number;
  store_id: number;
  store_name: string;
  coupon_name: string;
  image_url: string | null;
  estimated_savings: number | null;
  expiry_date: string;
  remaining_quantity: number;
}

// Interface for daily draw result
export interface DailyDrawResult {
  success: boolean;
  coupon?: {
    id: number;
    name: string;
  };
  message: string;
}

// Filter types
export type ExpiryFilter = 'all' | 'expiringSoon' | 'thisWeek' | 'thisMonth';
