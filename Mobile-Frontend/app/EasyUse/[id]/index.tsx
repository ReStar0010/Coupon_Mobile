import React, { useEffect, useState, useCallback } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Share2, MapPin, ShieldBan, ShieldCheck } from 'lucide-react-native';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { 
  YStack, 
  XStack, 
  ScrollView, 
  Card, 
  Text, 
  Button, 
  Spinner,
  View,
  H1,
  H2,
  H3,
  Paragraph
} from 'tamagui';
import SuccessPopup from './redeem/SuccessPopup';
import ShareModal from './components/ShareModal';
import ReportButton from '../../components/ReportButton';
import { useBlockedMerchants } from '../../components/providers/BlockedMerchantsProvider';
import { isUserLoggedIn, fetchAPI } from '../../utils/authAPI';
import { devLog } from '../../utils/devLogger';

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
};

const CouponDetailPage: React.FC = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const params = useLocalSearchParams();
  const sourceParam = params.source as string;

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
          console.log('Coupon API Response:', response.data); // Additional console log
          setCoupon(response.data);
          
          // Track template view event if template_id exists
          if (response.data.template_id) {
            trackTemplateView(response.data.template_id, response.data.id);
          }
        } catch (err) {
          console.error('Error fetching coupon details:', err);
          devLog('Error fetching coupon:', err);
          let errorMessage = '無法載入優惠券詳情。';
          if (err instanceof Error) {
            // Filter out 401 authentication errors - they are handled silently by AuthOrchestrator
            if (err.message.includes('401') || err.message.includes('Authentication')) {
              // Don't set error message, let AuthOrchestrator handle silent redirect
              errorMessage = '';
            } else if (err.message.includes('404')) {
              errorMessage = '找不到此優惠券。';
            } else {
              errorMessage = `載入錯誤: ${err.message}`;
            }
          }
          // Only set error if it's not empty (i.e., not a 401 auth error)
          if (errorMessage) {
            setError(errorMessage);
          }
        } finally {
          setIsLoading(false);
        }
      };
      fetchCouponDetail();
    } else {
      setError('無效的優惠券 ID。');
      setIsLoading(false);
    }
  }, [id]);

  const onGoBackContainerClick = useCallback(() => {
    router.back();
  }, [router, sourceParam]);

  const onRedeemClick = async () => {
    if (coupon) {
      if (coupon.coupon_type === 'store') {
        // Check if the user is logged in before redeeming
        const userLoggedIn = await isUserLoggedIn();
        if (!userLoggedIn) {
          devLog('User not logged in. Redirecting to login page');
          const returnUrl = `/EasyUse/${coupon.id}`;
          router.push(`/Login?returnUrl=${encodeURIComponent(returnUrl)}`);
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
        } catch (err) {
          console.error('Error redeeming coupon:', err);
          let errorMessage = '兌換失敗，請稍後再試。';
          if (err instanceof Error) {
            errorMessage = err.message;
          }
          Alert.alert('兌換失敗', errorMessage);
          setIsRedeeming(false);
        }
      } else {
        // For exclusive coupons, navigate to the redemption page to enter code
        router.push(`/EasyUse/${coupon.id}/redeem`);
      }
    }
  };

  // Handler to close the success popup and redirect
  const handleCloseSuccessPopup = () => {
    setShowSuccessPopup(false);
    setIsRedeeming(false);
    setRedemptionData(null);
    router.push('/EasyUse'); // Redirect back to main page
  };

  const formatDate = (dateString: string) => {
    try {
      console.log('Formatting date string:', dateString);
      if (!dateString) return '2024\n07/13';
      
      const date = new Date(dateString);
      console.log('Parsed date:', date);
      
      if (isNaN(date.getTime())) {
        console.log('Invalid date, using fallback');
        return '2024\n07/13';
      }
      
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const formatted = `${year}\n${month}/${day}`;
      console.log('Formatted date result:', formatted);
      return formatted;
    } catch (e) {
      console.log('Date formatting error:', e);
      return '2024\n07/13';
    }
  };

  const handleShare = () => {
    setShowShareModal(true);
    devLog("Share modal opened");
  };

  const handleCouProShare = async () => {
    if (!coupon?.id) {
      Alert.alert('錯誤', '無法分享：優惠券ID不存在');
      return;
    }

    setIsSharing(true);

    try {
      devLog("Public pool share initiated for coupon:", coupon.id);

      const response = await fetchAPI(`/coupon/${coupon.id}/share-public/`, {
        method: 'POST',
      });

      if (response.data.message) {
        setShowShareModal(false);

        // Show success alert and navigate back to Collection
        Alert.alert(
          '分享成功',
          '您的優惠券已分享至隨取即用公開交換池，其他用戶現在可以領取！',
          [
            {
              text: '確定',
              onPress: () => router.push('/Collection')
            }
          ]
        );

        devLog("Public share successful:", response.data);
      }
    } catch (err: any) {
      console.error('Error sharing to public pool:', err);

      let errorMessage = '無法分享優惠券，請稍後再試';

      if (err?.response?.data?.error) {
        const backendError = err.response.data.error;
        if (backendError === 'You do not own this coupon.') {
          errorMessage = '您不是此優惠券的持有者';
        } else if (backendError === 'This coupon has already been redeemed.') {
          errorMessage = '此優惠券已被使用';
        } else if (backendError === 'This coupon is already shared to the public pool.') {
          errorMessage = '此優惠券已在公開交換池中';
        } else {
          errorMessage = backendError;
        }
      }

      Alert.alert('分享失敗', errorMessage);
    } finally {
      setIsSharing(false);
    }
  };

  const handleLinkShare = async () => {
    if (!coupon?.id) {
      Alert.alert('錯誤', '無法分享：優惠券ID不存在');
      return;
    }

    setIsSharing(true);

    try {
      devLog("Link share initiated for coupon:", coupon.id);
      
      // Call the share_coupon API
      const response = await fetchAPI(`/coupon/${coupon.id}/share/`, {
        method: 'POST',
      });

      if (response.data.share_link) {
        // Copy the share link to clipboard
        await Clipboard.setStringAsync(response.data.share_link);
        
        setShowShareModal(false);
        Alert.alert('分享成功', '分享連結已複製到剪貼簿，可以傳送給朋友了！');
        
        devLog("Share link generated and copied:", response.data.share_link);
      } else {
        throw new Error('Failed to generate share link');
      }
    } catch (err: any) {
      console.error('Error sharing link:', err);
      
      let errorMessage = '無法生成分享連結，請稍後再試';
      
      if (err?.response?.data?.error) {
        const backendError = err.response.data.error;
        if (backendError === 'You do not own this coupon.') {
          errorMessage = '您不是此優惠券的持有者';
        } else if (err?.response?.status === 404) {
          errorMessage = '找不到此優惠券';
        } else if (err?.response?.status === 403) {
          errorMessage = '您沒有權限分享此優惠券';
        } else {
          errorMessage = backendError;
        }
      }
      
      Alert.alert('分享失敗', errorMessage);
    } finally {
      setIsSharing(false);
    }
  };

  const handleCloseShareModal = () => {
    setShowShareModal(false);
  };

  const handleBlockMerchant = () => {
    if (!coupon?.store_id || !coupon?.store_name) {
      Alert.alert('錯誤', '無法封鎖此商家');
      return;
    }

    const isBlocked = isStoreBlocked(coupon.store_id);

    if (isBlocked) {
      // Unblock confirmation
      Alert.alert(
        '解除封鎖',
        `確定要解除封鎖「${coupon.store_name}」嗎？`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '確定',
            onPress: async () => {
              setIsBlockingStore(true);
              try {
                const success = await unblockStore(coupon.store_id);
                if (success) {
                  Alert.alert('成功', '已解除封鎖');
                } else {
                  Alert.alert('錯誤', '解除封鎖失敗，請稍後再試');
                }
              } catch (error) {
                Alert.alert('錯誤', '解除封鎖失敗，請稍後再試');
              } finally {
                setIsBlockingStore(false);
              }
            },
          },
        ],
      );
    } else {
      // Block confirmation
      Alert.alert(
        '封鎖商家',
        `確定要封鎖「${coupon.store_name}」嗎？\n\n封鎖後，此商家的優惠券將不會出現在您的動態中。`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '確定封鎖',
            style: 'destructive',
            onPress: async () => {
              setIsBlockingStore(true);
              try {
                const success = await blockStore(coupon.store_id);
                if (success) {
                  Alert.alert(
                    '已封鎖',
                    '該商家的優惠券將不會再出現在您的動態中',
                    [
                      {
                        text: '確定',
                        onPress: () => {
                          // Go back to EasyUse page
                          router.push('/EasyUse');
                        },
                      },
                    ],
                  );
                } else {
                  Alert.alert('錯誤', '封鎖失敗，請稍後再試');
                }
              } catch (error) {
                Alert.alert('錯誤', '封鎖失敗，請稍後再試');
              } finally {
                setIsBlockingStore(false);
              }
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
        default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
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
          console.error('Error opening maps:', err);
          Alert.alert('錯誤', '無法開啟地圖應用程式');
        });
    } else {
      Alert.alert('錯誤', '無法取得店家位置資訊');
    }
  };

  if (isLoading) {
    return (
      <YStack flex={1} bg="#f5f5f5" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size="large" color="#FFAD31" />
        <Text mt="$4" fontSize="$6" color="#333">載入中...</Text>
      </YStack>
    );
  }

  if (error) {
    return (
      <YStack flex={1} bg="#f5f5f5" style={{ alignItems: 'center', justifyContent: 'center' }} px="$4">
        <Text mb="$4" style={{ textAlign: 'center' }} fontSize="$6" color="#ef4444">{error}</Text>
        <Button
          onPress={onGoBackContainerClick}
          bg="#d1d5db"
          color="#374151"
          fontWeight="600"
        >
          返回
        </Button>
      </YStack>
    );
  }

  if (!coupon) {
    return (
      <YStack flex={1} bg="#f5f5f5" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Text fontSize="$6" color="#333">找不到優惠券資料。</Text>
      </YStack>
    );
  }

  // Debug logging
  console.log('Rendering coupon with data:', coupon);
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
            alignItems: 'center'
          }}
        >
          <Button
            onPress={onGoBackContainerClick}
            bg="transparent"
            p="$0"
          >
            <ArrowLeft size={24} color="#333" />
          </Button>
          
          <XStack gap="$3" alignItems="center">
            {/* Report Button - visible for all users */}
            <ReportButton
              contentType="coupon"
              contentId={Number(id)}
              contentName={coupon?.coupon_name}
              variant="icon-only"
            />

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
                  分享
                </Text>
              </Button>
            )}
          </XStack>
        </XStack>

        {/* Main Content */}
        <YStack px="$5" gap="$5" pb={130}>
          {/* Store Info Card - Main coupon display */}
          <Card 
            bg="#fff" 
            p="$6"
            style={{
              borderRadius: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 4
            }}
          >
            <YStack gap="$4" style={{ alignItems: 'center' }}>
              <Text
                color="#333"
                fontSize="$9"
                fontWeight="bold"
                style={{ 
                  textAlign: 'center',
                }}
              >
                {coupon?.store_name || '魚樂鮮魷魚羹'}
              </Text>
              <Text
                color="#333"
                fontSize="$5"
                fontWeight="500"
                style={{ 
                  textAlign: 'center',
                }}
                numberOfLines={2}
              >
                {coupon?.coupon_name || '來店消費滿120送 滷蛋一顆'}
              </Text>
              
              {coupon?.tags && coupon.tags.length > 0 && (
                <XStack gap={6} flexWrap="wrap" justifyContent="center" marginTop={8}>
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

              {/* Block/Unblock Merchant Button */}
              {coupon?.store_id && (
                <Button
                  size="$3"
                  onPress={handleBlockMerchant}
                  disabled={isBlockingStore}
                  bg={isStoreBlocked(coupon.store_id) ? "$gray5" : "$red9"}
                  pressStyle={{ opacity: 0.8 }}
                  marginTop="$2"
                  style={{
                    borderRadius: 8,
                    minWidth: 120,
                  }}
                >
                  {isBlockingStore ? (
                    <Spinner size="small" color="$white" />
                  ) : (
                    <XStack alignItems="center" gap="$2">
                      {isStoreBlocked(coupon.store_id) ? (
                        <>
                          <ShieldCheck size={16} color="white" />
                          <Text color="white" fontSize="$3" fontWeight="500">
                            已封鎖
                          </Text>
                        </>
                      ) : (
                        <>
                          <ShieldBan size={16} color="white" />
                          <Text color="white" fontSize="$3" fontWeight="500">
                            封鎖商家
                          </Text>
                        </>
                      )}
                    </XStack>
                  )}
                </Button>
              )}
            </YStack>
          </Card>

          {/* Info Cards Row */}
          <XStack gap="$4">
            {/* Expiry Date Card */}
            <Card 
              bg="#fff" 
              flex={1}
              p="$4"
              style={{ 
                borderRadius: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 6,
                elevation: 3
              }}
            >
              <YStack gap="$3" style={{ alignItems: 'flex-start' }}>
                <Text color="#666" fontSize="$3" fontWeight="500">
                  有效日期
                </Text>
                <Text 
                  color="#333" 
                  fontSize="$8" 
                  fontWeight="bold" 
                >
                  {coupon?.expiry_date ? formatDate(coupon.expiry_date) : '2024\n07/13'}
                </Text>
              </YStack>
            </Card>

            {/* Source Card */}
            <Card 
              bg="#fff" 
              flex={1}
              p="$4"
              style={{ 
                borderRadius: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 6,
                elevation: 3
              }}
            >
              <YStack gap="$3" style={{ alignItems: 'flex-start' }}>
                <Text color="#666" fontSize="$3" fontWeight="500">
                  來自
                </Text>
                <Text
                  color="#333"
                  fontSize="$6"
                  fontWeight="bold"
                  numberOfLines={2}
                >
                  {coupon?.coupon_type === 'store'
                    ? coupon?.store_name
                    : coupon?.coupon_type === 'exclusive' && coupon?.last_holder_email
                      ? coupon.last_holder_email
                      : 'CouPro'}
                </Text>
              </YStack>
            </Card>
          </XStack>

          {/* Detail Card */}
          <Card 
            bg="#fff" 
            p="$6"
            style={{
              borderRadius: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 4
            }}
          >
            <YStack gap="$6" style={{ alignItems: 'flex-start' }}>
              <Text color="#333" fontSize="$6" fontWeight="600" > 
                {coupon?.coupon_detail ? 
                  coupon.coupon_detail.split('\n').map((line, index) => (
                    <Text key={index}>
                      {line}
                      {index < coupon.coupon_detail.split('\n').length - 1 && '\n'}
                    </Text>
                  )) : 
                  '活動期間至「魚樂鮮魷魚羹」，\n來店消費滿120元即送滷蛋一顆。'
                }
              </Text>

              {(coupon?.important_notes || !coupon) && (
                <YStack gap="$3" width="100%">
                  <Text color="#666" fontSize="$4" fontWeight="500">
                    注意事項：
                  </Text>
                  <YStack gap="$2">
                    {coupon?.important_notes ? 
                      coupon.important_notes.split(/\r?\n/).map((rawLine, index) => {
                        const line = rawLine.trim();
                        const match = line.match(/^(\d+)\.\s*(.*)$/);

                        if (!match) {
                          return (
                            <Text key={index} color="#666" fontSize="$3">
                              {line}
                            </Text>
                          );
                        }

                        const [, number, text] = match;
                        return (
                          <XStack key={index} gap="$2">
                            <Text color="#666" fontSize="$3" fontWeight="500">
                              {number}.
                            </Text>
                            <Text color="#666" fontSize="$3" flex={1} >
                              {text || ''}
                            </Text>
                          </XStack>
                        );
                      }) :
                      [
                        <XStack key="1" gap="$2">
                          <Text color="#666" fontSize="$3" fontWeight="500">1.</Text>
                          <Text color="#666" fontSize="$3" flex={1}>測試用</Text>
                        </XStack>
                      ]
                    }
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
          {sourceParam === 'collection' ? (
            // Collection source: Keep original single button behavior
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
                opacity: isRedeeming || !coupon.can_use_today ? 0.5 : 1
              }}
              disabled={isRedeeming || !coupon.can_use_today}
            >
              <Text 
                color="#333" 
                fontSize="$6" 
                fontWeight="bold"
              >
                {isRedeeming
                  ? '處理中...'
                  : !coupon.can_use_today
                    ? '今日已使用'
                    : '使用'}
              </Text>
            </Button>
          ) : (
            // EasyUse source: Two buttons side by side (Paste_Image style)
            <XStack gap={12} style={{ width: '100%' }}>
              {/* Left: Large "使用" button */}
              <Button
                onPress={onRedeemClick}
                bg="#FFAD31"
                flex={2}
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
                <Text 
                  color="#333" 
                  fontSize="$6" 
                  fontWeight="bold"
                >
                  使用
                </Text>
              </Button>
              
              {/* Right: Square map icon button */}
              <Button
                onPress={openGoogleMaps}
                bg="#FFAD31"
                width={60}
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
            </XStack>
          )}
        </YStack>
      )}

      {coupon.is_redeemed && coupon.coupon_type === 'exclusive' && (
        <YStack style={{ position: 'absolute', bottom: 30, left: 20, right: 20 }}>
          <Text style={{ textAlign: 'center' }} fontSize="$5" color="#ef4444">
            此優惠券已被兌換
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
        titleType="使用成功"
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
