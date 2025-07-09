import React, { useMemo } from "react";
import { View, Text, ViewStyle } from "react-native";

type UserInfoElementType = {
  className?: string;
  prop?: string;
  content?: string;
  contentGap?: number;
  userIconsMinWidth?: number;
  userAvatarsDisplay?: "flex" | "none";
  userAvatarsMinWidth?: number;
  lastElement?: boolean;
};

const UserInfoElement: React.FC<UserInfoElementType> = ({
  className = "",
  prop,
  content,
  contentGap,
  userIconsMinWidth,
  userAvatarsDisplay,
  userAvatarsMinWidth,
  lastElement = false,
}) => {
  const contentStyle: ViewStyle = useMemo(() => {
    return {
      gap: contentGap,
    };
  }, [contentGap]);

  const userIconsStyle: ViewStyle = useMemo(() => {
    return {
      minWidth: userIconsMinWidth,
    };
  }, [userIconsMinWidth]);

  const userAvatarsStyle: ViewStyle = useMemo(() => {
    return {
      display: userAvatarsDisplay,
      minWidth: userAvatarsMinWidth,
    };
  }, [userAvatarsDisplay, userAvatarsMinWidth]);

  return (
    <View
      className={`self-stretch flex flex-col items-start justify-start gap-[18px] ${className}`}
    >
      <View
        className="self-stretch flex flex-row items-start justify-start gap-[25px]"
        style={contentStyle}
      >
        <View
          className="w-[60px] relative tracking-[-0.01em] leading-[150%] inline-block whitespace-nowrap shrink-0"
          style={userIconsStyle}
        >
          <Text className="text-sec-black text-base tracking-[-0.01em] leading-[150%]">
            {prop}
          </Text>
        </View>
        <View
          className="flex-1 relative tracking-[-0.01em] leading-[150%] inline-block text-right"
          style={userAvatarsStyle}
        >
          <Text className="text-sec-black text-base tracking-[-0.01em] leading-[150%] text-right">
            {content}
          </Text>
        </View>
      </View>
      {!lastElement && <View className="self-stretch h-px relative bg-mid" />}
    </View>
  );
};

export default UserInfoElement;
