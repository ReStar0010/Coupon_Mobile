import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { unifiedRedemptionAPI, platformVoucherAPI } from '@/app/utils/authAPI';
import { useApiError } from '@/app/hooks/useApiError';
import Toast from '../[id]/redeem/Toast';
import SuccessPopup from '../[id]/redeem/SuccessPopup';

// Define the coupon interface matching the API response
interface AvailableCoupon {
  id: number;
  coupon_name: string;
  coupon_detail: string;
  coupon_type: 'store' | 'exclusive';
  store_name: string;
  expiry_date: string;
  estimated_savings?: number;
  is_redeemed: boolean;
}

/** Platform voucher from unified redemption response (available_platform_vouchers) */
interface AvailablePlatformVoucher {
  id: number;
  face_value: string;
  redeem_code: string;
  expiry_date: string;
  batch_name: string;
}

interface StoreInfo {
  id: number;
  name: string;
  address?: string;
}

const DEFAULT_IMAGE_URL =
  'https://api.iconify.design/material-symbols:storefront-rounded.svg?color=%23ffad31';

export default function UnifiedRedeemScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { getErrorMessage } = useApiError();
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [availableCoupons, setAvailableCoupons] = useState<AvailableCoupon[]>([]);
  const [availablePlatformVouchers, setAvailablePlatformVouchers] = useState<AvailablePlatformVoucher[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorToastMessage, setErrorToastMessage] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [redeemedCoupon, setRedeemedCoupon] = useState<AvailableCoupon | null>(null);
  const [redeemedVoucher, setRedeemedVoucher] = useState<AvailablePlatformVoucher | null>(null);
  const [redemptionData, setRedemptionData] = useState<{
    couponName?: string;
    discountValue?: number | string;
    redeemedAt?: string;
    redemptionId?: number;
  } | null>(null);

  useEffect(() => {
    const fetchCoupons = async () => {
      if (!code) {
        setError('缺少核銷碼');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const response = await unifiedRedemptionAPI.validateUnifiedRedemptionCode(code);

        setStore(response.store);
        setAvailableCoupons(response.available_coupons || []);
        setAvailablePlatformVouchers(response.available_platform_vouchers || []);
      } catch (err: unknown) {
        console.error('Failed to validate unified redemption code:', err);
        const errorMessage = getErrorMessage(err);
        setError(errorMessage);
        setErrorToastMessage(errorMessage);
        setShowErrorToast(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCoupons();
  }, [code]);

  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleCouponPress = useCallback(
    async (coupon: AvailableCoupon) => {
      if (!code || isRedeeming) return;

      setIsRedeeming(true);
      setError(null);
      setShowErrorToast(false);

      try {
        // Auto-redeem immediately using unified redemption API
        const response = await unifiedRedemptionAPI.redeemCouponWithUnifiedCode(coupon.id, code);

        // Store redeemed coupon info for success popup
        setRedeemedCoupon(coupon);

        // Store redemption data from API response
        setRedemptionData({
          couponName: response.coupon_name,
          discountValue: response.savings_amount,
          redeemedAt: response.redeemed_at,
          redemptionId: response.redemption_id,
        });

        setShowSuccessPopup(true);
      } catch (err) {
        console.error('Failed to redeem coupon:', err);
        const errorMessage = getErrorMessage(err);
        setError(errorMessage);
        setErrorToastMessage(errorMessage);
        setShowErrorToast(true);
      } finally {
        setIsRedeeming(false);
      }
    },
    [code, isRedeeming, getErrorMessage],
  );

  const handleVoucherPress = useCallback(
    async (voucher: AvailablePlatformVoucher) => {
      if (!code || isRedeeming) return;

      setIsRedeeming(true);
      setError(null);
      setShowErrorToast(false);

      try {
        await platformVoucherAPI.redeem(voucher.id, code);
        setRedeemedVoucher(voucher);
        setRedemptionData({
          couponName: '平台現金券',
          discountValue: voucher.face_value,
        });
        setShowSuccessPopup(true);
      } catch (err: any) {
        console.error('Failed to redeem platform voucher:', err);
        const errorMessage = err?.response?.data?.error || '兌換失敗，請稍後再試';
        setError(errorMessage);
        setErrorToastMessage(errorMessage);
        setShowErrorToast(true);
      } finally {
        setIsRedeeming(false);
      }
    },
    [code, isRedeeming],
  );

  const handleCloseSuccessPopup = useCallback(() => {
    setShowSuccessPopup(false);
    setRedeemedCoupon(null);
    setRedeemedVoucher(null);
    setRedemptionData(null);
    router.push('/(tabs)/collection');
  }, [router]);

  const handleHideErrorToast = useCallback(() => {
    setShowErrorToast(false);
    setErrorToastMessage('');
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return dateString || '';
    }
  };

  const renderCouponItem = useCallback(
    ({ item }: { item: AvailableCoupon }) => (
      <TouchableOpacity
        style={[styles.couponCard, isRedeeming && styles.couponCardDisabled]}
        onPress={() => handleCouponPress(item)}
        activeOpacity={0.7}
        disabled={isRedeeming}
      >
        <View style={styles.couponContent}>
          <Image
            source={{ uri: DEFAULT_IMAGE_URL }}
            style={styles.couponImage}
            resizeMode="cover"
          />
          <View style={styles.couponInfo}>
            <>
              <Text style={styles.storeName} numberOfLines={1}>
                {item.store_name || ''}
              </Text>
              <Text style={styles.couponName} numberOfLines={2}>
                {item.coupon_name || ''}
              </Text>
              {item.coupon_detail ? (
                <Text style={styles.couponDetail} numberOfLines={2}>
                  {item.coupon_detail}
                </Text>
              ) : null}
              <View style={styles.couponMeta}>
                <Text style={styles.expiryDate}>有效期限: {formatDate(item.expiry_date)}</Text>
                {item.estimated_savings ? (
                  <Text style={styles.savings}>預估節省: ${item.estimated_savings.toFixed(0)}</Text>
                ) : null}
              </View>
              {isRedeeming && (
                <View style={styles.redeemingIndicator}>
                  <ActivityIndicator size="small" color="#FFAD31" />
                  <Text style={styles.redeemingText}>處理中...</Text>
                </View>
              )}
            </>
          </View>
        </View>
      </TouchableOpacity>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isRedeeming intentionally omitted
    [handleCouponPress],
  );

  const renderVoucherItem = useCallback(
    ({ item }: { item: AvailablePlatformVoucher }) => {
      const faceVal = String(item.face_value ?? '');
      const dotIdx = faceVal.indexOf('.');
      const valueInt = dotIdx >= 0 ? faceVal.slice(0, dotIdx) : faceVal;
      const valueDec = dotIdx >= 0 ? faceVal.slice(dotIdx) : '';
      return (
        <TouchableOpacity
          style={[styles.voucherCard, isRedeeming && styles.couponCardDisabled]}
          onPress={() => handleVoucherPress(item)}
          activeOpacity={0.75}
          disabled={isRedeeming}
        >
          <View style={styles.voucherLeftAccent} />
          <View style={styles.voucherAmountBlock}>
            <Text style={styles.voucherCurrencySymbol}>NT$</Text>
            <View style={styles.voucherAmountRow}>
              <Text style={styles.voucherAmountInt}>{valueInt}</Text>
              {valueDec ? <Text style={styles.voucherAmountDec}>{valueDec}</Text> : null}
            </View>
          </View>
          <View style={styles.voucherInfo}>
            <Text style={styles.voucherLabel}>平台現金券</Text>
            {item.batch_name ? (
              <Text style={styles.couponName} numberOfLines={1}>
                {item.batch_name}
              </Text>
            ) : null}
            <View style={styles.couponMeta}>
              <Text style={styles.expiryDate}>有效期限: {formatDate(item.expiry_date)}</Text>
            </View>
            {isRedeeming && (
              <View style={styles.redeemingIndicator}>
                <ActivityIndicator size="small" color="#FFAD31" />
                <Text style={styles.redeemingText}>處理中...</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [handleVoucherPress, isRedeeming],
  );

  const voucherKeyExtractor = useCallback((item: AvailablePlatformVoucher) => `voucher-${item.id}`, []);

  const hasAnyItems =
    availableCoupons.length > 0 || availablePlatformVouchers.length > 0;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFAD31" />
          <Text style={styles.loadingText}>載入中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !store) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton} activeOpacity={0.7}>
            <ArrowLeft size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>選擇優惠券</Text>
          </View>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleGoBack} activeOpacity={0.7}>
            <Text style={styles.retryButtonText}>返回</Text>
          </TouchableOpacity>
        </View>
        <Toast
          visible={showErrorToast}
          message={errorToastMessage}
          onHide={handleHideErrorToast}
          type="error"
          duration={4000}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton} activeOpacity={0.7}>
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>選擇優惠券</Text>
          {store && <Text style={styles.headerSubtitle}>{store.name}</Text>}
        </View>
      </View>

      {/* Store Info Banner */}
      {store && code && (
        <View style={styles.storeBanner}>
          <Text style={styles.storeBannerTitle}>統一核銷碼: {code}</Text>
          {store.address && <Text style={styles.storeBannerAddress}>{store.address}</Text>}
        </View>
      )}

      {/* Coupon and voucher lists */}
      {!hasAnyItems ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>沒有可用的優惠券與現金券</Text>
          <Text style={styles.emptySubtext}>
            您目前沒有可在此店家兌換的優惠券或平台現金券
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {availableCoupons.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>可核銷的優惠券</Text>
              {availableCoupons.map((item) => (
                <View key={item.id}>{renderCouponItem({ item })}</View>
              ))}
            </>
          )}
          {availablePlatformVouchers.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, availableCoupons.length > 0 && styles.sectionTitleSpaced]}>
                可核銷的現金券
              </Text>
              {availablePlatformVouchers.map((item) => (
                <View key={voucherKeyExtractor(item)}>{renderVoucherItem({ item })}</View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      <Toast
        visible={showErrorToast}
        message={errorToastMessage}
        onHide={handleHideErrorToast}
        type="error"
        duration={4000}
      />

      {/* Success Popup */}
      <SuccessPopup
        isOpen={showSuccessPopup}
        onClose={handleCloseSuccessPopup}
        storeName={
          redeemedCoupon?.store_name ?? (redeemedVoucher && store ? store.name : undefined)
        }
        couponDetail={redeemedCoupon?.coupon_detail}
        couponName={
          redemptionData?.couponName ||
          redeemedCoupon?.coupon_name ||
          (redeemedVoucher ? '平台現金券' : undefined)
        }
        discountValue={
          redemptionData?.discountValue ?? redeemedCoupon?.estimated_savings
        }
        redeemedAt={redemptionData?.redeemedAt}
        redemptionId={redemptionData?.redemptionId}
        titleType="核銷成功"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  storeBanner: {
    backgroundColor: '#FFAD31',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
  },
  storeBannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  storeBannerAddress: {
    fontSize: 14,
    color: '#333',
    opacity: 0.9,
  },
  scrollView: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  sectionTitleSpaced: {
    marginTop: 24,
  },
  voucherCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  voucherLeftAccent: {
    width: 4,
    backgroundColor: '#FFAD31',
  },
  voucherAmountBlock: {
    width: 88,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingVertical: 12,
  },
  voucherCurrencySymbol: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFAD31',
    marginBottom: 2,
  },
  voucherAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  voucherAmountInt: {
    fontSize: 20,
    fontWeight: '800',
    color: '#065f46',
    letterSpacing: -0.5,
  },
  voucherAmountDec: {
    fontSize: 14,
    fontWeight: '700',
    color: '#047857',
    marginLeft: 1,
  },
  voucherInfo: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  voucherLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFAD31',
    marginBottom: 4,
  },
  couponCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  couponCardDisabled: {
    opacity: 0.6,
  },
  couponContent: {
    flexDirection: 'row',
    padding: 16,
  },
  couponImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
    backgroundColor: '#f8f9fa',
  },
  couponInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  storeName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  couponName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  couponDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  couponMeta: {
    marginTop: 8,
  },
  expiryDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  savings: {
    fontSize: 12,
    color: '#FFAD31',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#FFAD31',
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  redeemingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  redeemingText: {
    fontSize: 14,
    color: '#FFAD31',
    fontWeight: '600',
  },
});
