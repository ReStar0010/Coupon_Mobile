/**
 * 共用的 Toast 配置
 * 提供統一的成功和錯誤提示樣式
 */

import React from 'react';
import { View, Text } from 'tamagui';

export const toastConfig = {
  successGreen: ({ text1 }: any) => (
    <View
      position="absolute"
      px="$4"
      height={56}
      style={{
        alignSelf: 'center',
        bottom: '20%',
        justifyContent: 'center',
        borderRadius: 40,
        backgroundColor: '#4ADE80',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 6,
      }}>
      <Text color="white" fontWeight="bold" fontSize={16}>
        {text1}
      </Text>
    </View>
  ),
  failRed: ({ text1 }: any) => (
    <View
      position="absolute"
      px="$4"
      height={56}
      style={{
        alignSelf: 'center',
        bottom: '20%',
        justifyContent: 'center',
        borderRadius: 40,
        backgroundColor: '#EF4444',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 6,
      }}>
      <Text color="white" fontWeight="bold" fontSize={16}>
        {text1}
      </Text>
    </View>
  ),
};
