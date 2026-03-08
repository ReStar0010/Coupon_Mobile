import React, { useState } from 'react';
import { StyleSheet, Modal, TouchableOpacity, View } from 'react-native';
import { YStack, Text, XStack, ScrollView } from 'tamagui';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input, Button, AlertModal } from '@/components/ui';
import { DismissKeyboardView } from '@/app/components/DismissKeyboardView';
import { colors } from '@/constants/colors';
import { RegisterFormData } from '@/types';
import LocationPicker from '@/app/components/LocationPicker';

export default function RegisterScreen() {
  const router = useRouter();
  const [formData, setFormData] = useState<RegisterFormData>({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [verificationRequired, setVerificationRequired] = useState(false);

  const handleEmailChange = (text: string) => {
    setFormData((prev) => ({ ...prev, email: text }));
  };

  const handlePasswordChange = (text: string) => {
    setFormData((prev) => ({ ...prev, password: text }));
  };

  /** 台灣手機號碼：09 開頭，共 10 碼數字 */
  const TAIWAN_PHONE_REGEX = /^09\d{8}$/;
  const handlePhoneChange = (text: string) => {
    const digitsOnly = text.replace(/\D/g, "").slice(0, 10);
    setMerchantData((prev) => ({ ...prev, phone: digitsOnly }));
  };

  const [merchantData, setMerchantData] = useState({
    phone: "",
    contactPerson: "",
    contactInfo: "",
    storeName: "",
    storeAddress: "",
    storeLat: 0,
    storeLng: 0,
    businessHours: "",
  });
  const [hasSelectedLocation, setHasSelectedLocation] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);

  const handleRegister = async () => {
    if (!formData.email || !formData.password) {
      setErrorMessage("請輸入 Email 和密碼");
      setShowErrorModal(true);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setErrorMessage("請輸入有效的 Email 格式");
      setShowErrorModal(true);
      return;
    }

    // Password validation
    if (formData.password.length < 6) {
      setErrorMessage("密碼長度至少需要 6 個字元");
      setShowErrorModal(true);
      return;
    }

    // 必填：電話號碼
    if (!merchantData.phone) {
      setErrorMessage("請輸入電話號碼");
      setShowErrorModal(true);
      return;
    }

    // 台灣手機號碼格式：0912345678（09 開頭，共 10 碼）
    if (!TAIWAN_PHONE_REGEX.test(merchantData.phone)) {
      setErrorMessage(
        "請輸入正確的台灣手機號碼（09 開頭，共 10 碼，例如：0912345678）",
      );
      setShowErrorModal(true);
      return;
    }

    setIsLoading(true);
    try {
      const { authAPI } = await import("@/utils/api");
      console.log("[Register] Sending registration request:", {
        email: formData.email,
        user_type: "merchant",
        hasPhone: !!merchantData.phone,
        hasContactPerson: !!merchantData.contactPerson,
        hasStoreName: !!merchantData.storeName,
        hasStoreAddress: !!merchantData.storeAddress,
      });

      const response = await authAPI.register({
        email: formData.email,
        password: formData.password,
        user_type: "merchant",
        phone: merchantData.phone,
        contact_person: merchantData.contactPerson,
        contact_info: merchantData.contactInfo,
        store_name: merchantData.storeName,
        store_address: merchantData.storeAddress,
        store_lat: merchantData.storeLat,
        store_lng: merchantData.storeLng,
        business_hours: merchantData.businessHours,
      });

      console.log("[Register] Registration successful:", response);

      // Check if verification is required
      setVerificationRequired(response.verification_required || false);
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error("[Register] Registration error:", error);
      // Extract error message, handling both Error objects and API response errors
      let errorMsg = "註冊失敗，請稍後再試";
      if (error?.message) {
        errorMsg = error.message;
        // If error message contains field-specific errors, format them nicely
        if (typeof error.message === "object") {
          const errorObj = error.message;
          const fieldErrors = Object.entries(errorObj)
            .map(([field, messages]: [string, any]) => {
              const fieldName = field.replace(/_/g, " ");
              const msg = Array.isArray(messages)
                ? messages.join(", ")
                : messages;
              return `${fieldName}: ${msg}`;
            })
            .join("\n");
          errorMsg = fieldErrors || errorMsg;
        }
      } else if (typeof error === "string") {
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
    router.replace("/(auth)/login");
  };

  const handleLoginPress = () => {
    // Use replace instead of back since we used replace to navigate here
    router.replace("/(auth)/login");
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
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
    >
      <DismissKeyboardView>
        <YStack flex={1} style={styles.mainStack}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* Title */}
            <XStack width="100%" style={styles.titleRow}>
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
              placeholder="Email（必填）"
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
              placeholder="密碼（必填）"
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
              placeholder="電話號碼（必填，例：0912345678）"
              value={merchantData.phone}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
              maxLength={10}
              editable={!isLoading}
              width="100%"
            />

            <Input
              placeholder="聯絡人姓名（選填）"
              value={merchantData.contactPerson}
              onChangeText={(text) =>
                setMerchantData((prev) => ({ ...prev, contactPerson: text }))
              }
              editable={!isLoading}
              width="100%"
            />

            <Input
              placeholder="店家名稱（選填）"
              value={merchantData.storeName}
              onChangeText={(text) =>
                setMerchantData((prev) => ({ ...prev, storeName: text }))
              }
              editable={!isLoading}
              width="100%"
            />

            <Input
              placeholder="店家地址（選填）"
              value={merchantData.storeAddress}
              onChangeText={(text) =>
                setMerchantData((prev) => ({ ...prev, storeAddress: text }))
              }
              editable={!isLoading}
              width="100%"
            />

            {/* Location trigger: opens map in Modal so scroll is never affected */}
            <YStack width="100%" style={styles.locationSection}>
              <Text fontSize="$md" fontWeight="600" color={colors.textPrimary} marginBottom="$2">
                選擇店家位置（選填）
              </Text>
              <TouchableOpacity
                style={styles.locationTrigger}
                onPress={() => setShowLocationModal(true)}
                activeOpacity={0.7}
              >
                <Text
                  fontSize="$md"
                  color={hasSelectedLocation ? colors.textPrimary : colors.textSecondary}
                  numberOfLines={1}
                >
                  {hasSelectedLocation
                    ? `已選擇：${merchantData.storeLat.toFixed(4)}, ${merchantData.storeLng.toFixed(4)}`
                    : '點擊選擇位置'}
                </Text>
                <Text fontSize="$sm" color={colors.primary} marginTop="$1">
                  開啟地圖選擇
                </Text>
              </TouchableOpacity>
            </YStack>

            <Input
              placeholder="營業時間（選填）"
              value={merchantData.businessHours}
              onChangeText={(text) =>
                setMerchantData((prev) => ({ ...prev, businessHours: text }))
              }
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
            <XStack gap={10} width="100%" style={styles.loginLinkRow}>
              <Text
                fontSize="$sm"
                color={colors.textPrimary}
                style={styles.loginLinkText}
              >
                已經有帳號了嗎 ?{" "}
                <Text
                  fontSize="$sm"
                  color={colors.primary}
                  onPress={handleLoginPress}
                  style={{ textDecorationLine: "underline" }}
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
              message={
                verificationRequired && formData.email
                  ? `您的帳號已成功註冊！\n\n我們已發送驗證郵件到 ${formData.email}，請點擊郵件中的連結完成驗證後即可登入。\n\n若未收到郵件，請檢查垃圾郵件資料夾。`
                  : "您的帳號已成功註冊！"
              }
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

        {/* Location picker modal: map outside scroll tree so it never affects scrolling */}
        <Modal
          visible={showLocationModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowLocationModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <XStack alignItems="center" justifyContent="space-between" style={styles.modalHeader}>
                <Text fontSize={18} fontWeight="700" color={colors.textPrimary}>
                  選擇店家位置
                </Text>
                <TouchableOpacity
                  onPress={() => setShowLocationModal(false)}
                  activeOpacity={0.7}
                  style={styles.modalCloseButton}
                >
                  <Text fontSize="$md" color={colors.primary}>
                    關閉
                  </Text>
                </TouchableOpacity>
              </XStack>
              <View style={styles.modalMapWrapper}>
                <LocationPicker
                  initialLatitude={merchantData.storeLat || undefined}
                  initialLongitude={merchantData.storeLng || undefined}
                  onLocationSelect={handleLocationSelect}
                  height={300}
                />
              </View>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={() => setShowLocationModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalConfirmText}>確定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </DismissKeyboardView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainStack: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 12,
  },
  titleRow: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  locationSection: {
    width: "100%",
    marginTop: 8,
  },
  locationTrigger: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  modalHeader: {
    marginBottom: 16,
  },
  modalCloseButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  modalMapWrapper: {
    width: '100%',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalConfirmButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  loginLinkRow: {
    gap: 10,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  loginLinkText: {
    textAlign: "center",
  },
});
