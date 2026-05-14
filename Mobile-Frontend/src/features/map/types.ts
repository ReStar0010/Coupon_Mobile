/**
 * Marker-level type used only for pin rendering on the map.
 *
 * Full per-merchant detail (`myCoupons` / `sharedCoupons` / `news`) lives on
 * the `MerchantDetail` type exported from `src/services/api/merchants.ts` —
 * fetched lazily when a pin is tapped.
 */
export interface MapMerchant {
  id: string;
  name: string;
  lat: number;
  lng: number;
  couponCount: number;
  active: boolean;
  big?: boolean;
}
