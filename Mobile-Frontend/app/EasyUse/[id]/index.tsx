import React, { useEffect, useState, useCallback } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Share2 } from 'lucide-react-native';
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
  last_holder_email?: string;
  is_redeemed: boolean;
  can_use_today: boolean;
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
        } catch (err) {
          console.error('Error fetching coupon details:', err);
          devLog('Error fetching coupon:', err);
          let errorMessage = '無法載入優惠券詳情。';
          if (err instanceof Error) {
            if (err.message.includes('404')) {
              errorMessage = '找不到此優惠券。';
            } else if (err.message.includes('401')) {
              errorMessage = '請先登入以查看此優惠券。';
            } else {
              errorMessage = `載入錯誤: ${err.message}`;
            }
          }
          setError(errorMessage);
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
    // Navigate based on source parameter
    if (sourceParam === 'collection') {
      router.push('/Collection');
    } else {
      router.push('/EasyUse');
    }
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

          await fetchAPI(`/redeem/${coupon.id}/`, {
            method: 'POST',
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
    try {
      devLog("CouPro share initiated for coupon:", coupon?.id);
      // Implement CouPro sharing logic here
      // This might involve API call to move coupon to public pool
      setShowShareModal(false);
      // You might want to show a success message or redirect
      Alert.alert('分享成功', '優惠券已分享至 CouPro 隨取即用區域(此功能還未實作)');
    } catch (err) {
      console.error('Error sharing to CouPro:', err);
      Alert.alert('分享失敗', '無法分享至 CouPro，請稍後再試');
    }
  };

  const handleLinkShare = async () => {
    try {
      devLog("Link share initiated for coupon:", coupon?.id);
      // Implement link sharing logic here
      // This might involve generating a share link and opening native share dialog
      setShowShareModal(false);
      // You might want to show native share dialog or copy link to clipboard
      Alert.alert('分享連結', '分享連結功能尚未實現');
    } catch (err) {
      console.error('Error sharing link:', err);
      Alert.alert('分享失敗', '無法生成分享連結，請稍後再試');
    }
  };

  const handleCloseShareModal = () => {
    setShowShareModal(false);
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
            justifyContent: sourceParam === 'collection' ? 'space-between' : 'flex-start', 
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
          <Button
            onPress={
              sourceParam === 'collection' 
                ? (isRedeeming || !coupon.can_use_today ? undefined : onRedeemClick)
                : openGoogleMaps
            }
            bg="#FFAD31"
            height={60}
            style={{
              borderRadius: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 5,
              opacity: 
                sourceParam === 'collection' 
                  ? (isRedeeming || !coupon.can_use_today ? 0.5 : 1)
                  : 1
            }}
            disabled={sourceParam === 'collection' && (isRedeeming || !coupon.can_use_today)}
          >
            <Text 
              color="#333" 
              fontSize="$6" 
              fontWeight="bold"
            >
              {sourceParam === 'collection' 
                ? (isRedeeming
                    ? '處理中...'
                    : !coupon.can_use_today
                      ? '今日已使用'
                      : '使用')
                : "Let's GOOOOO!"
              }
            </Text>
          </Button>
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
        titleType="使用成功"
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={handleCloseShareModal}
        onCouProShare={handleCouProShare}
        onLinkShare={handleLinkShare}
      />
    </YStack>
  );
};

export default CouponDetailPage;
