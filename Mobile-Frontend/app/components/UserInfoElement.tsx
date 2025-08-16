import React, { useMemo } from 'react';
import { View, Text, ViewStyle } from 'react-native';

type UserInfoElementType = {
  className?: string;
  prop?: string;
  content?: string;
  contentGap?: number;
  userIconsMinWidth?: number;
  userAvatarsDisplay?: 'flex' | 'none';
  userAvatarsMinWidth?: number;
  lastElement?: boolean;
};

const UserInfoElement: React.FC<UserInfoElementType> = ({
  className = '',
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
      className={`flex flex-col items-start justify-start gap-[18px] self-stretch ${className}`}>
      <View
        className="flex flex-row items-start justify-start gap-[25px] self-stretch"
        style={contentStyle}>
        <View
          className="relative inline-block w-[60px] shrink-0 whitespace-nowrap leading-[150%] tracking-[-0.01em]"
          style={userIconsStyle}>
          <Text className="text-sec-black text-base leading-[150%] tracking-[-0.01em]">{prop}</Text>
        </View>
        <View
          className="relative inline-block flex-1 text-right leading-[150%] tracking-[-0.01em]"
          style={userAvatarsStyle}>
          <Text className="text-sec-black text-right text-base leading-[150%] tracking-[-0.01em]">
            {content}
          </Text>
        </View>
      </View>
      {!lastElement && <View className="bg-mid relative h-px self-stretch" />}
    </View>
  );
};

export default UserInfoElement;
