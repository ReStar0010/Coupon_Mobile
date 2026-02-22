import React, { useState } from 'react';
import { Modal, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { X, Check } from 'lucide-react-native';
import { YStack, XStack, Text, Button, Input } from 'tamagui';

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
  initialAmount = 0,
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

  const canSave =
    goalName.trim() &&
    goalAmount.trim() &&
    !isNaN(parseFloat(goalAmount)) &&
    parseFloat(goalAmount) > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <YStack
          flex={1}
          items="center"
          style={{ justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}
          px="$5">
          <YStack
            width="100%"
            rounded="$3"
            style={{ borderWidth: 1, borderColor: 'white', maxWidth: 280 }}
            bg="#f5f5f5"
            p="$6">
            {/* Header */}
            <XStack mb="$6" items="center" style={{ justifyContent: 'space-between' }}>
              <Text fontSize={20} fontWeight="bold" lineHeight={25} color="#333333">
                設定目標
              </Text>
              <Button
                onPress={isConfirmMode ? handleConfirm : handleClose}
                rounded="$6"
                height={15}
                width={15}
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isConfirmMode ? '#FFAD31' : 'white',
                }}
                px="$1"
                pressStyle={{ opacity: 0.8 }}
                unstyled>
                {isConfirmMode ? (
                  <Check size={16} color="#333333" />
                ) : (
                  <X size={16} color="#333333" />
                )}
              </Button>
            </XStack>

            {/* Description */}
            <Text mb="$6" fontSize={13} fontWeight="normal" color="#333333">
              {isConfirmMode
                ? '設定目標，看見「默默存下來的驚喜」'
                : '設定目標，看見自己「默默存下來的驚喜」。'}
            </Text>

            {/* Name Input */}
            <XStack mb="$6" items="center" gap="$6">
              <Text fontSize={14} fontWeight="normal" color="#333333">
                名稱
              </Text>
              <YStack flex={1}>
                <Input
                  value={goalName}
                  onChangeText={setGoalName}
                  placeholder={isConfirmMode ? 'Spotify' : '輸入目標名稱'}
                  placeholderTextColor="#707070"
                  height={33}
                  rounded="$3"
                  style={{ borderWidth: 1, borderColor: 'white' }}
                  bg="white"
                  px="$2"
                  fontSize={13}
                  fontWeight="normal"
                  color="#333333"
                  editable={!isConfirmMode}
                />
              </YStack>
            </XStack>

            {/* Amount Input */}
            <XStack items="center" gap="$6">
              <Text fontSize={14} fontWeight="normal" color="#333333">
                金額
              </Text>
              <YStack flex={1}>
                <Input
                  value={goalAmount}
                  onChangeText={setGoalAmount}
                  placeholder={isConfirmMode ? '50' : '輸入目標金額'}
                  placeholderTextColor="#707070"
                  height={33}
                  rounded="$3"
                  style={{ borderWidth: 1, borderColor: 'white' }}
                  bg="white"
                  px="$2"
                  fontSize={13}
                  fontWeight="normal"
                  color="#333333"
                  keyboardType="numeric"
                  editable={!isConfirmMode}
                />
              </YStack>
            </XStack>

            {/* Save Button (only show in initial mode) */}
            {!isConfirmMode && (
              <YStack mt="$6" items="center">
                <Button
                  onPress={handleSave}
                  rounded="$6"
                  px="$4"
                  py="$2"
                  bg={canSave ? '#FFAD31' : '#9ca3af'}
                  disabled={!canSave}
                  pressStyle={{ opacity: 0.8 }}>
                  <Text fontSize={13} fontWeight="normal" color="#333333">
                    設定目標
                  </Text>
                </Button>
              </YStack>
            )}
          </YStack>
        </YStack>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default GoalModal;
