'use client';
import * as React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface ConfirmationCardProps {
  title: string;
  message: string[];
  onConfirm: () => void;
}

export const ConfirmationCard: React.FC<ConfirmationCardProps> = ({
  title,
  message,
  onConfirm,
}) => {
  return (
    <View className="mt-12 flex w-full flex-col items-center rounded-3xl bg-white px-5 pb-6 pt-16 shadow-sm">
      <Text className="text-sec-black mb-4 text-3xl font-bold leading-10 tracking-tight">
        {title}
      </Text>

      <View className="text-sec-black mb-8 text-center text-base leading-5">
        <Text className="text-sec-black text-center text-base leading-5">
          {message.map((line, index) => (
            <React.Fragment key={index}>
              {line}
              {index < message.length - 1 && '\n'}
            </React.Fragment>
          ))}
        </Text>
      </View>

      <TouchableOpacity
        onPress={onConfirm}
        className="bg-act-yellow h-[37px] w-[231px] items-center justify-center rounded-3xl text-base font-bold leading-6 tracking-normal text-white"
        activeOpacity={0.8}
      >
        <Text className="text-base font-bold leading-6 tracking-normal text-white">OK</Text>
      </TouchableOpacity>
    </View>
  );
};
export default ConfirmationCard;
