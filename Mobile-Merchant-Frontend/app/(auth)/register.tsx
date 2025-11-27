import React, { useState } from 'react';
import { YStack, Text, XStack, ScrollView } from 'tamagui';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input, Button, AlertModal } from '@/components/ui';
import { colors } from '@/constants/colors';
import { RegisterFormData } from '@/types';
import LocationPicker from '@/app/components/LocationPicker';

export default function RegisterScreen() {
  const router = useRouter();
  const [formData, setFormData] = useState<RegisterFormData>({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleEmailChange = (text: string) => {
    setFormData((prev) => ({ ...prev, email: text }));
  };

  const handlePasswordChange = (text: string) => {
    setFormData((prev) => ({ ...prev, password: text }));
  };

  const [merchantData, setMerchantData] = useState({
    phone: '',
    contactPerson: '',
    contactInfo: '',
    storeName: '',
    storeAddress: '',
    storeLat: 0,
    storeLng: 0,
    businessHours: '',
  });
  const [hasSelectedLocation, setHasSelectedLocation] = useState(false);

  const handleRegister = async () => {
    if (!formData.email || !formData.password) {
      setErrorMessage('請輸入 Email 和密碼');
      setShowErrorModal(true);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setErrorMessage('請輸入有效的 Email 格式');
      setShowErrorModal(true);
      return;
    }

    // Password validation
    if (formData.password.length < 6) {
      setErrorMessage('密碼長度至少需要 6 個字元');
      setShowErrorModal(true);
      return;
    }

    // Validate merchant-specific fields
    if (!merchantData.phone || !merchantData.contactPerson || !merchantData.storeName || !merchantData.storeAddress) {
      setErrorMessage('請填寫所有必填欄位（電話、聯絡人、店家名稱、地址）');
      setShowErrorModal(true);
      return;
    }

    // Validate location selection
    if (!hasSelectedLocation || merchantData.storeLat === 0 || merchantData.storeLng === 0) {
      setErrorMessage('請在地圖上選擇店家位置');
      setShowErrorModal(true);
      return;
    }

    setIsLoading(true);
    try {
      const { authAPI } = await import('@/utils/api');
      console.log('[Register] Sending registration request:', {
        email: formData.email,
        user_type: 'merchant',
        hasPhone: !!merchantData.phone,
        hasContactPerson: !!merchantData.contactPerson,
        hasStoreName: !!merchantData.storeName,
        hasStoreAddress: !!merchantData.storeAddress,
      });
      
      const response = await authAPI.register({
        email: formData.email,
        password: formData.password,
        user_type: 'merchant',
        phone: merchantData.phone,
        contact_person: merchantData.contactPerson,
        contact_info: merchantData.contactInfo,
        store_name: merchantData.storeName,
        store_address: merchantData.storeAddress,
        store_lat: merchantData.storeLat,
        store_lng: merchantData.storeLng,
        business_hours: merchantData.businessHours,
      });
      
      console.log('[Register] Registration successful:', response);
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('[Register] Registration error:', error);
      // Extract error message, handling both Error objects and API response errors
      let errorMsg = '註冊失敗，請稍後再試';
      if (error?.message) {
        errorMsg = error.message;
        // If error message contains field-specific errors, format them nicely
        if (typeof error.message === 'object') {
          const errorObj = error.message;
          const fieldErrors = Object.entries(errorObj)
            .map(([field, messages]: [string, any]) => {
              const fieldName = field.replace(/_/g, ' ');
              const msg = Array.isArray(messages) ? messages.join(', ') : messages;
              return `${fieldName}: ${msg}`;
            })
            .join('\n');
          errorMsg = fieldErrors || errorMsg;
        }
      } else if (typeof error === 'string') {
        errorMsg = error;
      }
      setErrorMessage(errorMsg);
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccessConfirm = () => {
    setShowSuccessModal(false);
    // Use replace instead of back since we used replace to navigate here
    router.replace('/(auth)/login');
  };

  const handleLoginPress = () => {
    // Use replace instead of back since we used replace to navigate here
    router.replace('/(auth)/login');
  };

  const handleLocationSelect = (latitude: number, longitude: number) => {
    setMerchantData((prev) => ({
      ...prev,
      storeLat: latitude,
      storeLng: longitude,
    }));
    setHasSelectedLocation(true);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <YStack
        flex={1}
        backgroundColor={colors.background}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 40,
            gap: 12,
          }}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <XStack width="100%" justifyContent="center" alignItems="center" marginTop="$2" marginBottom="$4">
            <Text
              fontSize={34}
              fontWeight="800"
              color={colors.textPrimary}
              style={{ lineHeight: 42.5 }}
            >
              註冊
            </Text>
          </XStack>

      {/* Email Input */}
      <Input
        placeholder="輸入 Email"
        value={formData.email}
        onChangeText={handleEmailChange}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        editable={!isLoading}
        width="100%"
      />

      {/* Password Input */}
      <Input
        placeholder="輸入密碼"
        value={formData.password}
        onChangeText={handlePasswordChange}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
        editable={!isLoading}
        width="100%"
      />

      {/* Merchant-specific fields */}
      <Input
        placeholder="電話號碼"
        value={merchantData.phone}
        onChangeText={(text) => setMerchantData((prev) => ({ ...prev, phone: text }))}
        keyboardType="phone-pad"
        editable={!isLoading}
        width="100%"
      />

      <Input
        placeholder="聯絡人姓名"
        value={merchantData.contactPerson}
        onChangeText={(text) => setMerchantData((prev) => ({ ...prev, contactPerson: text }))}
        editable={!isLoading}
        width="100%"
      />

      <Input
        placeholder="店家名稱"
        value={merchantData.storeName}
        onChangeText={(text) => setMerchantData((prev) => ({ ...prev, storeName: text }))}
        editable={!isLoading}
        width="100%"
      />

      <Input
        placeholder="店家地址"
        value={merchantData.storeAddress}
        onChangeText={(text) => setMerchantData((prev) => ({ ...prev, storeAddress: text }))}
        editable={!isLoading}
        width="100%"
      />

      {/* Location Picker */}
      <YStack width="100%" gap="$2" marginTop="$2">
        <Text fontSize="$md" fontWeight="600" color={colors.textPrimary}>
          選擇店家位置 *
        </Text>
        <LocationPicker
          onLocationSelect={handleLocationSelect}
          height={250}
        />
        {!hasSelectedLocation && (
          <Text fontSize="$sm" color={colors.textSecondary}>
            請在地圖上點擊或拖動標記來選擇位置
          </Text>
        )}
      </YStack>

      <Input
        placeholder="營業時間（選填）"
        value={merchantData.businessHours}
        onChangeText={(text) => setMerchantData((prev) => ({ ...prev, businessHours: text }))}
        editable={!isLoading}
        width="100%"
      />

      {/* Register Button */}
      <Button
        variant="primary"
        fullWidth
        onPress={handleRegister}
        disabled={isLoading}
        opacity={isLoading ? 0.6 : 1}
      >
        註冊
      </Button>

      {/* Login Link */}
      <XStack gap={10} justifyContent="center" alignItems="center" width="100%">
        <Text fontSize="$sm" color={colors.textPrimary} textAlign="center">
          已經有帳號了嗎 ?{' '}
          <Text
            fontSize="$sm"
            color={colors.primary}
            onPress={handleLoginPress}
            style={{ textDecorationLine: 'underline' }}
          >
            登入
          </Text>
        </Text>
      </XStack>

      {/* Success Modal */}
      <AlertModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="註冊成功"
        message="您的帳號已成功註冊！"
        type="success"
        confirmText="確定"
        onConfirm={handleSuccessConfirm}
      />

      {/* Error Modal */}
      <AlertModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="註冊失敗"
        message={errorMessage}
        type="error"
        confirmText="確定"
      />
        </ScrollView>
      </YStack>
    </SafeAreaView>
  );
}

