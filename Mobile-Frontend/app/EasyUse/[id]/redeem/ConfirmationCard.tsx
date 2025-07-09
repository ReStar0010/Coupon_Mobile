"use client";
import * as React from "react";
import { View, Text, TouchableOpacity } from "react-native";

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
    <View className="flex flex-col items-center px-5 pt-16 pb-6 mt-12 w-full bg-white rounded-3xl shadow-sm">
      <Text className="mb-4 text-3xl font-bold tracking-tight leading-10 text-sec-black">
        {title}
      </Text>

      <View className="mb-8 text-base leading-5 text-center text-sec-black">
        <Text className="text-base leading-5 text-center text-sec-black">
          {message.map((line, index) => (
            <React.Fragment key={index}>
              {line}
              {index < message.length - 1 && "\n"}
            </React.Fragment>
          ))}
        </Text>
      </View>

      <TouchableOpacity
        onPress={onConfirm}
        className="text-base font-bold tracking-normal leading-6 text-white bg-act-yellow rounded-3xl h-[37px] w-[231px] justify-center items-center"
        activeOpacity={0.8}
      >
        <Text className="text-base font-bold tracking-normal leading-6 text-white">
          OK
        </Text>
      </TouchableOpacity>
    </View>
  );
};
