import React, { useState, useEffect } from 'react';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/constants/colors';
import { Input } from '@/components/ui';
import { Button } from '@/components/ui';
import { StyleSheet, TouchableOpacity, View, TextInput, Switch, Alert } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image as ExpoImage } from 'expo-image';
import { DeleteModal } from './components/DeleteModal';
import { merchantAPI } from '@/utils/api';

export default function CouponEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditMode = !!id;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [image, setImage] = useState<string | null>(null);
  const [couponName, setCouponName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [couponContent, setCouponContent] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [couponType, setCouponType] = useState<'一般' | '共享'>('共享');
  const [limitPerDay, setLimitPerDay] = useState(false);
  const [tags, setTags] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  // Load existing coupon data if in edit mode
  useEffect(() => {
    if (isEditMode && id) {
      loadCouponData(parseInt(id));
    }
  }, [isEditMode, id]);

  const loadCouponData = async (couponId: number) => {
    try {
      setIsLoading(true);
      const data = await merchantAPI.getTemplate(couponId);
      setCouponName(data.coupon_name || '');
      setCouponContent(data.coupon_detail || '');
      setNotes(data.important_notes || '');
      setImage(data.image_url || null);
      setQuantity(String(data.total_quantity || 1));
      setVerificationCode(data.template_redeem_code || '');
      if (data.start_date) {
        setStartTime(new Date(data.start_date).toISOString().slice(0, 16));
      }
      if (data.end_date) {
        setEndTime(new Date(data.end_date).toISOString().slice(0, 16));
      }
    } catch (error) {
      console.error('Failed to load coupon:', error);
      Alert.alert('錯誤', '無法載入優惠券資料');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async () => {
    // TODO: Install expo-image-picker and implement image upload
    // For now, this is a placeholder
    try {
      // Uncomment when expo-image-picker is installed:
      // const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      // if (status !== 'granted') {
      //   alert('需要相機權限才能上傳圖片');
      //   return;
      // }
      // const result = await ImagePicker.launchImageLibraryAsync({
      //   mediaTypes: ImagePicker.MediaTypeOptions.Images,
      //   allowsEditing: true,
      //   aspect: [1, 1],
      //   quality: 1,
      // });
      // if (!result.canceled && result.assets[0]) {
      //   setImage(result.assets[0].uri);
      // }
      alert('圖片上傳功能需要安裝 expo-image-picker');
    } catch (error) {
      console.error('Image upload error:', error);
    }
  };

  const handleSave = async () => {
    if (!couponName || !couponContent || !startTime || !endTime || !quantity) {
      Alert.alert('錯誤', '請填寫所有必填欄位');
      return;
    }

    try {
      setIsSaving(true);
      const couponData = {
        coupon_name: couponName,
        coupon_detail: couponContent,
        important_notes: notes,
        image_url: image || '',
        total_quantity: parseInt(quantity) || 1,
        template_redeem_code: verificationCode || undefined,
        start_date: new Date(startTime).toISOString(),
        expiry_date: new Date(endTime).toISOString(),
        draw_probability: 0.5,
        is_active: true,
        tags: [],
      };

      if (isEditMode && id) {
        await merchantAPI.updateTemplate(parseInt(id), couponData);
        Alert.alert('成功', '優惠券已更新');
      } else {
        await merchantAPI.createTemplate(couponData);
        Alert.alert('成功', '優惠券已建立');
      }
      router.back();
    } catch (error: any) {
      console.error('Failed to save coupon:', error);
      Alert.alert('錯誤', error?.message || '儲存失敗，請稍後再試');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!id) return;
    
    try {
      await merchantAPI.deleteTemplate(parseInt(id));
      Alert.alert('成功', '優惠券已刪除');
      setShowDeleteModal(false);
      router.back();
    } catch (error: any) {
      console.error('Failed to delete coupon:', error);
      Alert.alert('錯誤', error?.message || '刪除失敗，請稍後再試');
      setShowDeleteModal(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={['top']}>
      <YStack flex={1} backgroundColor={colors.white}>
        {/* Header with Back and Delete */}
        <XStack
          paddingHorizontal="$4"
          paddingVertical="$3"
          backgroundColor={colors.white}
          alignItems="center"
          justifyContent="space-between"
          borderBottomWidth={1}
          borderBottomColor={colors.border}
        >
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <MaterialIcons name="chevron-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          {isEditMode && (
            <TouchableOpacity onPress={handleDeleteClick} activeOpacity={0.7}>
              <MaterialIcons name="delete" size={24} color={colors.error} />
            </TouchableOpacity>
          )}
        </XStack>

        <ScrollView
          flex={1}
          paddingHorizontal="$4"
          paddingTop="$4"
          paddingBottom="$6"
          showsVerticalScrollIndicator={false}
        >
          {/* Image Upload Section */}
          <YStack gap="$3" marginBottom="$4">
            <View style={styles.imageContainer}>
              {image ? (
                <ExpoImage source={{ uri: image }} style={styles.image} contentFit="cover" />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.placeholderText}>政</Text>
                  <Text style={styles.placeholderText}>大</Text>
                  <Text style={styles.placeholderText}>茶</Text>
                  <Text style={styles.placeholderText}>亭</Text>
                </View>
              )}
            </View>
            <Button variant="primary" onPress={handleImageUpload}>
              上傳圖片
            </Button>
          </YStack>

          {/* Form Fields */}
          <YStack gap="$4">
            {/* 優惠名稱 */}
            <FormField
              label="優惠名稱"
              value={couponName}
              onChangeText={setCouponName}
              placeholder="輸入優惠名稱"
            />

            {/* 開始時間 */}
            <FormField
              label="開始時間"
              value={startTime}
              onChangeText={setStartTime}
              placeholder="選擇開始時間"
            />

            {/* 結束時間 */}
            <FormField
              label="結束時間"
              value={endTime}
              onChangeText={setEndTime}
              placeholder="選擇結束時間"
            />

            {/* 優惠內容 */}
            <FormField
              label="優惠內容"
              value={couponContent}
              onChangeText={setCouponContent}
              placeholder="輸入優惠內容"
              multiline
            />

            {/* 優惠數量 */}
            <FormField
              label="優惠數量"
              value={quantity}
              onChangeText={setQuantity}
              placeholder="輸入數量或 unlimited"
            />

            {/* 注意事項 */}
            <FormField
              label="注意事項"
              value={notes}
              onChangeText={setNotes}
              placeholder="輸入注意事項"
              multiline
            />

            {/* 優惠類型 */}
            <YStack gap="$2">
              <Text fontSize="$md" fontWeight="500" color={colors.textPrimary}>
                優惠類型(一般、共享)
              </Text>
              <XStack gap="$3">
                <TouchableOpacity
                  onPress={() => setCouponType('一般')}
                  style={[
                    styles.radioButton,
                    couponType === '一般' && styles.radioButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.radioText,
                      couponType === '一般' && styles.radioTextActive,
                    ]}
                  >
                    一般
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setCouponType('共享')}
                  style={[
                    styles.radioButton,
                    couponType === '共享' && styles.radioButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.radioText,
                      couponType === '共享' && styles.radioTextActive,
                    ]}
                  >
                    共享
                  </Text>
                </TouchableOpacity>
              </XStack>
            </YStack>

            {/* 每天限用一次 */}
            <XStack alignItems="center" justifyContent="space-between">
              <Text fontSize="$md" fontWeight="500" color={colors.textPrimary}>
                每天限用一次
              </Text>
              <XStack alignItems="center" gap="$2">
                <Text fontSize="$md" color={colors.textSecondary}>
                  {limitPerDay ? '是' : '否'}
                </Text>
                <Switch
                  value={limitPerDay}
                  onValueChange={setLimitPerDay}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.white}
                />
              </XStack>
            </XStack>

            {/* 標籤 */}
            <FormField
              label="標籤"
              value={tags}
              onChangeText={setTags}
              placeholder="輸入標籤"
            />

            {/* 核銷碼 */}
            <FormField
              label="核銷碼"
              value={verificationCode}
              onChangeText={setVerificationCode}
              placeholder="輸入核銷碼"
            />
          </YStack>
        </ScrollView>

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

        {/* Delete Modal */}
        <DeleteModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteConfirm}
        />
      </YStack>
    </SafeAreaView>
  );
}

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
}

function FormField({ label, value, onChangeText, placeholder, multiline }: FormFieldProps) {
  return (
    <YStack gap="$2">
      <Text fontSize="$md" fontWeight="500" color={colors.textPrimary}>
        {label}
      </Text>
      <TextInput
        style={[
          styles.input,
          multiline && styles.inputMultiline,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
      />
    </YStack>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#1E3A8A',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  placeholderText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.white,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.white,
    minHeight: 44,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  radioButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  radioButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  radioText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  radioTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  saveButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
});

