import React from 'react';
import {
  Modal,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Share,
  Alert,
  Platform,
} from 'react-native';
import { X, Share2 } from 'lucide-react-native';
import { YStack, XStack, Text, Button, View, Card } from 'tamagui';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCouProShare: () => void;
  onLinkShare: () => Promise<string | undefined | null>;
  isSharing?: boolean;
}

const ShareModal = ({
  isOpen,
  onClose,
  onCouProShare,
  onLinkShare,
  isSharing = false,
}: ShareModalProps) => {
  const handleNativeLinkShare = async () => {
    try {
      const shareLink = await onLinkShare();
      if (!shareLink) {
        Alert.alert('分享失敗', '無法生成分享連結，請稍後再試');
        return;
      }

      // iOS/Android 對 Share payload 顯示方式不同；同時給 message+url 會被顯示成「兩段/兩個連結」
      await Share.share(
        Platform.select({
          ios: { url: shareLink },
          default: { message: shareLink },
        })!,
      );

      onClose();
    } catch {
      Alert.alert('分享失敗', '無法開啟系統分享面板，請稍後再試');
    }
  };

  const handleCouProSharePress = () => {
    Alert.alert(
      '確認分享到 CouPro',
      '此優惠將從您的「專屬優惠」中移除並改為「隨取即用」，此操作無法復原。確定要分享嗎？',
      [
        { text: '取消', style: 'cancel' },
        { text: '確定分享', style: 'destructive', onPress: onCouProShare },
      ],
    );
  };

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={isSharing ? undefined : onClose}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 20,
          }}
        >
          <TouchableWithoutFeedback>
            <Card
              bg="#fff"
              p="$6"
              style={{
                borderRadius: 20,
                width: '100%',
                maxWidth: 350,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
              <YStack gap="$5">
                {/* Header */}
                <XStack style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text fontSize="$9" fontWeight="bold" color="#333">
                    分享
                  </Text>
                  <Button
                    onPress={isSharing ? undefined : onClose}
                    bg="transparent"
                    p="$0"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: '#f5f5f5',
                      justifyContent: 'center',
                      alignItems: 'center',
                      opacity: isSharing ? 0.5 : 1,
                    }}
                    disabled={isSharing}
                  >
                    <X size={20} color="#666" />
                  </Button>
                </XStack>

                {/* Warning Message */}
                <YStack gap="$3">
                  <Text color="#ef4444" fontSize="$4" lineHeight="$5">
                    注意：一旦將此優惠分享至「隨取即用」，該優惠將自您的「專屬優惠」中移除，無法復原。
                  </Text>
                </YStack>

                {/* Buttons */}
                <XStack gap="$3" mt="$2">
                  <Button
                    onPress={handleCouProSharePress}
                    bg="#FFAD31"
                    flex={1}
                    height={50}
                    style={{
                      borderRadius: 12,
                      justifyContent: 'center',
                      alignItems: 'center',
                      opacity: isSharing ? 0.7 : 1,
                      paddingHorizontal: 8,
                    }}
                    disabled={isSharing}
                  >
                    <XStack gap="$2" style={{ alignItems: 'center', justifyContent: 'center' }}>
                      {isSharing && <ActivityIndicator size="small" color="#333" />}
                      <Text
                        color="#333"
                        fontSize={14}
                        fontWeight="600"
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                        style={{ textAlign: 'center' }}
                      >
                        {isSharing ? '分享中...' : '分享到 CouPro'}
                      </Text>
                    </XStack>
                  </Button>

                  <Button
                    onPress={handleNativeLinkShare}
                    bg="#FFAD31"
                    flex={1}
                    height={50}
                    style={{
                      borderRadius: 12,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 2,
                      borderColor: '#6366f1',
                      opacity: isSharing ? 0.7 : 1,
                      paddingHorizontal: 8,
                    }}
                    disabled={isSharing}
                  >
                    <XStack gap="$2" style={{ alignItems: 'center', justifyContent: 'center' }}>
                      {isSharing && <ActivityIndicator size="small" color="#333" />}
                      <Text
                        color="#333"
                        fontSize={14}
                        fontWeight="600"
                        numberOfLines={1}
                        style={{ textAlign: 'center' }}
                      >
                        {isSharing ? '生成中...' : '分享連結'}
                      </Text>
                      {!isSharing && <Share2 size={16} color="#333" />}
                    </XStack>
                  </Button>
                </XStack>
              </YStack>
            </Card>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default ShareModal;
