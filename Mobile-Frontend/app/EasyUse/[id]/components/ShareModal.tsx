import React from 'react';
import { Modal, TouchableWithoutFeedback } from 'react-native';
import { X, Share2 } from 'lucide-react-native';
import { 
  YStack, 
  XStack, 
  Text, 
  Button,
  View,
  Card
} from 'tamagui';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCouProShare: () => void;
  onLinkShare: () => void;
}

const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  onCouProShare,
  onLinkShare
}) => {
  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 20
        }}>
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
                elevation: 8
              }}
            >
              <YStack gap="$5">
                {/* Header */}
                <XStack style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text 
                    fontSize="$9" 
                    fontWeight="bold" 
                    color="#333"
                  >
                    分享
                  </Text>
                  <Button
                    onPress={onClose}
                    bg="transparent"
                    p="$0"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: '#f5f5f5',
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}
                  >
                    <X size={20} color="#666" />
                  </Button>
                </XStack>

                {/* Warning Message */}
                <YStack gap="$3">
                  <Text 
                    color="#ef4444" 
                    fontSize="$4" 
                    lineHeight="$5"
                  >
                    注意：一旦將此優惠分享至「隨取即用」，該優惠將自您的「專屬優惠」中移除，無法復原。
                  </Text>
                </YStack>

                {/* Buttons */}
                <XStack gap="$3" mt="$2">
                  <Button
                    onPress={onCouProShare}
                    bg="#FFAD31"
                    flex={1}
                    height={50}
                    style={{
                      borderRadius: 12,
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}
                  >
                    <XStack gap="$2" style={{ alignItems: 'center' }}> 
                      <Text 
                        color="#333" 
                        fontSize="$5" 
                        fontWeight="600"
                      >
                        CouPro
                      </Text>
                    </XStack>
                  </Button>

                  <Button
                    onPress={onLinkShare}
                    bg="#FFAD31"
                    flex={1}
                    height={50}
                    style={{
                      borderRadius: 12,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 2,
                      borderColor: '#6366f1'
                    }}
                  >
                    <XStack gap="$2" style={{ alignItems: 'center' }}>
                      <Text 
                        color="#333" 
                        fontSize="$5" 
                        fontWeight="600"
                      >
                        分享連結
                      </Text>
                      <Share2 size={16} color="#fff" />
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
