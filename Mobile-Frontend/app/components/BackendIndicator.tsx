/**
 * 後端指示器組件
 * 在開發模式下顯示當前使用的後端配置
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getApiConfig } from '../config/api';

export const BackendIndicator = () => {
  // 只在開發模式下顯示
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const config = getApiConfig();

  // 根據模式設置顏色
  const getModeColor = () => {
    switch (config.mode) {
      case 'production':
        return '#10b981'; // 綠色
      case 'local':
        return '#3b82f6'; // 藍色
      case 'local-network':
        return '#f59e0b'; // 橙色
      default:
        return '#6b7280'; // 灰色
    }
  };

  const getModeLabel = () => {
    switch (config.mode) {
      case 'production':
        return '生產環境';
      case 'local':
        return '本地 (localhost)';
      case 'local-network':
        return '本地網絡';
      default:
        return '未知';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: getModeColor() }]}>
      <Text style={styles.text}>🔧 {getModeLabel()}</Text>
      <Text style={styles.url} numberOfLines={1}>
        {config.baseUrl}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 4,
    paddingHorizontal: 8,
    zIndex: 9999,
    alignItems: 'center',
  },
  text: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  url: {
    color: 'white',
    fontSize: 8,
    marginTop: 2,
  },
});
