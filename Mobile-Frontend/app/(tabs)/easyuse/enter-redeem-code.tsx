import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Camera as CameraIcon } from 'lucide-react-native';
import { CameraView, CameraType, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { DismissKeyboardView } from '@/app/components/DismissKeyboardView';
import { unifiedRedemptionAPI, platformVoucherAPI } from '@/app/utils/authAPI';
import { parseUnifiedStoreCodeFromScan } from '@/app/utils/unifiedStoreCode';
import Toast from './[id]/redeem/Toast';
import SuccessPopup from './[id]/redeem/SuccessPopup';

const CODE_LENGTH = 6;

export default function EnterRedeemCodeScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorToastMessage, setErrorToastMessage] = useState('');
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successData, setSuccessData] = useState<{
    storeName?: string;
    couponName?: string;
    discountValue?: number | string;
    redeemedAt?: string;
  } | null>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [facing] = useState<CameraType>('back');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const lastScannedTimeRef = useRef(0);
  const lastScannedCodeRef = useRef('');

  const handleBack = useCallback(() => {
    router.replace('/(tabs)/collection');
  }, [router]);

  const handleCodeChange = useCallback((text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (validationError) setValidationError(null);
  }, [validationError]);

  const redeemWithStoreCode = useCallback(async (sixDigitCode: string) => {
    const trimmed = sixDigitCode.trim();
    if (trimmed.length !== CODE_LENGTH || !/^\d{6}$/.test(trimmed)) {
      setValidationError('請輸入 6 碼數字核銷碼');
      return;
    }
    setValidationError(null);
    setShowErrorToast(false);
    setIsSubmitting(true);

    try {
      const response = await unifiedRedemptionAPI.validateUnifiedRedemptionCode(trimmed);
      const vouchers = response.available_platform_vouchers ?? [];

      if (vouchers.length === 0) {
        setErrorToastMessage('沒有可兌換的現金券');
        setShowErrorToast(true);
        return;
      }

      const storeName = response.store?.name;
      const voucher = vouchers[0];
      await platformVoucherAPI.redeem(voucher.id, trimmed);
      setSuccessData({
        storeName,
        couponName: '平台現金券',
        discountValue: voucher.face_value,
      });
      setShowSuccessPopup(true);
    } catch (err: unknown) {
      const msg =
        err && typeof (err as { response?: { data?: { error?: string } } })?.response?.data?.error === 'string'
          ? (err as { response: { data: { error: string } } }).response.data.error
          : '核銷失敗，請稍後再試';
      setErrorToastMessage(msg);
      setShowErrorToast(true);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const handleSubmit = useCallback(() => {
    void redeemWithStoreCode(code);
  }, [code, redeemWithStoreCode]);

  const requestCameraPermission = useCallback(async () => {
    if (!permission) return false;
    if (permission.granted) return true;
    if (permission.canAskAgain) {
      const { granted } = await requestPermission();
      return granted;
    }
    Alert.alert('需要相機權限', '請在設定中允許 CouPro 使用相機以掃描店家核銷 QR Code。', [
      { text: '關閉', style: 'cancel' },
    ]);
    return false;
  }, [permission, requestPermission]);

  const toggleCamera = useCallback(async () => {
    if (isCameraActive) {
      setIsCameraActive(false);
      setIsScanning(false);
    } else {
      const ok = await requestCameraPermission();
      if (ok) {
        setIsCameraActive(true);
        setIsScanning(true);
      }
    }
  }, [isCameraActive, requestCameraPermission]);

  const handleBarCodeScanned = useCallback(
    async ({ data }: BarcodeScanningResult) => {
      if (!isScanning || isSubmitting) return;

      const now = Date.now();
      const raw = data.trim();
      const parsed = parseUnifiedStoreCodeFromScan(raw);
      if (!parsed) {
        if (raw === lastScannedCodeRef.current && now - lastScannedTimeRef.current < 3000) {
          return;
        }
        lastScannedTimeRef.current = now;
        lastScannedCodeRef.current = raw;
        setIsCameraActive(false);
        setIsScanning(false);
        setErrorToastMessage('無法從 QR Code 辨識 6 碼店家核銷碼，請改用手動輸入。');
        setShowErrorToast(true);
        return;
      }

      if (parsed === lastScannedCodeRef.current && now - lastScannedTimeRef.current < 3000) {
        return;
      }
      lastScannedTimeRef.current = now;
      lastScannedCodeRef.current = parsed;
      setIsScanning(false);
      setCode(parsed);
      setIsCameraActive(false);
      await redeemWithStoreCode(parsed);
    },
    [isScanning, isSubmitting, redeemWithStoreCode],
  );

  useEffect(() => {
    return () => {
      setIsCameraActive(false);
      setIsScanning(false);
    };
  }, []);

  const handleCloseSuccessPopup = useCallback(() => {
    setShowSuccessPopup(false);
    setSuccessData(null);
    router.replace('/(tabs)/collection');
  }, [router]);

  const handleHideErrorToast = useCallback(() => {
    setShowErrorToast(false);
    setErrorToastMessage('');
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <DismissKeyboardView>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
                <ArrowLeft size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>輸入店家核銷碼</Text>
            </View>

            <View style={styles.content}>
              <Text style={styles.hint}>
                請輸入店家的 6 碼核銷碼，確認後將自動核銷一張可用的現金券；或使用下方相機掃描 QR
                Code。
              </Text>
              <TextInput
                value={code}
                onChangeText={handleCodeChange}
                placeholder="000000"
                placeholderTextColor="#9CA3AF"
                maxLength={CODE_LENGTH}
                keyboardType="number-pad"
                editable={!isSubmitting}
                style={[styles.input, validationError ? styles.inputError : null]}
              />
              {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (code.length !== CODE_LENGTH || isSubmitting) && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                activeOpacity={0.7}
                disabled={code.length !== CODE_LENGTH || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#333" />
                ) : (
                  <Text style={styles.submitButtonText}>確認</Text>
                )}
              </TouchableOpacity>

              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>或</Text>
                <View style={styles.orLine} />
              </View>

              <View style={styles.cameraCard}>
                {isCameraActive && permission?.granted ? (
                  <View style={styles.cameraActiveWrap}>
                    <CameraView
                      style={styles.cameraView}
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
                      <View style={styles.cameraOverlay}>
                        <View style={styles.scanFrame} />
                        <Text style={styles.scanHint}>
                          {isScanning ? '請對準店家核銷 QR Code' : '處理中…'}
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.closeCamBtn} onPress={toggleCamera} hitSlop={12}>
                        <Text style={styles.closeCamText}>關閉</Text>
                      </TouchableOpacity>
                    </CameraView>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.cameraPlaceholder}
                    onPress={toggleCamera}
                    activeOpacity={0.85}
                    disabled={isSubmitting}
                  >
                    <CameraIcon size={40} color="#6B7280" />
                    <Text style={styles.cameraPlaceholderTitle}>掃描 QR Code</Text>
                    <Text style={styles.cameraPlaceholderSub}>點此開啟相機，掃描含 6 碼核銷資訊的條碼</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </DismissKeyboardView>

      <Toast
        visible={showErrorToast}
        message={errorToastMessage}
        onHide={handleHideErrorToast}
        type="error"
        duration={4000}
      />
      <SuccessPopup
        isOpen={showSuccessPopup}
        onClose={handleCloseSuccessPopup}
        storeName={successData?.storeName}
        couponName={successData?.couponName}
        discountValue={successData?.discountValue}
        redeemedAt={successData?.redeemedAt}
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  hint: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 22,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 24,
    letterSpacing: 8,
    color: '#333',
    textAlign: 'center',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    marginTop: 8,
  },
  submitButton: {
    marginTop: 32,
    backgroundColor: '#FFAD31',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 20,
    gap: 12,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  orText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  cameraCard: {
    minHeight: 280,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  cameraPlaceholder: {
    minHeight: 280,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#f8f9fa',
  },
  cameraPlaceholderTitle: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: '600',
    color: '#374151',
  },
  cameraPlaceholderSub: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  cameraActiveWrap: {
    height: 300,
    position: 'relative',
  },
  cameraView: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  scanFrame: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: '#FFAD31',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  scanHint: {
    position: 'absolute',
    bottom: 24,
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeCamBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  closeCamText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 15,
  },
});
