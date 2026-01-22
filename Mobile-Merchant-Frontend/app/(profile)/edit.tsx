import React, { useState, useEffect } from 'react';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { Button, PermissionDeniedModal, AlertModal } from '@/components/ui';
import { StyleSheet, TouchableOpacity, View, TextInput, Alert, Platform } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { getAbsoluteImageUrl, MerchantProfileResponse } from '@/utils/api';
import LocationPicker from '@/app/components/LocationPicker';
import EULAModal from '@/app/components/EULAModal';
import { useEULACheck } from '@/app/hooks/useEULACheck';

interface EditableFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  showDropdown?: boolean;
  onPress?: () => void;
}

function EditableField({ 
  label, 
  value, 
  onChangeText, 
  placeholder, 
  showDropdown = false,
  onPress 
}: EditableFieldProps) {
  return (
    <XStack
      paddingVertical="$3"
      borderBottomWidth={1}
      borderBottomColor={colors.border}
      alignItems="center"
      justifyContent="space-between"
    >
      <Text fontSize="$md" fontWeight="500" color={colors.textPrimary} width={100}>
        {label}
      </Text>
      <TouchableOpacity 
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
        style={{ flex: 1 }}
        disabled={!onPress}
      >
        <XStack alignItems="center" justifyContent="space-between" flex={1}>
          {showDropdown ? (
            <>
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.textSecondary}
                editable={!onPress}
              />
              <MaterialIcons name="keyboard-arrow-down" size={20} color={colors.textSecondary} />
            </>
          ) : (
            <TextInput
              style={[styles.input, styles.underlinedInput]}
              value={value}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor={colors.textSecondary}
            />
          )}
        </XStack>
      </TouchableOpacity>
    </XStack>
  );
}

// 商家類型選項
const STORE_TYPES = [
  { label: '餐飲', value: 'restaurant' },
  { label: '零售', value: 'retail' },
  { label: '服務', value: 'service' },
  { label: '娛樂', value: 'entertainment' },
  { label: '美容', value: 'beauty' },
  { label: '教育', value: 'education' },
  { label: '醫療', value: 'medical' },
  { label: '其他', value: 'other' },
];

