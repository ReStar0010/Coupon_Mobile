import React, { useState } from 'react';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { Button } from '@/components/ui';
import { StyleSheet, TouchableOpacity, View, TextInput } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image as ExpoImage } from 'expo-image';

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

export default function ProfileEditScreen() {
  const router = useRouter();
  
  const [imageUrl, setImageUrl] = useState('https://helloworld.com');
  const [address, setAddress] = useState('台北.......');
  const [phoneNumber, setPhoneNumber] = useState('02 8661 0884');
  const [type, setType] = useState('');
  const [businessHours, setBusinessHours] = useState('');

  const handleSave = () => {
    // TODO: Implement save logic
    console.log('Saving profile:', {
      imageUrl,
      address,
      phoneNumber,
      type,
      businessHours,
    });
    router.back();
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
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
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
              {/* Logo Placeholder */}
              <View style={styles.logoContainer}>
                <View style={styles.logoGrid}>
                  <View style={styles.logoSquare}>
                    <Text style={styles.logoText}>政</Text>
                  </View>
                  <View style={styles.logoSquare}>
                    <Text style={styles.logoText}>大</Text>
                  </View>
                  <View style={styles.logoSquare}>
                    <Text style={styles.logoText}>茶</Text>
                  </View>
                  <View style={styles.logoSquare}>
                    <Text style={styles.logoText}>亭</Text>
                  </View>
                </View>
              </View>
              
              {/* Merchant Name */}
              <Text style={styles.merchantNameText}>
                政大茶亭
              </Text>
            </XStack>
          </View>

          {/* Information Fields */}
          <View style={styles.infoCard}>
            <EditableField
              label="圖片網址"
              value={imageUrl}
              onChangeText={setImageUrl}
              placeholder="輸入圖片網址"
            />
            <EditableField
              label="地址"
              value={address}
              onChangeText={setAddress}
              placeholder="輸入地址"
            />
            <EditableField
              label="電話號碼"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="輸入電話號碼"
            />
            <EditableField
              label="類型"
              value={type}
              onChangeText={setType}
              placeholder="選擇類型"
              showDropdown
              onPress={() => {
                // TODO: Open type selection
                console.log('Open type selection');
              }}
            />
            <EditableField
              label="營業時間"
              value={businessHours}
              onChangeText={setBusinessHours}
              placeholder="選擇營業時間"
              showDropdown
              onPress={() => {
                // TODO: Open business hours editor
                console.log('Open business hours editor');
              }}
            />
          </View>

          {/* Save Button */}
          <View style={styles.saveButtonContainer}>
            <Button variant="primary" fullWidth onPress={handleSave}>
              儲存
            </Button>
          </View>
        </ScrollView>
      </YStack>
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
    backgroundColor: '#1E3A8A',
    borderRadius: 8,
    overflow: 'hidden',
  },
  logoGrid: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  logoSquare: {
    width: '50%',
    height: '50%',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.white,
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

