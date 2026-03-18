import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { DismissKeyboardView } from '@/app/components/DismissKeyboardView';
import { unifiedRedemptionAPI, platformVoucherAPI } from '@/app/utils/authAPI';
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

  const handleBack = useCallback(() => {
    router.replace('/(tabs)/collection');
  }, [router]);

  const handleCodeChange = useCallback((text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (validationError) setValidationError(null);
  }, [validationError]);

  const handleSubmit = useCallback(async () => {
    const trimmed = code.trim();
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
  }, [code]);

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
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
              <ArrowLeft size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>輸入店家核銷碼</Text>
          </View>

          <View style={styles.content}>
            <Text style={styles.hint}>
              請輸入店家的 6 碼核銷碼，確認後將自動核銷一張可用的現金券
            </Text>
            <TextInput
              value={code}
              onChangeText={handleCodeChange}
              placeholder="000000"
              placeholderTextColor="#9CA3AF"
              maxLength={CODE_LENGTH}
              keyboardType="number-pad"
              editable={!isSubmitting}
              style={[
                styles.input,
                validationError ? styles.inputError : null,
              ]}
            />
            {validationError ? (
              <Text style={styles.errorText}>{validationError}</Text>
            ) : null}
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
          </View>
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
});
