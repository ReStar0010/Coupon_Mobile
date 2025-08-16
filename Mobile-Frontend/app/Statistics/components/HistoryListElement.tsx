import React, { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, Image, DimensionValue } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HistoryItem } from './CouponHistoryList';

export type HistoryListElementType = {
  className?: string;
  prop?: string;
  separator?: string;
  forward?: string;
  couponId?: number;
  couponData?: HistoryItem;
  onItemClick?: () => void;
  lastElement?: boolean;

  /** Style props - converted to React Native style objects */
  propWidth?: DimensionValue;
  propMinWidth?: DimensionValue;
  propWidth1?: DimensionValue;
  propDisplay?: 'flex' | 'none';
  propMinWidth1?: DimensionValue;
  propAlignSelf?: 'flex-start' | 'flex-end' | 'center' | 'stretch';
};

const HistoryListElement: React.FC<HistoryListElementType> = ({
  className = '',
  propWidth,
  prop,
  propMinWidth,
  propWidth1,
  separator,
  propDisplay,
  propMinWidth1,
  propAlignSelf,
  forward,
  lastElement,
  couponId,
  couponData,
  onItemClick,
}) => {
  const router = useRouter();

  const frameDivStyle = useMemo(() => {
    return {
      ...(propWidth !== undefined && { width: propWidth }),
    };
  }, [propWidth]);

  const divStyle = useMemo(() => {
    return {
      minWidth: propMinWidth,
      width: propWidth1,
    };
  }, [propMinWidth, propWidth1]);

  const div1Style = useMemo(() => {
    return {
      display: propDisplay,
      minWidth: propMinWidth1,
      alignSelf: propAlignSelf,
    };
  }, [propDisplay, propMinWidth1, propAlignSelf]);

  const handleClick = useCallback(async () => {
    if (onItemClick) {
      onItemClick();
    } else if (couponId) {
      try {
        // Fall back to direct navigation if onItemClick isn't provided
        const item = couponData || {
          redemption_id: 0,
          coupon_id: couponId,
          store_name: prop || '',
          used_date: separator || '',
        };
        await AsyncStorage.setItem('selectedCouponHistory', JSON.stringify(item));
        router.push(`/Statistics/History/${couponId}`);
      } catch (error) {
        console.error('Error storing coupon history:', error);
      }
    }
  }, [onItemClick, couponId, couponData, prop, separator, router]);

  return (
    <View
      className={`flex shrink-0 flex-col items-start justify-start gap-2 self-stretch ${className}`}>
      <TouchableOpacity
        className="flex flex-row items-start justify-between gap-5 self-stretch"
        onPress={handleClick}
        activeOpacity={0.7}>
        <View className="flex flex-col items-start justify-start" style={frameDivStyle}>
          <Text
            className="text-sec-black font-jost text-base"
            style={{
              letterSpacing: -0.01,
              lineHeight: 24,
              ...divStyle,
            }}
            numberOfLines={1}>
            {prop}
          </Text>
          <Text
            className="text-top font-jost text-xs"
            style={{
              letterSpacing: -0.01,
              lineHeight: 18,
              ...div1Style,
            }}
            numberOfLines={1}>
            {separator}
          </Text>
        </View>

        <View className="flex flex-col items-start justify-start px-0 pb-0 pt-2">
          <Image
            className="relative h-5 w-5 object-cover"
            style={{ width: 20, height: 20 }}
            source={forward ? { uri: forward } : require('../../../assets/forward-1.png')}
            resizeMode="cover"
          />
        </View>
      </TouchableOpacity>

      {!lastElement && <View className="bg-mid h-px w-full" />}
    </View>
  );
};

export default HistoryListElement;
