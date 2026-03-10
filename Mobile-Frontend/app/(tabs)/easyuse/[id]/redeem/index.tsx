import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { DismissKeyboardView } from '@/app/components/DismissKeyboardView';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Camera as CameraIcon } from 'lucide-react-native';
import { CameraView, CameraType, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import SuccessPopup from './SuccessPopup';
import Toast from './Toast';
import { devLog } from '@/app/utils/devLogger';
import { isAxiosError } from 'axios';
import { fetchAPI } from '@/app/utils/authAPI';
import { useApiError } from '@/app/hooks/useApiError';

// Define the coupon interface
interface Coupon {
  id: number;
  store_name: string;
  coupon_detail: string;
  coupon_name?: string;
  coupon_type: 'store' | 'exclusive';
  // Add other properties as needed
}

export default function RedeemPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { getErrorMessage } = useApiError();
  const { id, unifiedCode, source } = useLocalSearchParams<{
    id: string;
    unifiedCode?: string;
    source?: string;
  }>();
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [redeemCode, setRedeemCode] = useState('');
  const [message, setMessage] = useState('');
  const [inputError, setInputError] = useState(false);
  const [showSuccessConfirmation, setShowSuccessConfirmation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorToastMessage, setErrorToastMessage] = useState('');
  const [redemptionData, setRedemptionData] = useState<{
    couponName?: string;
    discountValue?: number;
    redeemedAt?: string;
    redemptionId?: number;
  } | null>(null);

  // Camera states
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, _setFacing] = useState<CameraType>('back');
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const lastScannedTimeRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>('');

  const onGoBackContainerClick = useCallback(() => {
    router.back();
  }, [router]);

  const handleCloseSuccessPopup = useCallback(() => {
    setShowSuccessConfirmation(false);
    setRedemptionData(null);

    // Use consistent casing and correct tab route for navigation
    if (source === 'collection') {
      router.replace('/(tabs)/collection');
    } else {
      router.replace('/(tabs)/easyuse');
    }
  }, [router, source]);

  const handleHideErrorToast = useCallback(() => {
    setShowErrorToast(false);
    setErrorToastMessage('');
  }, []);

  // Camera functions
  const requestCameraPermission = async () => {
    if (!permission) {
      return false;
    }

    if (permission.granted) {
      return true;
    }

    if (permission.canAskAgain) {
      const { granted } = await requestPermission();
      return granted;
    }

    Alert.alert(t('redeem.cameraPermissionTitle'), t('redeem.cameraPermissionMessage'), [
      { text: t('easyuse.cancel'), style: 'cancel' },
      { text: t('redeem.goToSettings'), onPress: () => {} },
    ]);
    return false;
  };

  const toggleCamera = async () => {
    if (isCameraActive) {
      setIsCameraActive(false);
      setIsScanning(false);
    } else {
      const hasPermission = await requestCameraPermission();
      if (hasPermission) {
        setIsCameraActive(true);
        setIsScanning(true);
      }
    }
  };

  const handleSubmitCode = useCallback(
    async (codeToUse?: string) => {
      const code = codeToUse ?? redeemCode;
      if (!code || code.length < 1) {
        return;
      }

      setInputError(false);
      setMessage('');
      setIsLoading(true);

      try {
        const response = await fetchAPI(`/redeem/${id}/`, {
          method: 'POST',
          data: { redeem_code: code },
        });

        // Process the successful response
        devLog('兌換成功', response.data);

        // Store redemption data
        setRedemptionData({
          couponName: response.data.coupon_name,
          discountValue: response.data.savings_amount,
          redeemedAt: response.data.redeemed_at,
          redemptionId: response.data.redemption_id,
        });

        setInputError(false);
        setShowSuccessConfirmation(true);
        setRedeemCode('');
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 401) {
          setErrorToastMessage('');
          setShowErrorToast(false);
        } else {
          setErrorToastMessage(getErrorMessage(error));
          setShowErrorToast(true);
        }
        setInputError(true);
        if (codeToUse === undefined) {
          setRedeemCode('');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [id, redeemCode, getErrorMessage],
  );

  const handleBarCodeScanned = useCallback(
    async ({ type, data }: BarcodeScanningResult) => {
      if (!isScanning) return;

      const now = Date.now();
      const scannedCode = data.trim();

      if (scannedCode === lastScannedCodeRef.current && now - lastScannedTimeRef.current < 3000) {
        devLog('Duplicate scan prevented:', scannedCode);
        return;
      }

      lastScannedTimeRef.current = now;
      lastScannedCodeRef.current = scannedCode;
      setIsScanning(false);
      devLog('Barcode scanned:', { type, data });

      const isUnifiedCode = /^\d{6}$/.test(scannedCode);
      setIsCameraActive(false);
      setInputError(false);
      setMessage('');
      setShowErrorToast(false);
      setErrorToastMessage('');

      if (isUnifiedCode) {
        await handleSubmitCode(scannedCode);
      } else {
        const upperCode = scannedCode.toUpperCase();
        setRedeemCode(upperCode);
        await handleSubmitCode(upperCode);
      }
    },
    [isScanning, handleSubmitCode],
  );

  useEffect(() => {
    const fetchCoupon = async () => {
      setMessage('');
      try {
        const response = await fetchAPI(`/coupons/${id}/`, {
          method: 'GET',
        });

        if (response.data.coupon_type === 'store') {
          router.push(`/(tabs)/easyuse/${id}`);
          return;
        }

        setCoupon(response.data);
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 401) return;
        setMessage(getErrorMessage(error));
        setCoupon(null);
      }
    };

    if (id) {
      fetchCoupon();
    }
  }, [id, router, getErrorMessage]);

  // Auto-fill and auto-redeem unified redemption code if provided
  useEffect(() => {
    if (unifiedCode && !redeemCode && coupon && !isLoading && !showSuccessConfirmation) {
      setRedeemCode(unifiedCode);
      // Auto-redeem immediately if unified code is provided
      handleSubmitCode(unifiedCode);
    }
  }, [unifiedCode, redeemCode, coupon, isLoading, showSuccessConfirmation, handleSubmitCode]);

  // Auto-redeem on manual input with debounce (1 second after user stops typing)
  // Handles both regular codes and unified codes (6-digit) - both redeem directly
  useEffect(() => {
    // Only auto-redeem if:
    // - Code is at least 6 characters (valid code length for both types)
    // - Not currently loading
    // - Not showing success popup
    // - No unified code param from URL (URL params handled separately on mount)
    // - Coupon data is loaded
    if (
      redeemCode.length >= 6 &&
      !isLoading &&
      !showSuccessConfirmation &&
      !unifiedCode &&
      coupon
    ) {
      const debounceTimer = setTimeout(() => {
        handleSubmitCode();
      }, 1000); // 1 second debounce

      return () => clearTimeout(debounceTimer);
    }
  }, [redeemCode, isLoading, showSuccessConfirmation, unifiedCode, coupon, handleSubmitCode]);

  // Cleanup camera when component unmounts
  useEffect(() => {
    return () => {
      setIsCameraActive(false);
      setIsScanning(false);
    };
  }, []);

  const handleInputChange = (text: string) => {
    // Allow more flexible input, not just 6 characters
    const filteredText = text.slice(0, 20).toUpperCase(); // Allow up to 20 characters
    setRedeemCode(filteredText);
    if (inputError) {
      setInputError(false);
    }
    setMessage('');
    // Hide error toast when user starts typing
    if (showErrorToast) {
      setShowErrorToast(false);
      setErrorToastMessage('');
    }
  };

  if (!coupon && !message) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f0f0f0',
        }}
      >
        <ActivityIndicator size="large" color="#FFAD31" />
        <Text style={{ color: '#333', marginTop: 16 }}>{t('easyuse.loading')}</Text>
      </SafeAreaView>
    );
  }

  if (!coupon && message) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f0f0f0',
          paddingHorizontal: 20,
        }}
      >
        <Text style={{ textAlign: 'center', fontSize: 18, color: '#ef4444' }}>{message}</Text>
        <TouchableOpacity
          onPress={onGoBackContainerClick}
          style={{
            marginTop: 16,
            borderRadius: 8,
            backgroundColor: '#d1d5db',
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
        >
          <Text style={{ fontWeight: '600', color: '#374151' }}>{t('easyuse.back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f0f0f0' }}>
      <DismissKeyboardView>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Header with Back Button */}
          <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 }}>
            <TouchableOpacity
              onPress={onGoBackContainerClick}
              style={{
                width: 40,
                height: 40,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              activeOpacity={0.7}
            >
              <ArrowLeft size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1, paddingHorizontal: 20 }}>
            {/* Code Input Section */}
            <View style={{ marginBottom: 30 }}>
              <TextInput
                value={redeemCode}
                onChangeText={handleInputChange}
                placeholder={t('redeem.placeholder')}
                maxLength={20}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!isLoading}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: inputError ? '#ef4444' : '#e5e7eb',
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  fontSize: 16,
                  color: '#333',
                  textAlign: 'left',
                }}
              />
            </View>

            {/* "或" Divider */}
            <View
              style={{
                alignItems: 'center',
                marginBottom: 30,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  color: '#666',
                  fontWeight: '500',
                }}
              >
                {t('redeem.or')}
              </Text>
            </View>

            {/* Camera Section */}
            <View
              style={{
                flex: 1,
                marginBottom: 20,
              }}
            >
              <View
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 16,
                  overflow: 'hidden',
                  flex: 1,
                  minHeight: 300,
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                }}
              >
                {isCameraActive && permission?.granted ? (
                  /* Active Camera View */
                  <View style={{ flex: 1, position: 'relative' }}>
                    <CameraView
                      ref={cameraRef}
                      style={{ flex: 1 }}
                      facing={facing}
                      barcodeScannerSettings={{
                        barcodeTypes: [
                          'qr',
                          'pdf417',
                          'ean13',
                          'ean8',
                          'code39',
                          'code128',
                          'codabar',
                          'upc_a',
                          'upc_e',
                          'aztec',
                          'datamatrix',
                        ],
                      }}
                      onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
                    >
                      {/* Camera overlay */}
                      <View
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          justifyContent: 'center',
                          alignItems: 'center',
                          backgroundColor: 'rgba(0,0,0,0.2)',
                        }}
                      >
                        {/* Scanning frame overlay */}
                        <View
                          style={{
                            width: 250,
                            height: 250,
                            borderWidth: 2,
                            borderColor: isScanning ? '#FFAD31' : '#666',
                            borderRadius: 12,
                            backgroundColor: 'transparent',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.5,
                            shadowRadius: 4,
                          }}
                        >
                          {/* Corner indicators */}
                          <View
                            style={{
                              position: 'absolute',
                              top: -2,
                              left: -2,
                              width: 20,
                              height: 20,
                              borderTopWidth: 4,
                              borderLeftWidth: 4,
                              borderColor: isScanning ? '#FFAD31' : '#666',
                            }}
                          />
                          <View
                            style={{
                              position: 'absolute',
                              top: -2,
                              right: -2,
                              width: 20,
                              height: 20,
                              borderTopWidth: 4,
                              borderRightWidth: 4,
                              borderColor: isScanning ? '#FFAD31' : '#666',
                            }}
                          />
                          <View
                            style={{
                              position: 'absolute',
                              bottom: -2,
                              left: -2,
                              width: 20,
                              height: 20,
                              borderBottomWidth: 4,
                              borderLeftWidth: 4,
                              borderColor: isScanning ? '#FFAD31' : '#666',
                            }}
                          />
                          <View
                            style={{
                              position: 'absolute',
                              bottom: -2,
                              right: -2,
                              width: 20,
                              height: 20,
                              borderBottomWidth: 4,
                              borderRightWidth: 4,
                              borderColor: isScanning ? '#FFAD31' : '#666',
                            }}
                          />
                        </View>

                        {/* Instructions overlay */}
                        <Text
                          style={{
                            position: 'absolute',
                            bottom: 60,
                            color: '#fff',
                            fontSize: 16,
                            fontWeight: '600',
                            textAlign: 'center',
                            backgroundColor: 'rgba(0,0,0,0.7)',
                            paddingHorizontal: 20,
                            paddingVertical: 10,
                            borderRadius: 8,
                          }}
                        >
                          {isScanning ? t('redeem.scanning') : t('redeem.rescan')}
                        </Text>
                      </View>

                      {/* Camera controls */}
                      <View
                        style={{
                          position: 'absolute',
                          top: 20,
                          right: 20,
                          flexDirection: 'row',
                          gap: 12,
                        }}
                      >
                        {/* Rescan button */}
                        {!isScanning && (
                          <TouchableOpacity
                            style={{
                              backgroundColor: 'rgba(255,255,255,0.9)',
                              borderRadius: 25,
                              padding: 10,
                            }}
                            onPress={() => setIsScanning(true)}
                          >
                            <CameraIcon size={20} color="#333" />
                          </TouchableOpacity>
                        )}

                        {/* Close camera button */}
                        <TouchableOpacity
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.9)',
                            borderRadius: 25,
                            padding: 10,
                          }}
                          onPress={toggleCamera}
                        >
                          <Text style={{ color: '#333', fontSize: 16, fontWeight: '600' }}>×</Text>
                        </TouchableOpacity>
                      </View>
                    </CameraView>
                  </View>
                ) : (
                  /* Camera Preview/Placeholder */
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: '#f8f9fa',
                      justifyContent: 'center',
                      alignItems: 'center',
                      position: 'relative',
                    }}
                    onPress={toggleCamera}
                    activeOpacity={0.8}
                  >
                    {/* Camera icon and text */}
                    <View
                      style={{
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: '#FFAD31',
                          borderRadius: 40,
                          padding: 20,
                        }}
                      >
                        <CameraIcon size={32} color="#333" />
                      </View>
                      <Text
                        style={{
                          color: '#333',
                          fontSize: 18,
                          fontWeight: '600',
                          textAlign: 'center',
                        }}
                      >
                        {t('redeem.startCamera')}
                      </Text>
                      <Text
                        style={{
                          color: '#666',
                          fontSize: 14,
                          textAlign: 'center',
                          maxWidth: 200,
                        }}
                      >
                        {t('redeem.startCameraHint')}
                      </Text>
                    </View>

                    {/* Permission info */}
                    {permission && !permission.granted && (
                      <View
                        style={{
                          position: 'absolute',
                          bottom: 20,
                          left: 20,
                          right: 20,
                          backgroundColor: 'rgba(255, 173, 49, 0.1)',
                          borderRadius: 8,
                          padding: 12,
                          borderWidth: 1,
                          borderColor: '#FFAD31',
                        }}
                      >
                        <Text
                          style={{
                            color: '#b45309',
                            fontSize: 12,
                            textAlign: 'center',
                          }}
                        >
                          {t('redeem.cameraPermissionRequired')}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Loading indicator when auto-redeeming */}
            {isLoading && (
              <View
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 16,
                  paddingVertical: 16,
                  marginBottom: 30,
                  justifyContent: 'center',
                  alignItems: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#FFAD31" style={{ marginRight: 8 }} />
                  <Text style={{ color: '#333', fontSize: 16, fontWeight: '600' }}>
                    {t('redeem.processing')}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </DismissKeyboardView>

      {/* Success Confirmation Popup */}
      <SuccessPopup
        isOpen={showSuccessConfirmation}
        onClose={handleCloseSuccessPopup}
        storeName={coupon?.store_name}
        couponDetail={coupon?.coupon_detail}
        couponName={redemptionData?.couponName || coupon?.coupon_name}
        discountValue={redemptionData?.discountValue}
        redeemedAt={redemptionData?.redeemedAt}
        redemptionId={redemptionData?.redemptionId}
        titleType={t('successPopup.redeemSuccess')}
      />

      {/* Error Toast */}
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
