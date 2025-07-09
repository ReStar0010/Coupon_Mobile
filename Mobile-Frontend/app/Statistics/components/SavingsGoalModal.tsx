import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Modal, 
  TextInput, 
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions
} from "react-native";
import { Ionicons } from '@expo/vector-icons';

interface SavingsGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (goalName: string, goalAmount: number, goalImage: string) => void;
  currentGoalName?: string;
  currentGoalAmount?: number;
  currentGoalImage?: string;
}

const { width } = Dimensions.get('window');

const SavingsGoalModal: React.FC<SavingsGoalModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentGoalName = "",
  currentGoalAmount = 0,
  currentGoalImage = "",
}) => {
  const [customGoalName, setCustomGoalName] = useState("");
  const [customGoalAmount, setCustomGoalAmount] = useState("");
  const [customGoalImage, setCustomGoalImage] = useState("");

  const defaultImage = "/Info.png"; // Default image URL

  useEffect(() => {
    if (isOpen) {
      // If there's a current goal, set it as the custom goal
      if (currentGoalName) {
        setCustomGoalName(currentGoalName);
        setCustomGoalAmount(currentGoalAmount.toString());
        setCustomGoalImage(currentGoalImage || defaultImage);
      } else {
        // Reset fields if no current goal
        setCustomGoalName("");
        setCustomGoalAmount("");
        setCustomGoalImage("");
      }
    }
  }, [isOpen, currentGoalName, currentGoalAmount, currentGoalImage]);

  const handleSave = () => {
    if (!customGoalName || !customGoalAmount) {
      Alert.alert("錯誤", "請輸入目標名稱和金額");
      return;
    }

    const amount = parseFloat(customGoalAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("錯誤", "請輸入有效的金額");
      return;
    }

    onSave(customGoalName, amount, customGoalImage || defaultImage);
    onClose();
  };

  const handleCancel = () => {
    // Reset form data when canceling
    setCustomGoalName("");
    setCustomGoalAmount("");
    setCustomGoalImage("");
    onClose();
  };

  return (
    <Modal
      visible={isOpen}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <TouchableOpacity
          className="flex-1 bg-black/50 justify-center items-center"
          activeOpacity={1}
          onPress={onClose}
        >
          <TouchableOpacity
            className="bg-white rounded-lg p-6 mx-4"
            style={{ 
              width: Math.min(400, width * 0.9),
              maxHeight: '80%',
            }}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1 }}
            >
              {/* Header */}
              <View className="flex flex-row justify-between items-center mb-4">
                <Text className="text-xl font-bold text-sec-black">設定儲蓄目標</Text>
                <TouchableOpacity
                  onPress={onClose}
                  className="p-1"
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={24} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              {/* Description */}
              <View className="mb-6">
                <Text className="text-gray-600 mb-2 text-sm leading-5">
                  請輸入你想要達成的目標名稱（如：音樂平台訂閱），範例名稱僅供參考，與該品牌無直接合作關係。
                </Text>

                <View className="pt-3 gap-4">
                  {/* Goal Name Input */}
                  <View>
                    <Text className="text-sm font-medium text-sec-black mb-1">
                      目標名稱
                    </Text>
                    <TextInput
                      className="w-full px-3 py-3 border border-gray-300 rounded-md bg-white text-sec-black"
                      placeholder="例如：Spotify"
                      placeholderTextColor="#9CA3AF"
                      value={customGoalName}
                      onChangeText={setCustomGoalName}
                      style={{
                        fontSize: 16,
                        textAlignVertical: 'center',
                      }}
                    />
                  </View>

                  {/* Goal Amount Input */}
                  <View>
                    <Text className="text-sm font-medium text-sec-black mb-1">
                      金額 (元)
                    </Text>
                    <TextInput
                      className="w-full px-3 py-3 border border-gray-300 rounded-md bg-white text-sec-black"
                      placeholder="例如：50"
                      placeholderTextColor="#9CA3AF"
                      value={customGoalAmount}
                      onChangeText={setCustomGoalAmount}
                      keyboardType="numeric"
                      style={{
                        fontSize: 16,
                        textAlignVertical: 'center',
                      }}
                    />
                  </View>

                  {/* Goal Image Input */}
                  <View>
                    <Text className="text-sm font-medium text-sec-black mb-1">
                      圖片網址 (選填)
                    </Text>
                    <TextInput
                      className="w-full px-3 py-3 border border-gray-300 rounded-md bg-white text-sec-black"
                      placeholder="例如：https://example.com/image.jpg"
                      placeholderTextColor="#9CA3AF"
                      value={customGoalImage}
                      onChangeText={setCustomGoalImage}
                      multiline={true}
                      numberOfLines={3}
                      style={{
                        fontSize: 16,
                        textAlignVertical: 'top',
                        minHeight: 60,
                      }}
                    />
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <View className="flex flex-row justify-end gap-3">
                <TouchableOpacity
                  onPress={handleCancel}
                  className="px-4 py-2 bg-gray-100 rounded-md"
                  activeOpacity={0.7}
                >
                  <Text className="text-gray-700 font-medium">取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  className="px-4 py-2 bg-act-yellow rounded-md"
                  activeOpacity={0.7}
                >
                  <Text className="text-sec-black font-medium">儲存目標</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default SavingsGoalModal;