export default function ProfileEditScreen() {
  const router = useRouter();
  
  const [storeName, setStoreName] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [type, setType] = useState('');
  const [businessHours, setBusinessHours] = useState('');
  const [storeLat, setStoreLat] = useState<number>(0);
  const [storeLng, setStoreLng] = useState<number>(0);
  const [showTypePicker, setShowTypePicker] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const { merchantAPI } = await import('@/utils/api');
      const data: MerchantProfileResponse = await merchantAPI.getProfile();
      if (data.store) {
        setStoreName(data.store.name || '');
        setAddress(data.store.address || '');
        setPhoneNumber(data.merchant?.phone || '');
        setBusinessHours(data.store.business_hours || '');
        setStoreLat(data.store.lat || 0);
        setStoreLng(data.store.lng || 0);
        // Convert relative URL to absolute URL for image display
        const absoluteImageUrl = getAbsoluteImageUrl(data.store.image_url);
        setImageUrl(absoluteImageUrl || '');
        setImageUri(absoluteImageUrl || null);
        setType(data.store.store_type || '');
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // EULA check hook
  const { checkEULA, eulaModalVisible, hideEULAModal, onEULAAccepted } = useEULACheck();

  const pickImage = async () => {
    try {
      // Check EULA acceptance first (UGC Compliance)
      const eulaAccepted = await checkEULA();
      if (!eulaAccepted) {
        // User cancelled EULA or not accepted
        return;
      }

      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setShowPermissionModal(true);
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        
        // Show local preview immediately
        setImageUri(uri);
        
        // Show loading state
        setIsLoading(true);
        
        try {
          // Upload image to server
          const { merchantAPI } = await import('@/utils/api');
          const uploadedUrl = await merchantAPI.uploadImage(uri);
          
          // Update state with server URL
          setImageUrl(uploadedUrl);
          
          // Update preview to use server URL if available
          setImageUri(uploadedUrl);
          
          Alert.alert('成功', '圖片上傳成功');
        } catch (uploadError: any) {
          console.error('Image upload error:', uploadError);
          Alert.alert('錯誤', uploadError?.message || '圖片上傳失敗，請稍後再試');
          // Keep local URI for preview even if upload fails
        } finally {
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('錯誤', '選擇圖片時發生錯誤');
      setIsLoading(false);
    }
  };

  const handleLocationSelect = (latitude: number, longitude: number) => {
    setStoreLat(latitude);
    setStoreLng(longitude);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const { merchantAPI } = await import('@/utils/api');
      await merchantAPI.updateProfile({
        phone: phoneNumber,
        store_address: address,
        store_lat: storeLat,
        store_lng: storeLng,
        business_hours: businessHours,
        store_type: type,
        image_url: imageUrl,
      });
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Failed to save profile:', error);
      setErrorMessage(error?.message || '儲存失敗，請稍後再試');
      setShowErrorModal(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSuccessConfirm = () => {
    setShowSuccessModal(false);
    router.replace('/(profile)/');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <YStack flex={1} backgroundColor={colors.background}>
        {/* Header */}
        <XStack
          paddingHorizontal="$4"
          paddingVertical="$3"
          backgroundColor={colors.white}
          alignItems="center"
          borderBottomWidth={1}
          borderBottomColor={colors.border}
        >
          <TouchableOpacity onPress={() => router.replace('/(profile)/')} activeOpacity={0.7}>
            <MaterialIcons name="chevron-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text 
            fontSize={24} 
            fontWeight="700" 
            color={colors.textPrimary}
            style={{ marginLeft: 16 }}
          >
            選單
          </Text>
        </XStack>

        <ScrollView
          flex={1}
          paddingHorizontal="$4"
          paddingTop="$4"
          paddingBottom="$4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {/* Merchant Logo and Name Section */}
          <View style={styles.merchantSection}>
            <XStack alignItems="center" gap="$4">
              {/* Logo */}
              <TouchableOpacity onPress={pickImage} activeOpacity={0.7}>
                <View style={styles.logoContainer}>
                  {imageUri ? (
                    <ExpoImage
                      source={{ uri: imageUri }}
                      style={styles.logoImage}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.logoPlaceholder}>
                      <MaterialIcons name="image" size={32} color={colors.textSecondary} />
                      <Text style={styles.logoPlaceholderText}>沒有</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              
              {/* Merchant Name */}
              <Text style={styles.merchantNameText}>
                {storeName || '商家名稱'}
              </Text>
            </XStack>
          </View>

          {/* Information Fields */}
          <View style={styles.infoCard}>
            <XStack
              paddingVertical="$3"
              borderBottomWidth={1}
              borderBottomColor={colors.border}
              alignItems="center"
              justifyContent="space-between"
            >
              <Text fontSize="$md" fontWeight="500" color={colors.textPrimary} width={100}>
                上傳圖片
              </Text>
              <TouchableOpacity onPress={pickImage} activeOpacity={0.7} style={{ flex: 1 }}>
                <XStack alignItems="center" justifyContent="flex-end">
                  <Text fontSize="$md" color={colors.primary}>
                    選擇圖片
                  </Text>
                </XStack>
              </TouchableOpacity>
            </XStack>
            <EditableField
              label="地址"
              value={address}
              onChangeText={setAddress}
              placeholder="輸入地址"
            />
            {/* Location Picker */}
            <YStack
              paddingVertical="$3"
              borderBottomWidth={1}
              borderBottomColor={colors.border}
              gap="$2"
            >
              <Text fontSize="$md" fontWeight="500" color={colors.textPrimary} marginBottom="$2">
                店家位置
              </Text>
              <LocationPicker
                initialLatitude={storeLat || undefined}
                initialLongitude={storeLng || undefined}
                onLocationSelect={handleLocationSelect}
                height={250}
              />
            </YStack>
            <EditableField
              label="電話號碼"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="輸入電話號碼"
            />
            <EditableField
              label="類型"
              value={STORE_TYPES.find(t => t.value === type)?.label || type || ''}
              onChangeText={() => {}}
              placeholder="選擇類型"
              showDropdown
              onPress={() => {
                Alert.alert(
                  '選擇商家類型',
                  '',
                  [
                    ...STORE_TYPES.map(storeType => ({
                      text: storeType.label,
                      onPress: () => setType(storeType.value),
                    })),
                    { text: '取消', style: 'cancel' },
                  ],
                  { cancelable: true }
                );
              }}
            />
            <EditableField
              label="營業時間"
              value={businessHours}
              onChangeText={setBusinessHours}
              placeholder="輸入營業時間（例如：週一至週五 09:00-18:00）"
            />
          </View>

          {/* Save Button */}
          <View style={styles.saveButtonContainer}>
            <Button 
              variant="primary" 
              fullWidth 
              onPress={handleSave}
              disabled={isSaving || isLoading}
              opacity={isSaving || isLoading ? 0.6 : 1}
            >
              {isSaving ? '儲存中...' : '儲存'}
            </Button>
          </View>
        </ScrollView>
      </YStack>

      {/* Permission Denied Modal */}
      <PermissionDeniedModal
        isOpen={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        permissionType="photos"
      />

      {/* EULA Modal (UGC Compliance) */}
      <EULAModal
        visible={eulaModalVisible}
        onClose={hideEULAModal}
        onSuccess={onEULAAccepted}
      />

      {/* Success Modal */}
      <AlertModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title=""
        message="資料已更新"
        type="success"
        autoHideDurationMs={1500}
        onConfirm={handleSuccessConfirm}
      />

      {/* Error Modal */}
      <AlertModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title=""
        message={errorMessage}
        type="error"
        autoHideDurationMs={2000}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  merchantSection: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: colors.background,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  logoPlaceholderText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  merchantNameText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    fontSize: 16,
    color: colors.textPrimary,
    flex: 1,
    padding: 0,
    textDecorationLine: 'underline',
  },
  underlinedInput: {
    textDecorationLine: 'underline',
  },
  saveButtonContainer: {
    marginTop: 16,
    paddingHorizontal: 0,
  },
});

