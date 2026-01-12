import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { unifiedRedemptionAPI } from '../../utils/authAPI';
import Toast from '../[id]/redeem/Toast';

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
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [availableCoupons, setAvailableCoupons] = useState<AvailableCoupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorToastMessage, setErrorToastMessage] = useState('');

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
      } catch (err: any) {
        console.error('Failed to validate unified redemption code:', err);
        const errorMessage = err?.response?.data?.error || '無效的統一核銷碼';
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
    (coupon: AvailableCoupon) => {
      // Navigate to redemption page with coupon ID and auto-filled unified code
      router.push({
        pathname: `/EasyUse/${coupon.id}/redeem`,
        params: { unifiedCode: code },
      });
    },
    [code, router]
  );

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
        style={styles.couponCard}
        onPress={() => handleCouponPress(item)}
        activeOpacity={0.7}>
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
                <Text style={styles.expiryDate}>
                  有效期限: {formatDate(item.expiry_date)}
                </Text>
                {item.estimated_savings ? (
                  <Text style={styles.savings}>
                    預估節省: ${item.estimated_savings.toFixed(0)}
                  </Text>
                ) : null}
              </View>
            </>
          </View>
        </View>
      </TouchableOpacity>
    ),
    [handleCouponPress]
  );

  const keyExtractor = useCallback((item: AvailableCoupon) => item.id.toString(), []);

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
          <TouchableOpacity
            onPress={handleGoBack}
            style={styles.backButton}
            activeOpacity={0.7}>
            <ArrowLeft size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>選擇優惠券</Text>
          </View>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleGoBack}
            activeOpacity={0.7}>
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
        <TouchableOpacity
          onPress={handleGoBack}
          style={styles.backButton}
          activeOpacity={0.7}>
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
          {store.address && (
            <Text style={styles.storeBannerAddress}>{store.address}</Text>
          )}
        </View>
      )}

      {/* Coupon List */}
      {availableCoupons.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>沒有可用的優惠券</Text>
          <Text style={styles.emptySubtext}>
            您目前沒有可兌換的優惠券
          </Text>
        </View>
      ) : (
        <FlatList
          data={availableCoupons}
          renderItem={renderCouponItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

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
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
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
});
