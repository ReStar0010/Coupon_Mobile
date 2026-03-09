import React, { useState, useEffect, useCallback } from 'react';
import * as Sentry from '@sentry/react-native';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/constants/colors';
import { Button, PermissionDeniedModal } from '@/components/ui';
import { DismissKeyboardView } from '@/app/components/DismissKeyboardView';
import { StyleSheet, TouchableOpacity, View, TextInput, Switch, Alert } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { DeleteModal } from './components/DeleteModal';
import { merchantAPI, getAbsoluteImageUrl } from '@/utils/api';
import EULAModal from '@/app/components/EULAModal';
import { useEULACheck } from '@/app/hooks/useEULACheck';
import { useApiError } from '@/hooks/useApiError';

function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export default function CouponEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getErrorMessage } = useApiError();
  const isEditMode = !!id;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  // Form state
  const [image, setImage] = useState<string | null>(null);
  const [couponName, setCouponName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [couponContent, setCouponContent] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [estimatedSavings, setEstimatedSavings] = useState('');
  const [couponType, setCouponType] = useState<'隨取即用' | '專屬優惠'>('專屬優惠');
  const [limitPerDay, setLimitPerDay] = useState(false);
  const [drawProbability, setDrawProbability] = useState('50');
  // Tag state
  const [availableTags, setAvailableTags] = useState<
    { id: number; name: string; display_name: string }[]
  >([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [originalSelectedTags, setOriginalSelectedTags] = useState<number[]>([]);
  // Store original values for validation in edit mode
  const [originalTotalQuantity, setOriginalTotalQuantity] = useState<number | null>(null);
  const [remainingQuantity, setRemainingQuantity] = useState<number | null>(null);

  // Store original form data to detect changes
  const [originalData, setOriginalData] = useState<{
    couponName: string;
    couponContent: string;
    notes: string;
    estimatedSavings: string;
    image: string | null;
    quantity: string;
    startTime: string;
    endTime: string;
  } | null>(null);

  // Date time picker state
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  // Load tags on mount
  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await merchantAPI.getTags();
        setAvailableTags(tags);
      } catch (error) {
        console.error('Failed to load tags:', error);
        Sentry.captureException(error, { data: { context: 'merchant.couponEdit.loadTags' } });
      }
    };
    loadTags();
  }, []);

  const loadCouponData = useCallback(async (couponId: number) => {
    try {
      setIsLoading(true);
      const data = (await merchantAPI.getTemplate(couponId)) as any;
      setCouponName(data.coupon_name || '');
      setCouponContent(data.coupon_detail || '');
      setNotes(data.important_notes || '');
      // Convert relative URL to absolute URL for image display
      setImage(getAbsoluteImageUrl(data.image_url) || null);

      // Store original values for validation
      const totalQty = data.total_quantity || 0;
      const remainingQty = data.remaining_quantity || 0;
      setOriginalTotalQuantity(totalQty);
      setRemainingQuantity(remainingQty);

      // Determine coupon type based on total_quantity
      // If total_quantity > 0, it's '專屬優惠', otherwise '隨取即用'
      const type: '隨取即用' | '專屬優惠' = totalQty > 0 ? '專屬優惠' : '隨取即用';
      setCouponType(type);

      // Set quantity for display (only for '專屬優惠' type)
      if (type === '專屬優惠') {
        setQuantity(String(totalQty));
      }

      if (data.start_date) {
        const start = new Date(data.start_date);
        setStartTime(formatDateTime(start));
        setStartDate(start);
      }
      if (data.end_date) {
        const end = new Date(data.end_date);
        const endTimeStr = formatDateTime(end);
        setEndTime(endTimeStr);
        setEndDate(end);
      }

      // Load tags if available
      if (data.tags && Array.isArray(data.tags)) {
        setSelectedTags(data.tags);
        setOriginalSelectedTags(data.tags);
      }

      // Load draw probability if available (convert from 0-1 to 0-100)
      if (data.draw_probability !== undefined && data.draw_probability !== null) {
        setDrawProbability(String(Math.round(data.draw_probability * 100)));
      }

      // Load estimated savings (優惠金額) if available
      if (data.estimated_savings != null && data.estimated_savings !== '') {
        setEstimatedSavings(String(data.estimated_savings));
      } else {
        setEstimatedSavings('');
      }

      // Store original data for change detection
      const originalImageUrl = getAbsoluteImageUrl(data.image_url) || null;
      const originalQuantity = type === '專屬優惠' ? String(totalQty) : '1';
      const originalStartTime = data.start_date ? formatDateTime(new Date(data.start_date)) : '';
      const originalEndTime = data.end_date ? formatDateTime(new Date(data.end_date)) : '';

      const originalEstimatedSavings =
        data.estimated_savings != null && data.estimated_savings !== ''
          ? String(data.estimated_savings)
          : '';
      setOriginalData({
        couponName: data.coupon_name || '',
        couponContent: data.coupon_detail || '',
        notes: data.important_notes || '',
        estimatedSavings: originalEstimatedSavings,
        image: originalImageUrl,
        quantity: originalQuantity,
        startTime: originalStartTime,
        endTime: originalEndTime,
      });
    } catch (error) {
      console.error('Failed to load coupon:', error);
      Sentry.captureException(error, { data: { context: 'merchant.couponEdit.loadCoupon' } });
      Alert.alert('錯誤', getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load existing coupon data if in edit mode
  useEffect(() => {
    if (isEditMode && id) {
      loadCouponData(parseInt(id));
    }
  }, [id, isEditMode, loadCouponData]);

  // EULA check hook
  const { checkEULA, eulaModalVisible, hideEULAModal, onEULAAccepted } = useEULACheck();

  const handleImageUpload = async () => {
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

        // Show loading state
        setIsLoading(true);

        try {
          // Upload image to server
          const imageUrl = await merchantAPI.uploadImage(uri);

          // Update state with server URL
          setImage(imageUrl);

          Alert.alert('成功', '圖片上傳成功');
        } catch (uploadError: unknown) {
          console.error('Image upload error:', uploadError);
          Sentry.captureException(uploadError, {
            data: { context: 'merchant.couponEdit.uploadImage' },
          });
          Alert.alert('錯誤', getErrorMessage(uploadError));
        } finally {
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Sentry.captureException(error, { data: { context: 'merchant.couponEdit.pickImage' } });
      Alert.alert('錯誤', '選擇圖片時發生錯誤');
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    // 驗證必填欄位：優惠數量只在專屬優惠類型時必填
    if (!couponName || !couponContent || !startTime || !endTime) {
      Alert.alert('錯誤', '請填寫所有必填欄位');
      return;
    }

    // 建立優惠券前必須已接受 EULA（UGC 合規）；未上傳圖片的商家也會在此看到條款並同意
    if (!isEditMode) {
      const eulaAccepted = await checkEULA();
      if (!eulaAccepted) {
        return;
      }
    }
    if (couponType === '專屬優惠' && !quantity) {
      Alert.alert('錯誤', '請填寫優惠數量');
      return;
    }

    // Edit 模式：驗證優惠數量不能比已核銷數量少
    if (
      isEditMode &&
      couponType === '專屬優惠' &&
      originalTotalQuantity !== null &&
      remainingQuantity !== null
    ) {
      const newQuantity = parseInt(quantity) || 0;

      // 新數量必須 >= 原始 total_quantity（即已核銷數量）
      if (newQuantity < originalTotalQuantity) {
        Alert.alert('錯誤', `優惠數量不能少於已核銷數量（${originalTotalQuantity}），只能調高`);
        return;
      }
    }

    try {
      setIsSaving(true);

      // 生成隨機的六位數字核銷碼（使用更強的隨機性）
      const generateVerificationCode = (): string => {
        // 使用 crypto.getRandomValues 獲取更強的隨機數（如果可用）
        // 否則使用 Math.random() 結合時間戳增加隨機性
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
          const array = new Uint32Array(1);
          crypto.getRandomValues(array);
          // 使用隨機數生成 100000-999999 之間的數字
          return String(100000 + (array[0] % 900000));
        } else {
          // 後備方案：結合時間戳和隨機數增加隨機性
          const timestamp = Date.now();
          const random1 = Math.random();
          const random2 = Math.random();
          const combined = (timestamp * random1 * random2) % 900000;
          return String(100000 + Math.floor(combined));
        }
      };

      // Parse 優惠金額: non-negative number or undefined if empty/invalid
      const parsedSavings = estimatedSavings.trim() === '' ? null : parseFloat(estimatedSavings);
      const estimatedSavingsValue =
        parsedSavings != null && !Number.isNaN(parsedSavings) && parsedSavings >= 0
          ? parsedSavings
          : null;

      const couponData = {
        coupon_name: couponName,
        coupon_detail: couponContent,
        important_notes: notes,
        image_url: image || '',
        ...(estimatedSavingsValue != null && { estimated_savings: estimatedSavingsValue }),
        // 優惠數量：專屬優惠類型使用輸入的數量，隨取即用類型設為 0 或 undefined（根據後端需求）
        total_quantity: couponType === '專屬優惠' ? parseInt(quantity) || 1 : 0,
        // 核銷碼：自動生成隨機的六位數字
        template_redeem_code: generateVerificationCode(),
        start_date: new Date(startTime).toISOString(),
        expiry_date: new Date(endTime).toISOString(),
        draw_probability: couponType === '專屬優惠' ? (parseInt(drawProbability) || 50) / 100 : 0.5,
        is_active: true,
        tags: selectedTags,
      };

      if (isEditMode && id) {
        await merchantAPI.updateTemplate(parseInt(id), couponData);
        Alert.alert('成功', '優惠券已更新');
        // Update original data after successful save
        if (originalData) {
          setOriginalData({
            couponName,
            couponContent,
            notes,
            estimatedSavings,
            image: image || null,
            quantity: couponType === '專屬優惠' ? quantity : '1',
            startTime,
            endTime,
          });
        }
        // Update original selected tags after successful save
        setOriginalSelectedTags(selectedTags);
      } else {
        await merchantAPI.createTemplate(couponData);
        Alert.alert('成功', '優惠券已建立');
      }
      router.back();
    } catch (error: unknown) {
      console.error('Failed to save coupon:', error);
      Alert.alert('錯誤', getErrorMessage(error));
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
    } catch (error: unknown) {
      console.error('Failed to delete coupon:', error);
      Sentry.captureException(error, { data: { context: 'merchant.couponEdit.deleteCoupon' } });
      Alert.alert('錯誤', getErrorMessage(error));
      setShowDeleteModal(false);
    }
  };

  const handleStartDateChange = (selectedDate: Date) => {
    setShowStartDatePicker(false);
    setStartDate(selectedDate);
    setStartTime(formatDateTime(selectedDate));
  };

  const handleEndDateChange = (selectedDate: Date) => {
    setShowEndDatePicker(false);
    setEndDate(selectedDate);
    setEndTime(formatDateTime(selectedDate));
  };

  // Check if form data has changed (only for edit mode)
  const hasChanges = (): boolean => {
    if (!isEditMode || !originalData) {
      return true; // Always enable save button in create mode
    }

    // Compare current values with original values
    const currentQuantity = couponType === '專屬優惠' ? quantity : '1';

    // Compare tags by sorting and stringifying arrays
    const tagsChanged =
      JSON.stringify([...selectedTags].sort()) !== JSON.stringify([...originalSelectedTags].sort());

    return (
      couponName !== originalData.couponName ||
      couponContent !== originalData.couponContent ||
      notes !== originalData.notes ||
      estimatedSavings !== originalData.estimatedSavings ||
      image !== originalData.image ||
      currentQuantity !== originalData.quantity ||
      startTime !== originalData.startTime ||
      endTime !== originalData.endTime ||
      tagsChanged
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={['top', 'bottom']}>
      <DismissKeyboardView>
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
            paddingBottom="$4"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            keyboardDismissMode="on-drag"
          >
            {/* Image Upload Section */}
            <YStack gap="$3" marginBottom="$4">
              <TouchableOpacity onPress={handleImageUpload} activeOpacity={0.9}>
                <View style={styles.imageContainer}>
                  {image ? (
                    <ExpoImage source={{ uri: image }} style={styles.image} contentFit="cover" />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <MaterialIcons name="image" size={48} color={colors.textSecondary} />
                      <Text style={styles.placeholderText}>點擊上傳圖片</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
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
              <DateTimeField
                label="開始時間"
                value={startTime}
                placeholder="選擇開始時間"
                onPress={() => setShowStartDatePicker(true)}
              />

              {/* 結束時間 */}
              <DateTimeField
                label="結束時間"
                value={endTime}
                placeholder="選擇結束時間"
                onPress={() => setShowEndDatePicker(true)}
              />

              {/* 優惠內容 */}
              <FormField
                label="優惠內容"
                value={couponContent}
                onChangeText={setCouponContent}
                placeholder="輸入優惠內容"
                multiline
              />

              {/* 優惠金額 (元) - 選填，兌換後會計入使用者的節省總金額 */}
              <FormField
                label="優惠金額 (元)"
                value={estimatedSavings}
                onChangeText={(text) => {
                  const numericValue = text.replace(/[^0-9.]/g, '');
                  setEstimatedSavings(numericValue);
                }}
                placeholder="選填，例：100"
                keyboardType="numeric"
              />

              {/* 優惠數量 - 只在專屬優惠類型時顯示 */}
              {/* Edit 模式且類型為隨取即用時隱藏，Create 模式或類型為專屬優惠時顯示 */}
              {couponType === '專屬優惠' && (
                <FormField
                  label="優惠數量"
                  value={quantity}
                  onChangeText={(text) => {
                    // Only allow numbers
                    const numericValue = text.replace(/[^0-9]/g, '');
                    setQuantity(numericValue);
                  }}
                  placeholder={
                    isEditMode && originalTotalQuantity !== null
                      ? `最小數量：${originalTotalQuantity}`
                      : '輸入數量'
                  }
                  keyboardType="numeric"
                />
              )}

              {/* 注意事項 */}
              <FormField
                label="注意事項"
                value={notes}
                onChangeText={setNotes}
                placeholder="輸入注意事項"
                multiline
              />

              {/* 標籤 */}
              <YStack gap="$2">
                <Text fontSize="$md" fontWeight="500" color={colors.textPrimary}>
                  標籤
                </Text>
                <XStack gap="$2" flexWrap="wrap">
                  {availableTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag.id);
                    return (
                      <TouchableOpacity
                        key={tag.id}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedTags(selectedTags.filter((id) => id !== tag.id));
                          } else {
                            setSelectedTags([...selectedTags, tag.id]);
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.tagButton, isSelected && styles.tagButtonActive]}>
                          <Text style={[styles.tagText, isSelected && styles.tagTextActive]}>
                            {tag.display_name}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </XStack>
              </YStack>

              {/* 優惠類型 - 只在 Create 模式顯示 */}
              {!isEditMode && (
                <YStack gap="$2">
                  <Text fontSize="$md" fontWeight="500" color={colors.textPrimary}>
                    優惠類型(隨取即用、專屬優惠)
                  </Text>
                  <XStack gap="$3">
                    <TouchableOpacity
                      onPress={() => setCouponType('隨取即用')}
                      style={[
                        styles.radioButton,
                        couponType === '隨取即用' && styles.radioButtonActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.radioText,
                          couponType === '隨取即用' && styles.radioTextActive,
                        ]}
                      >
                        隨取即用
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setCouponType('專屬優惠')}
                      style={[
                        styles.radioButton,
                        couponType === '專屬優惠' && styles.radioButtonActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.radioText,
                          couponType === '專屬優惠' && styles.radioTextActive,
                        ]}
                      >
                        專屬優惠
                      </Text>
                    </TouchableOpacity>
                  </XStack>
                </YStack>
              )}

              {/* 中獎機率 - 只在專屬優惠類型時顯示 */}
              {couponType === '專屬優惠' && (
                <FormField
                  label="中獎機率 (%)"
                  value={drawProbability}
                  onChangeText={(text) => {
                    // Only allow numbers
                    const numericValue = text.replace(/[^0-9]/g, '');
                    // Limit to 0-100
                    const num = parseInt(numericValue) || 0;
                    const clampedValue = Math.min(100, Math.max(0, num));
                    setDrawProbability(String(clampedValue));
                  }}
                  placeholder="輸入中獎機率 (0-100)"
                  keyboardType="numeric"
                />
              )}

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
            </YStack>
          </ScrollView>

          {/* Save Button */}
          <View style={styles.saveButtonContainer}>
            <Button
              variant="primary"
              fullWidth
              onPress={handleSave}
              disabled={isSaving || isLoading || !hasChanges()}
              opacity={isSaving || isLoading || !hasChanges() ? 0.6 : 1}
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

          {/* Date Time Pickers */}
          <DateTimePickerModal
            isVisible={showStartDatePicker}
            mode="datetime"
            date={startDate}
            onConfirm={handleStartDateChange}
            onCancel={() => setShowStartDatePicker(false)}
            locale="zh-TW"
            confirmTextIOS="完成"
            cancelTextIOS="取消"
          />
          <DateTimePickerModal
            isVisible={showEndDatePicker}
            mode="datetime"
            date={endDate}
            onConfirm={handleEndDateChange}
            onCancel={() => setShowEndDatePicker(false)}
            locale="zh-TW"
            confirmTextIOS="完成"
            cancelTextIOS="取消"
          />
        </YStack>
      </DismissKeyboardView>

      {/* Permission Denied Modal */}
      <PermissionDeniedModal
        isOpen={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        permissionType="photos"
      />

      {/* EULA Modal (UGC Compliance) */}
      <EULAModal visible={eulaModalVisible} onClose={hideEULAModal} onSuccess={onEULAAccepted} />
    </SafeAreaView>
  );
}

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType = 'default',
}: FormFieldProps) {
  return (
    <YStack gap="$2">
      <Text fontSize="$md" fontWeight="500" color={colors.textPrimary}>
        {label}
      </Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        keyboardType={keyboardType}
      />
    </YStack>
  );
}

interface DateTimeFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  onPress: () => void;
}

function DateTimeField({ label, value, placeholder, onPress }: DateTimeFieldProps) {
  return (
    <YStack gap="$2">
      <Text fontSize="$md" fontWeight="500" color={colors.textPrimary}>
        {label}
      </Text>
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <View style={styles.input}>
          <XStack alignItems="center" justifyContent="space-between">
            <Text style={[styles.dateTimeText, !value && styles.placeholderText]}>
              {value || placeholder}
            </Text>
            <MaterialIcons name="calendar-today" size={20} color={colors.textSecondary} />
          </XStack>
        </View>
      </TouchableOpacity>
    </YStack>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.background,
  },
  placeholderText: {
    fontSize: 16,
    color: colors.textSecondary,
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
  tagButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    marginBottom: 8,
  },
  tagButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  tagText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  tagTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  saveButtonContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  dateTimeText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
});
