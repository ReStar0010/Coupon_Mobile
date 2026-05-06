export interface MapMerchant {
  id: string;
  name: string;
  lat: number;
  lng: number;
  couponCount: number;
  active: boolean;
  big?: boolean;
}
