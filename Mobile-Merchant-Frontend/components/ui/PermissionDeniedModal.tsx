import React, { useCallback, useEffect, useRef } from 'react';
import { Modal, TouchableOpacity, StyleSheet, Animated, Linking, Platform } from 'react-native';
import { YStack, Text, XStack } from 'tamagui';
import { colors } from '@/constants/colors';
import { Button } from './Button';

export interface PermissionDeniedModalProps {
  isOpen: boolean;
  onClose: () => void;
  permissionType: 'photos' | 'camera';
}

export const PermissionDeniedModal: React.FC<PermissionDeniedModalProps> = ({
  isOpen,
  onClose,
  permissionType,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(50)).current;

  const hideModal = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: 50,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  }, [fadeAnim, onClose, translateYAnim]);

  useEffect(() => {
    if (isOpen) {
      // Show animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      hideModal();
    }
  }, [fadeAnim, hideModal, isOpen, translateYAnim]);

  const getPermissionInstructions = () => {
    const appName = 'CouPro 商家端';
    if (Platform.OS === 'ios') {
      return {
        photos: {
          title: '需要照片權限',
          description: `CouPro 需要存取您的照片，以便讓您上傳商店標誌、商品圖片或優惠券圖片至您的商家資料。\n\n請前往「設定」>「${appName}」>「照片」，選擇「所有照片」或「選取的照片」來開啟此權限。`,
        },
        camera: {
          title: '需要相機權限',
          description: `CouPro 需要存取您的相機，以便讓您拍攝照片上傳至您的商家資料。\n\n請前往「設定」>「${appName}」>「相機」，開啟相機權限。`,
        },
      };
    } else {
      // Android
      return {
        photos: {
          title: '需要照片權限',
          description: `CouPro 需要存取您的照片，以便讓您上傳商店標誌、商品圖片或優惠券圖片至您的商家資料。\n\n請前往「設定」>「應用程式」>「${appName}」>「權限」>「照片和影片」，選擇「允許」來開啟此權限。`,
        },
        camera: {
          title: '需要相機權限',
          description: `CouPro 需要存取您的相機，以便讓您拍攝照片上傳至您的商家資料。\n\n請前往「設定」>「應用程式」>「${appName}」>「權限」>「相機」，選擇「允許」來開啟此權限。`,
        },
      };
    }
  };

  const messages = getPermissionInstructions();

  const handleOpenSettings = async () => {
    try {
      await Linking.openSettings();
      onClose();
    } catch (error) {
      console.error('Failed to open settings:', error);
    }
  };

  return (
    <Modal visible={isOpen} transparent={true} animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: translateYAnim }],
            },
          ]}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <YStack gap={12} alignItems="center" width="100%">
              {/* Title */}
              <Text style={styles.title}>{messages[permissionType].title}</Text>

              {/* Message */}
              <Text style={styles.message}>{messages[permissionType].description}</Text>

              {/* Buttons */}
              <XStack width="100%" marginTop={8} gap={8}>
                <Button variant="outline" flex={1} onPress={onClose}>
                  取消
                </Button>
                <Button variant="primary" flex={1} onPress={handleOpenSettings}>
                  開啟設定
                </Button>
              </XStack>
            </YStack>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  content: {
    backgroundColor: colors.white,
    borderRadius: 9,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
