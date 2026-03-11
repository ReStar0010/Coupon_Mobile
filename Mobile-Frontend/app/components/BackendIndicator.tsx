/**
 * 後端指示器組件
 * 在開發模式下顯示當前使用的後端配置
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getApiConfig } from '../config/api';

const PRODUCTION_URL = 'https://coupon-mobile.onrender.com';
const STAGING_URL = 'https://coupon-mobile-dev.onrender.com';

export const BackendIndicator = () => {
  const config = getApiConfig();

  // 只在開發時顯示（永遠顯示，讓設計可見，只依 baseUrl 決定顏色）
  let bgColor = '#10b981'; // 預設綠色（生產）
  let label = '🔧 生產環境';

  if (config.baseUrl === STAGING_URL) {
    bgColor = '#f59e42'; // 黃色
    label = '🟡 測試環境 (Staging)';
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Text style={styles.text}>{label}</Text>
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
