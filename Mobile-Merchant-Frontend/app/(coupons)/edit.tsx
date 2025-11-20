import React, { useState, useEffect } from 'react';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/constants/colors';
import { Input } from '@/components/ui';
import { Button } from '@/components/ui';
import { StyleSheet, TouchableOpacity, View, TextInput, Switch, Alert, Platform, Modal } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { DeleteModal } from './components/DeleteModal';
import { merchantAPI, getAbsoluteImageUrl } from '@/utils/api';

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
  // Store original values for validation in edit mode
  const [originalTotalQuantity, setOriginalTotalQuantity] = useState<number | null>(null);
  const [remainingQuantity, setRemainingQuantity] = useState<number | null>(null);
  
  // Store original form data to detect changes
  const [originalData, setOriginalData] = useState<{
    couponName: string;
    couponContent: string;
    notes: string;
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

  // Load existing coupon data if in edit mode
  useEffect(() => {
    if (isEditMode && id) {
      loadCouponData(parseInt(id));
    }
  }, [isEditMode, id]);

  const loadCouponData = async (couponId: number) => {
    try {
      setIsLoading(true);
      const data = await merchantAPI.getTemplate(couponId) as any;
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
      // If total_quantity > 0, it's '共享', otherwise '一般'
      const type: '一般' | '共享' = totalQty > 0 ? '共享' : '一般';
      setCouponType(type);
      
      // Set quantity for display (only for '共享' type)
      if (type === '共享') {
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
      
      // Store original data for change detection
      const originalImageUrl = getAbsoluteImageUrl(data.image_url) || null;
      const originalQuantity = type === '共享' ? String(totalQty) : '1';
      const originalStartTime = data.start_date ? formatDateTime(new Date(data.start_date)) : '';
      const originalEndTime = data.end_date ? formatDateTime(new Date(data.end_date)) : '';
      
      setOriginalData({
        couponName: data.coupon_name || '',
        couponContent: data.coupon_detail || '',
        notes: data.important_notes || '',
        image: originalImageUrl,
        quantity: originalQuantity,
        startTime: originalStartTime,
        endTime: originalEndTime,
      });
    } catch (error) {
      console.error('Failed to load coupon:', error);
      Alert.alert('錯誤', '無法載入優惠券資料');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('需要權限', '需要相簿權限才能上傳圖片');
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
        } catch (uploadError: any) {
          console.error('Image upload error:', uploadError);
          Alert.alert('錯誤', uploadError?.message || '圖片上傳失敗，請稍後再試');
        } finally {
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('錯誤', '選擇圖片時發生錯誤');
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    // 驗證必填欄位：優惠數量只在共享類型時必填
    if (!couponName || !couponContent || !startTime || !endTime) {
      Alert.alert('錯誤', '請填寫所有必填欄位');
      return;
    }
    if (couponType === '共享' && !quantity) {
      Alert.alert('錯誤', '請填寫優惠數量');
      return;
    }

    // Edit 模式：驗證優惠數量不能比已核銷數量少
    if (isEditMode && couponType === '共享' && originalTotalQuantity !== null && remainingQuantity !== null) {
      const newQuantity = parseInt(quantity) || 0;
      const redeemedQuantity = originalTotalQuantity - remainingQuantity;
      
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
      
      const couponData = {
        coupon_name: couponName,
        coupon_detail: couponContent,
        important_notes: notes,
        image_url: image || '',
        // 優惠數量：共享類型使用輸入的數量，一般類型設為 0 或 undefined（根據後端需求）
        total_quantity: couponType === '共享' ? (parseInt(quantity) || 1) : 0,
        // 核銷碼：自動生成隨機的六位數字
        template_redeem_code: generateVerificationCode(),
        start_date: new Date(startTime).toISOString(),
        expiry_date: new Date(endTime).toISOString(),
        draw_probability: 0.5,
        is_active: true,
        tags: [],
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
            image: image || null,
            quantity: couponType === '共享' ? quantity : '1',
            startTime,
            endTime,
          });
        }
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

  const formatDateTime = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartDatePicker(false);
    }
    if (selectedDate) {
      setStartDate(selectedDate);
      setStartTime(formatDateTime(selectedDate));
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndDatePicker(false);
    }
    if (selectedDate) {
      setEndDate(selectedDate);
      setEndTime(formatDateTime(selectedDate));
    }
  };

  // Check if form data has changed (only for edit mode)
  const hasChanges = (): boolean => {
    if (!isEditMode || !originalData) {
      return true; // Always enable save button in create mode
    }

    // Compare current values with original values
    const currentQuantity = couponType === '共享' ? quantity : '1';
    
    return (
      couponName !== originalData.couponName ||
      couponContent !== originalData.couponContent ||
      notes !== originalData.notes ||
      image !== originalData.image ||
      currentQuantity !== originalData.quantity ||
      startTime !== originalData.startTime ||
      endTime !== originalData.endTime
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={['top', 'bottom']}>
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

            {/* 優惠數量 - 只在共享類型時顯示 */}
            {/* Edit 模式且類型為一般時隱藏，Create 模式或類型為共享時顯示 */}
            {couponType === '共享' && (
              <FormField
                label="優惠數量"
                value={quantity}
                onChangeText={(text) => {
                  // Only allow numbers
                  const numericValue = text.replace(/[^0-9]/g, '');
                  setQuantity(numericValue);
                }}
                placeholder={isEditMode && originalTotalQuantity !== null 
                  ? `最小數量：${originalTotalQuantity}` 
                  : "輸入數量"}
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

            {/* 優惠類型 - 只在 Create 模式顯示 */}
            {!isEditMode && (
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
        {Platform.OS === 'ios' ? (
          <>
            <Modal
              visible={showStartDatePicker}
              transparent
              animationType="slide"
              onRequestClose={() => setShowStartDatePicker(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <XStack justifyContent="space-between" alignItems="center" padding="$4" borderBottomWidth={1} borderBottomColor={colors.border}>
                    <TouchableOpacity onPress={() => setShowStartDatePicker(false)}>
                      <Text fontSize="$md" color={colors.textSecondary}>取消</Text>
                    </TouchableOpacity>
                    <Text fontSize="$lg" fontWeight="600" color={colors.textPrimary}>選擇開始時間</Text>
                    <TouchableOpacity onPress={() => {
                      setStartTime(formatDateTime(startDate));
                      setShowStartDatePicker(false);
                    }}>
                      <Text fontSize="$md" color={colors.primary} fontWeight="600">完成</Text>
                    </TouchableOpacity>
                  </XStack>
                  <DateTimePicker
                    value={startDate}
                    mode="datetime"
                    display="spinner"
                    onChange={handleStartDateChange}
                    locale="zh-TW"
                  />
                </View>
              </View>
            </Modal>
            <Modal
              visible={showEndDatePicker}
              transparent
              animationType="slide"
              onRequestClose={() => setShowEndDatePicker(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <XStack justifyContent="space-between" alignItems="center" padding="$4" borderBottomWidth={1} borderBottomColor={colors.border}>
                    <TouchableOpacity onPress={() => setShowEndDatePicker(false)}>
                      <Text fontSize="$md" color={colors.textSecondary}>取消</Text>
                    </TouchableOpacity>
                    <Text fontSize="$lg" fontWeight="600" color={colors.textPrimary}>選擇結束時間</Text>
                    <TouchableOpacity onPress={() => {
                      setEndTime(formatDateTime(endDate));
                      setShowEndDatePicker(false);
                    }}>
                      <Text fontSize="$md" color={colors.primary} fontWeight="600">完成</Text>
                    </TouchableOpacity>
                  </XStack>
                  <DateTimePicker
                    value={endDate}
                    mode="datetime"
                    display="spinner"
                    onChange={handleEndDateChange}
                    locale="zh-TW"
                  />
                </View>
              </View>
            </Modal>
          </>
        ) : (
          <>
            {showStartDatePicker && (
              <DateTimePicker
                value={startDate}
                mode="datetime"
                display="default"
                onChange={handleStartDateChange}
              />
            )}
            {showEndDatePicker && (
              <DateTimePicker
                value={endDate}
                mode="datetime"
                display="default"
                onChange={handleEndDateChange}
              />
            )}
          </>
        )}
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
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
}

function FormField({ label, value, onChangeText, placeholder, multiline, keyboardType = 'default' }: FormFieldProps) {
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
  },
});

