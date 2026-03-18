import React, { useEffect, useState, useCallback } from 'react';
import * as Sentry from '@sentry/react-native';
import { Alert, Linking, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';

// 位置權限說明（此頁用於優惠券瀏覽分析，協助改善服務與推薦；未授權時不干擾用戶，僅不傳送位置）
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { ArrowLeft, MapPin, ShieldBan, ShieldCheck } from 'lucide-react-native';
import { YStack, XStack, ScrollView, Card, Text, Button, Spinner, View } from 'tamagui';
import SuccessPopup from './redeem/SuccessPopup';
import ShareModal from './components/ShareModal';
import ReportButton from '../../../components/ReportButton';
import { useBlockedMerchants } from '@/app/components/providers/BlockedMerchantsProvider';
import { isUserLoggedIn, fetchAPI } from '@/app/utils/authAPI';
import { useApiError } from '@/app/hooks/useApiError';
import { devLog } from '@/app/utils/devLogger';
import StatCard from '../../statistics/components/StatCard';
import { markCollectionDirty } from '@/app/utils/collectionRefresh';

export type CouponDetailType = {
  id: number;
  store_name: string;
  store_id: number;
  store_location: {
    lat: number;
    lng: number;
  };
  address: string;
  active_coupon_count: number;
  has_active_coupons: boolean;
  coupon_name: string;
  coupon_detail: string;
  important_notes?: string;
  start_date: string;
  expiry_date: string;
  coupon_type: 'store' | 'exclusive';
  template_id?: number | null; // Add template_id
  last_holder_email?: string;
  is_redeemed: boolean;
  can_use_today: boolean;
  tags?: string[]; // 標籤，用於分類搜尋（例如：["飲料", "咖啡"]）
  /** 取得方式：draw=CouPro, consolidate=電話歸戶, transfer=私人轉讓, public_pool=公共池領取, qr_claim=QR Code 領取；store 券通常為 null */
  acquisition_method?: string | null;
};

/** 後端 ACQUISITION_METHOD_CHOICES 對應顯示文字（與 Backend api/models Coupon 一致） */
const ACQUISITION_LABELS: Record<string, string> = {
  draw: 'CouPro',
  consolidate: '電話歸戶',
  transfer: '私人轉讓',
  public_pool: '公共池領取',
  qr_claim: 'QR Code 領取',
};

function getSourceDisplayText(coupon: CouponDetailType | null): string {
  if (!coupon) return 'CouPro';
  if (coupon.coupon_type === 'store') {
    return coupon.store_name ?? 'CouPro';
  }
  // exclusive: 依取得方式顯示來源
  switch (coupon.acquisition_method) {
    case 'consolidate':
      return coupon.store_name ?? ACQUISITION_LABELS.consolidate; // 電話歸戶：顯示歸戶的店家
    case 'transfer':
      return coupon.last_holder_email ?? ACQUISITION_LABELS.transfer; // 私人轉讓：顯示轉讓人
    case 'qr_claim':
      return coupon.store_name ?? ACQUISITION_LABELS.qr_claim; // QR 領取：顯示 QR 所在店家
    case 'draw':
    case 'public_pool':
      return ACQUISITION_LABELS[coupon.acquisition_method] ?? coupon.acquisition_method;
    default:
      if (coupon.last_holder_email) return coupon.last_holder_email;
      return 'CouPro';
  }
}

const CouponDetailPage: React.FC = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const params = useLocalSearchParams();
  const sourceParam = params.source as string;
  const { t } = useTranslation();
  const { getErrorMessage } = useApiError();

  const [coupon, setCoupon] = useState<CouponDetailType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [redemptionData, setRedemptionData] = useState<{
    couponName?: string;
    discountValue?: number;
    redeemedAt?: string;
    redemptionId?: number;
  } | null>(null);
  const [isBlockingStore, setIsBlockingStore] = useState(false);

  // Blocked Merchants context
  const { isStoreBlocked, blockStore, unblockStore } = useBlockedMerchants();

  // Track template view event
  const trackTemplateView = async (templateId: number, couponId: number) => {
    try {
      // Get user location if available
      let lat: number | undefined;
      let lng: number | undefined;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          lat = location.coords.latitude;
          lng = location.coords.longitude;
        }
        // 若未授權則不彈窗，避免每次進入詳情頁都打擾用戶；用途見上方 LOCATION_USAGE_MESSAGE
      } catch (locationError) {
        // Location permission denied or error, continue without location
        console.log('Location not available:', locationError);
      }

      // Call template view tracking API
      await fetchAPI('/events/template-view/', {
        method: 'POST',
        data: {
          template_id: templateId,
          coupon_id: couponId,
          lat: lat,
          lng: lng,
        },
      });

      devLog('Template view tracked:', { templateId, couponId, lat, lng });
    } catch (error) {
      // Silently fail - don't interrupt user experience
      console.error('Failed to track template view:', error);
      Sentry.captureException(error, { data: { context: 'easyuse.trackTemplateView' } });
    }
  };

  useEffect(() => {
    if (id) {
      const fetchCouponDetail = async () => {
        setIsLoading(true);
        setError(null);
        try {
          devLog('Fetching coupon with ID:', id);
          const response = await fetchAPI(`/coupons/${id}/`, {
            method: 'GET',
          });

          devLog('Fetched coupon details:', response.data);
          setCoupon(response.data);

          // Track template view event if template_id exists
          if (response.data.template_id) {
            trackTemplateView(response.data.template_id, response.data.id);
          }
        } catch (err) {
          devLog('Error fetching coupon:', err);
          if (isAxiosError(err) && err.response?.status === 401) {
            // AuthOrchestrator handles 401 silently
            return;
          }
          setError(getErrorMessage(err));
        } finally {
          setIsLoading(false);
        }
      };
      fetchCouponDetail();
    } else {
      setError(t('easyuse.invalidCouponId'));
      setIsLoading(false);
    }
  }, [id, getErrorMessage, t]);

  const onGoBackContainerClick = useCallback(() => {
    if (sourceParam === 'collection') {
      // Navigate directly to collection; single replace avoids race between two synchronous navigations.
      router.replace('/(tabs)/easyuse');
      router.replace('/(tabs)/collection');
    } else {
      router.back();
    }
  }, [router, sourceParam]);

  const onRedeemClick = async () => {
    if (coupon) {
      if (coupon.coupon_type === 'store') {
        // Check if the user is logged in before redeeming
        const userLoggedIn = await isUserLoggedIn();
        if (!userLoggedIn) {
          devLog('User not logged in. Redirecting to login page');
          const returnUrl = `/(tabs)/easyuse/${coupon.id}`;
          router.push({
            pathname: '/(auth)/login',
            params: { returnUrl },
          });
          return;
        }

        // For store coupons, redeem directly without a code
        try {
          setIsRedeeming(true);

          const response = await fetchAPI(`/redeem/${coupon.id}/`, {
            method: 'POST',
          });

          // Store redemption data from API response
          setRedemptionData({
            couponName: response.data.coupon_name,
            discountValue: response.data.savings_amount,
            redeemedAt: response.data.redeemed_at,
            redemptionId: response.data.redemption_id,
          });

          // Update the coupon state to show it as redeemed
          setCoupon({ ...coupon, is_redeemed: true });
          // Show success popup instead of alert
          setShowSuccessPopup(true);
          // 兌換會改變 `/exclusive-coupons/` 回傳結果，需讓收藏頁在回到焦點時刷新。
          markCollectionDirty();
        } catch (err) {
          if (isAxiosError(err) && err.response?.status === 401) return;
          Alert.alert(t('easyuse.redeemFailed'), getErrorMessage(err));
          setIsRedeeming(false);
        }
      } else {
        // For exclusive coupons, navigate to the redemption page to enter code
        router.push({
          pathname: '/(tabs)/easyuse/[id]/redeem',
          params: { id: String(coupon.id), ...(sourceParam ? { source: sourceParam } : {}) },
        });
      }
    }
  };

  // Handler to close the success popup and redirect
  const handleCloseSuccessPopup = () => {
    setShowSuccessPopup(false);
    setIsRedeeming(false);
    setRedemptionData(null);
    if (sourceParam === 'collection') {
      router.replace('/(tabs)/collection');
    } else {
      router.replace('/(tabs)/easyuse');
    }
  };

  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return '2024/07/13';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '2024/07/13';
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}/${month}/${day}`;
    } catch {
      return '2024/07/13';
    }
  };

  const handleShare = () => {
    setShowShareModal(true);
    devLog('Share modal opened');
  };

  const handleCouProShare = async () => {
    if (!coupon?.id) {
      Alert.alert(t('easyuse.error'), t('easyuse.cannotShareNoId'));
      return;
    }

    setIsSharing(true);

    try {
      devLog('Public pool share initiated for coupon:', coupon.id);

      const response = await fetchAPI(`/coupon/${coupon.id}/share-public/`, {
        method: 'POST',
      });

      if (response.data.message) {
        // 分享成功會改變專屬券歸屬，需讓收藏頁在回到焦點時刷新。
        markCollectionDirty();
        setShowShareModal(false);
        Alert.alert(t('easyuse.shareSuccess'), t('easyuse.shareSuccessMessage'), [
          {
            text: t('easyuse.ok'),
            onPress: () => {
              router.push('/(tabs)/collection');
            },
          },
        ]);

        devLog('Public share successful:', response.data);
      }
    } catch (err) {
      Alert.alert(t('shareModal.shareFailedTitle'), getErrorMessage(err));
    } finally {
      setIsSharing(false);
    }
  };

  const handleLinkShare = async (): Promise<string | undefined> => {
    if (!coupon?.id) {
      Alert.alert(t('easyuse.error'), t('easyuse.cannotShareNoId'));
      return;
    }

    setIsSharing(true);

    try {
      devLog('Link share initiated for coupon:', coupon.id);

      // Call the share_coupon API
      const response = await fetchAPI(`/coupon/${coupon.id}/share/`, {
        method: 'POST',
      });

      // Prefer Universal Link (https) so pasted text is clickable; fallback to custom scheme
      const webLink = response.data.share_link_web as string | undefined;
      const schemeLink = response.data.share_link as string | undefined;
      const link = webLink ?? schemeLink;
      if (link) {
        // 分享成功會改變專屬券歸屬，需讓收藏頁在回到焦點時刷新。
        markCollectionDirty();
        devLog('Share link generated:', link);
        return link;
      }
      throw new Error('Failed to generate share link');
    } catch (err) {
      Alert.alert(t('shareModal.shareFailedTitle'), getErrorMessage(err));
      return;
    } finally {
      setIsSharing(false);
    }
  };

  const handleCloseShareModal = () => {
    setShowShareModal(false);
  };

  const handleBlockMerchant = () => {
    if (!coupon?.store_id || !coupon?.store_name) {
      Alert.alert(t('easyuse.error'), t('easyuse.cannotBlockStore'));
      return;
    }

    const isBlocked = isStoreBlocked(coupon.store_id);

    if (isBlocked) {
      Alert.alert(
        t('easyuse.unblockConfirmTitle'),
        t('easyuse.unblockConfirmMessage', { storeName: coupon.store_name }),
        [
          { text: t('easyuse.cancel'), style: 'cancel' },
          {
            text: t('easyuse.unblockConfirmButton'),
            onPress: async () => {
              setIsBlockingStore(true);
              const result = await unblockStore(coupon.store_id);
              if (result.success) {
                Alert.alert(t('easyuse.ok'), t('easyuse.unblockSuccess'));
              } else {
                Alert.alert(t('easyuse.error'), result.message);
              }
              setIsBlockingStore(false);
            },
          },
        ],
      );
    } else {
      Alert.alert(
        t('easyuse.blockConfirmTitle'),
        t('easyuse.blockConfirmMessage', { storeName: coupon.store_name }),
        [
          { text: t('easyuse.cancel'), style: 'cancel' },
          {
            text: t('easyuse.blockConfirmButton'),
            style: 'destructive',
            onPress: async () => {
              setIsBlockingStore(true);
              const result = await blockStore(coupon.store_id);
              if (result.success) {
                Alert.alert(t('easyuse.blockSuccess'), t('easyuse.blockSuccessMessage'), [
                  {
                    text: t('easyuse.ok'),
                    onPress: () => {
                      if (sourceParam === 'collection') {
                        router.push('/(tabs)/collection');
                      } else {
                        router.push('/(tabs)/easyuse');
                      }
                    },
                  },
                ]);
              } else {
                Alert.alert(t('easyuse.error'), result.message);
              }
              setIsBlockingStore(false);
            },
          },
        ],
      );
    }
  };

  const openGoogleMaps = () => {
    if (coupon?.store_location?.lat && coupon?.store_location?.lng) {
      const { lat, lng } = coupon.store_location;
      const label = encodeURIComponent(coupon.store_name || 'Store Location');

      // Create Google Maps URL
      const url = Platform.select({
        ios: `maps:0,0?q=${lat},${lng}(${label})`,
        android: `geo:0,0?q=${lat},${lng}(${label})`,
        default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
      });

      Linking.canOpenURL(url!)
        .then((supported) => {
          if (supported) {
            return Linking.openURL(url!);
          } else {
            // Fallback to web version
            const webUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
            return Linking.openURL(webUrl);
          }
        })
        .catch((err) => {
          Sentry.captureException(err, { data: { context: 'easyuse.openMapsNavigation' } });
          Alert.alert(t('easyuse.error'), t('easyuse.openMapsFailed'));
        });
    } else {
      Alert.alert(t('easyuse.error'), t('easyuse.noStoreLocation'));
    }
  };

  if (isLoading) {
    return (
      <YStack flex={1} bg="#f5f5f5" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size="large" color="#FFAD31" />
        <Text mt="$4" fontSize="$6" color="#333">
          {t('easyuse.loading')}
        </Text>
      </YStack>
    );
  }

  if (error) {
    return (
      <YStack
        flex={1}
        bg="#f5f5f5"
        style={{ alignItems: 'center', justifyContent: 'center' }}
        px="$4"
      >
        <Text mb="$4" style={{ textAlign: 'center' }} fontSize="$6" color="#ef4444">
          {error}
        </Text>
        <Button onPress={onGoBackContainerClick} bg="#d1d5db" color="#374151" fontWeight="600">
          {t('easyuse.back')}
        </Button>
      </YStack>
    );
  }

  if (!coupon) {
    return (
      <YStack flex={1} bg="#f5f5f5" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Text fontSize="$6" color="#333">
          {t('easyuse.couponNotFound')}
        </Text>
      </YStack>
    );
  }

  devLog('Current coupon state:', coupon);

  return (
    <YStack flex={1} bg="#f0f0f0">
      <ScrollView flex={1}>
        {/* Header with Back and Share buttons */}
        <XStack
          px="$5"
          pt="$8"
          pb="$4"
          style={{
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Button onPress={onGoBackContainerClick} bg="transparent" p="$0">
            <ArrowLeft size={24} color="#333" />
          </Button>

          <XStack gap="$3" style={{ alignItems: 'center' }}>
            {/* Report Button - visible for all users */}
            <ReportButton
              contentType="coupon"
              contentId={Number(id)}
              contentName={coupon?.coupon_name}
              variant="icon-only"
            />

            {/* Block/Unblock Merchant - icon in header */}
            {coupon?.store_id && (
              <Button
                size="$2"
                onPress={handleBlockMerchant}
                disabled={isBlockingStore}
                bg="transparent"
                p="$2"
                chromeless
              >
                {isBlockingStore ? (
                  <Spinner size="small" color="#666" />
                ) : isStoreBlocked(coupon.store_id) ? (
                  <ShieldCheck size={22} color="#666" />
                ) : (
                  <ShieldBan size={22} color="#666" />
                )}
              </Button>
            )}

            {/* Share Button - only in collection view */}
            {sourceParam === 'collection' && (
              <Button
                onPress={handleShare}
                bg="#FFAD31"
                px="$4"
                py="$2"
                style={{
                  borderRadius: 12,
                }}
              >
                <Text color="#333" fontWeight="600" fontSize="$4">
                  {t('shareModal.share')}
                </Text>
              </Button>
            )}
          </XStack>
        </XStack>

        {/* Main Content */}
        <YStack px="$5" gap="$5" pb={130}>
          {/* Store Info Card - Main coupon display */}
          <Card
            p="$6"
            backgroundColor="white"
            borderRadius="$6"
            borderWidth={1}
            borderColor="#e5e5e5"
            shadowColor="black"
            shadowRadius={8}
            shadowOffset={{ width: 0, height: 2 }}
            shadowOpacity={0.08}
            elevation={3}
          >
            <YStack gap="$3" style={{ alignItems: 'center' }}>
              <Text
                color="#333"
                fontSize="$9"
                fontWeight="bold"
                lineHeight={36}
                style={{ textAlign: 'center', letterSpacing: 0.3 }}
              >
                {coupon?.store_name || '魚樂鮮魷魚羹'}
              </Text>
              <Text
                color="#555"
                fontSize="$5"
                fontWeight="500"
                lineHeight={24}
                style={{ textAlign: 'center' }}
                numberOfLines={2}
              >
                {coupon?.coupon_name || '來店消費滿120送 滷蛋一顆'}
              </Text>

              {coupon?.tags && coupon.tags.length > 0 && (
                <XStack
                  gap={6}
                  style={{ flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}
                >
                  {coupon.tags.map((tag, index) => (
                    <View
                      key={index}
                      style={{
                        backgroundColor: '#FFF5E6',
                        borderRadius: 12,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                      }}
                    >
                      <Text fontSize={14} color="#FFAD31" fontWeight="500">
                        {tag}
                      </Text>
                    </View>
                  ))}
                </XStack>
              )}
            </YStack>
          </Card>

          {/* Info Cards Row */}
          <XStack gap="$4">
            {/* Expiry Date Card */}
            <StatCard
              title="有效日期"
              value={coupon?.expiry_date ? formatDate(coupon.expiry_date) : '2024/07/13'}
              valueSingleLine
            />

            {/* Source Card: 依取得方式顯示來源（store=店家名；exclusive=acquisition_method 對應中文或 last_holder） */}
            <StatCard title="來自" value={getSourceDisplayText(coupon)} />
          </XStack>

          {/* Detail Card */}
          <Card
            p="$5"
            backgroundColor="white"
            borderRadius="$6"
            borderWidth={1}
            borderColor="#e5e5e5"
            shadowColor="black"
            shadowRadius={8}
            shadowOffset={{ width: 0, height: 2 }}
            shadowOpacity={0.08}
            elevation={3}
          >
            <YStack gap="$4" style={{ alignItems: 'flex-start' }}>
              <Text color="#333" fontSize="$5" fontWeight="600" lineHeight={26}>
                {coupon?.coupon_detail
                  ? coupon.coupon_detail.split('\n').map((line, index) => (
                      <Text key={index}>
                        {line}
                        {index < coupon.coupon_detail.split('\n').length - 1 && '\n'}
                      </Text>
                    ))
                  : '活動期間至「魚樂鮮魷魚羹」，\n來店消費滿120元即送滷蛋一顆。'}
              </Text>

              {(coupon?.important_notes || !coupon) && (
                <YStack gap="$2" width="100%">
                  <Text color="#666" fontSize="$4" fontWeight="600" lineHeight={22}>
                    注意事項：
                  </Text>
                  <YStack gap="$1.5">
                    {coupon?.important_notes
                      ? coupon.important_notes.split(/\r?\n/).map((rawLine, index) => {
                          const line = rawLine.trim();
                          const match = line.match(/^(\d+)\.\s*(.*)$/);

                          if (!match) {
                            return (
                              <Text key={index} color="#666" fontSize="$3" lineHeight={20}>
                                {line}
                              </Text>
                            );
                          }

                          const [, number, text] = match;
                          return (
                            <XStack key={index} gap="$2">
                              <Text color="#666" fontSize="$3" fontWeight="500" lineHeight={20}>
                                {number}.
                              </Text>
                              <Text color="#666" fontSize="$3" flex={1} lineHeight={20}>
                                {text || ''}
                              </Text>
                            </XStack>
                          );
                        })
                      : [
                          <XStack key="1" gap="$2">
                            <Text color="#666" fontSize="$3" fontWeight="500" lineHeight={20}>
                              1.
                            </Text>
                            <Text color="#666" fontSize="$3" flex={1} lineHeight={20}>
                              測試用
                            </Text>
                          </XStack>,
                        ]}
                  </YStack>
                </YStack>
              )}
            </YStack>
          </Card>
        </YStack>
      </ScrollView>

      {/* Fixed Bottom Button */}
      {!coupon.is_redeemed && (
        <YStack style={{ position: 'absolute', bottom: 30, left: 20, right: 20 }}>
          {coupon.coupon_type === 'store' ? (
            // Store coupons: full-width map navigation button only (no use button)
            <Button
              onPress={openGoogleMaps}
              bg="#FFAD31"
              height={60}
              style={{
                borderRadius: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 5,
              }}
            >
              <MapPin size={24} color="#333" />
            </Button>
          ) : (
            // Exclusive coupons: full-width use button
            <Button
              onPress={isRedeeming || !coupon.can_use_today ? undefined : onRedeemClick}
              bg="#FFAD31"
              height={60}
              style={{
                borderRadius: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 5,
                opacity: isRedeeming || !coupon.can_use_today ? 0.5 : 1,
              }}
              disabled={isRedeeming || !coupon.can_use_today}
            >
              <Text color="#333" fontSize="$6" fontWeight="bold">
                {isRedeeming
                  ? t('easyuse.processing')
                  : !coupon.can_use_today
                    ? t('easyuse.useTodayUsed')
                    : t('easyuse.use')}
              </Text>
            </Button>
          )}
        </YStack>
      )}

      {coupon.is_redeemed && coupon.coupon_type === 'exclusive' && (
        <YStack style={{ position: 'absolute', bottom: 30, left: 20, right: 20 }}>
          <Text style={{ textAlign: 'center' }} fontSize="$5" color="#ef4444">
            {t('easyuse.redeemedExclusive')}
          </Text>
        </YStack>
      )}

      {/* Success Popup */}
      <SuccessPopup
        isOpen={showSuccessPopup}
        onClose={handleCloseSuccessPopup}
        storeName={coupon?.store_name}
        couponDetail={coupon?.coupon_detail}
        couponName={redemptionData?.couponName || coupon?.coupon_name}
        discountValue={redemptionData?.discountValue}
        redeemedAt={redemptionData?.redeemedAt}
        redemptionId={redemptionData?.redemptionId}
        titleType={t('successPopup.useSuccess')}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={handleCloseShareModal}
        onCouProShare={handleCouProShare}
        onLinkShare={handleLinkShare}
        isSharing={isSharing}
      />
    </YStack>
  );
};

export default CouponDetailPage;
