import React, { useState } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  TextInput, 
  TouchableWithoutFeedback,
  Keyboard 
} from 'react-native';
import { X, Check } from 'lucide-react-native';

interface GoalModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string, amount: number) => void;
  editMode?: boolean;
  initialName?: string;
  initialAmount?: number;
}

const GoalModal: React.FC<GoalModalProps> = ({ 
  visible, 
  onClose, 
  onSave, 
  editMode = false,
  initialName = '',
  initialAmount = 0
}) => {
  const [goalName, setGoalName] = useState(initialName);
  const [goalAmount, setGoalAmount] = useState(initialAmount > 0 ? initialAmount.toString() : '');
  const [isConfirmMode, setIsConfirmMode] = useState(false);

  const handleSave = () => {
    if (goalName.trim() && goalAmount.trim()) {
      const amount = parseFloat(goalAmount);
      if (!isNaN(amount) && amount > 0) {
        if (editMode) {
          // Show confirmation mode first
          setIsConfirmMode(true);
        } else {
          onSave(goalName.trim(), amount);
          resetForm();
        }
      }
    }
  };

  const handleConfirm = () => {
    if (goalName.trim() && goalAmount.trim()) {
      const amount = parseFloat(goalAmount);
      if (!isNaN(amount) && amount > 0) {
        onSave(goalName.trim(), amount);
        resetForm();
        setIsConfirmMode(false);
      }
    }
  };

  const handleClose = () => {
    resetForm();
    setIsConfirmMode(false);
    onClose();
  };

  const resetForm = () => {
    setGoalName('');
    setGoalAmount('');
  };

  React.useEffect(() => {
    if (visible) {
      setGoalName(initialName);
      setGoalAmount(initialAmount > 0 ? initialAmount.toString() : '');
    }
  }, [visible, initialName, initialAmount]);

  const canSave = goalName.trim() && goalAmount.trim() && !isNaN(parseFloat(goalAmount)) && parseFloat(goalAmount) > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1 items-center justify-center bg-black/50 px-5">
          <View className="w-full max-w-[280px] rounded-[10px] border border-white bg-login-bg p-6">
            {/* Header */}
            <View className="mb-6 flex-row items-center justify-between">
              <Text className="text-[20px] font-bold leading-[25px] text-login-gray">
                設定目標
              </Text>
              <TouchableOpacity
                onPress={isConfirmMode ? handleConfirm : handleClose}
                className={`h-[15px] w-[15px] items-center justify-center rounded-full px-[5px] ${
                  isConfirmMode ? 'bg-login-orange' : 'bg-white'
                }`}
                activeOpacity={0.8}
              >
                {isConfirmMode ? (
                  <Check size={16} color="#333333" />
                ) : (
                  <X size={16} color="#333333" />
                )}
              </TouchableOpacity>
            </View>

            {/* Description */}
            <Text className="mb-6 text-[13px] font-normal leading-normal text-login-gray">
              {isConfirmMode
                ? '設定目標，看見「默默存下來的驚喜」'
                : '設定目標，看見自己「默默存下來的驚喜」。'
              }
            </Text>

            {/* Name Input */}
            <View className="mb-6 flex-row items-center gap-6">
              <Text className="text-[14px] font-normal leading-normal text-login-gray">
                名稱
              </Text>
              <View className="flex-1">
                <TextInput
                  value={goalName}
                  onChangeText={setGoalName}
                  placeholder={isConfirmMode ? "Spotify" : "輸入目���名稱"}
                  placeholderTextColor="#707070"
                  className="h-[33px] rounded-[13px] border border-white bg-white px-[10px] text-[13px] font-normal leading-normal text-login-gray"
                  editable={!isConfirmMode}
                />
              </View>
            </View>

            {/* Amount Input */}
            <View className="flex-row items-center gap-6">
              <Text className="text-[14px] font-normal leading-normal text-login-gray">
                金額
              </Text>
              <View className="flex-1">
                <TextInput
                  value={goalAmount}
                  onChangeText={setGoalAmount}
                  placeholder={isConfirmMode ? "50" : "輸入目標金額"}
                  placeholderTextColor="#707070"
                  className="h-[33px] rounded-[13px] border border-white bg-white px-[10px] text-[13px] font-normal leading-normal text-login-gray"
                  keyboardType="numeric"
                  editable={!isConfirmMode}
                />
              </View>
            </View>

            {/* Save Button (only show in initial mode) */}
            {!isConfirmMode && (
              <View className="mt-6 items-center">
                <TouchableOpacity
                  onPress={handleSave}
                  className={`rounded-full px-4 py-2 ${
                    canSave ? 'bg-login-orange' : 'bg-gray-500'
                  }`}
                  disabled={!canSave}
                  activeOpacity={0.8}
                >
                  <Text className="text-[13px] font-normal text-login-gray">
                    設定目標
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default GoalModal;
