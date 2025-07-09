import React from "react";
import { View, Text, Dimensions } from "react-native";

export type SmallWidgetType = {
  className?: string;
  description?: string;
  usage?: number;
  metric?: string;
};

const { width } = Dimensions.get('window');

const SmallWidget: React.FC<SmallWidgetType> = ({ 
  className = "", 
  description, 
  usage, 
  metric 
}) => {
  // Calculate responsive dimensions
  const containerWidth = (width - 60) * 0.48; // Assuming 30px padding on each side and gap between widgets
  
  return (
    <View 
      className="shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] rounded-xl bg-bg-white flex justify-center items-center"
      style={{
        width: containerWidth,
        height: containerWidth, // Square aspect ratio
      }}
    >
      <View className="flex flex-col justify-center items-center gap-[20px] w-full px-[10%] text-sec-black">
        <Text 
          className="text-lg text-sec-black text-center"
          style={{
            letterSpacing: -0.43,
            lineHeight: 22,
          }}
          numberOfLines={2}
        >
          {description}
        </Text>
        <Text 
          className="text-sec-black font-bold text-center"
          style={{
            fontSize: 32,
            letterSpacing: -0.43,
            lineHeight: 36,
          }}
          numberOfLines={1}
        >
          {usage}
        </Text>
        <Text 
          className="text-lg text-sec-black text-center"
          style={{
            letterSpacing: -0.43,
            lineHeight: 22,
          }}
          numberOfLines={1}
        >
          {metric}
        </Text>
      </View>
    </View>
  );
};

export default SmallWidget;
