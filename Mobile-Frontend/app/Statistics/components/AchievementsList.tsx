import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { AlignJustify, Home, BarChart2, StretchHorizontal } from 'lucide-react-native';

const AchievementsList: React.FC = () => {
  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#F8F8F8' }}>
      <View className="flex-1" style={{ paddingHorizontal: 20, paddingVertical: 32 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between mb-3">
          <Text 
            className="text-3xl font-bold"
            style={{ 
              color: '#333333',
              fontSize: 30,
              lineHeight: 37.5,
              fontFamily: 'Inter'
            }}
          >
            成就列表
          </Text>
          <AlignJustify size={24} color="#333333" strokeWidth={2} />
        </View>

        {/* Large Achievement Card */}
        <View
          className="rounded-[10px] p-[18px] mb-3 items-center"
          style={{
            backgroundColor: '#F8F8F8',
            borderWidth: 1,
            borderColor: '#E2E2E2',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 12,
            height: 263,
          }}
        >
          {/* Circular Progress Chart */}
          <View className="relative items-center justify-center mb-6">
            <Svg width="180" height="180" viewBox="0 0 180 180">
              {/* Background Circle */}
              <Circle
                cx="90"
                cy="90"
                r="80"
                stroke="#E8E8E8"
                strokeWidth="12"
                fill="none"
              />
              {/* Progress Arc */}
              <Path
                d="M 90 10 A 80 80 0 0 1 150 50"
                stroke="#FFAD31"
                strokeWidth="12"
                fill="none"
                strokeLinecap="round"
              />
            </Svg>

            {/* Image Placeholder */}
            <View
              className="absolute items-center justify-center rounded-lg"
              style={{
                width: 40,
                height: 32,
                backgroundColor: '#F8F8F8',
                borderWidth: 1,
                borderColor: '#8F8F8F',
              }}
            >
              <View
                className="rounded-full"
                style={{
                  width: 8,
                  height: 8,
                  backgroundColor: '#8F8F8F',
                  position: 'absolute',
                  top: 8,
                  left: 12,
                }}
              />
              <View
                style={{
                  width: 20,
                  height: 12,
                  backgroundColor: '#8F8F8F',
                  position: 'absolute',
                  bottom: 6,
                  left: 8,
                }}
              />
            </View>
          </View>

          {/* Set Goal Button */}
          <TouchableOpacity
            className="rounded-[18px] px-6 py-2"
            style={{
              backgroundColor: '#FFAD31',
            }}
          >
            <Text
              className="text-center font-medium"
              style={{
                color: '#333333',
                fontSize: 13,
                fontFamily: 'Inter',
              }}
            >
              設定目標
            </Text>
          </TouchableOpacity>
        </View>

        {/* Two Metric Cards */}
        <View className="flex-row mb-3" style={{ gap: 13 }}>
          {/* Left Card - Coupon Usage */}
          <View 
            className="flex-1 rounded-[10px] p-[18px] justify-between"
            style={{
              height: 104,
              backgroundColor: '#1C1C1C',
              borderWidth: 1,
              borderColor: '#343434',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 12,
            }}
          >
            <View style={{ gap: 7 }}>
              <Text 
                className="text-sm"
                style={{ 
                  color: '#A0A0A0',
                  fontSize: 14,
                  fontFamily: 'Inter'
                }}
              >
                酷胖使用張數
              </Text>
              <View className="flex-row items-center" style={{ height: 35 }}>
                <Text 
                  className="text-xl font-bold"
                  style={{ 
                    color: '#EDEDED',
                    fontSize: 23,
                    lineHeight: 35,
                    fontFamily: 'Inter'
                  }}
                >
                  123
                </Text>
              </View>
            </View>
          </View>

          {/* Right Card - Total Savings */}
          <View 
            className="flex-1 rounded-[10px] p-[18px] justify-between"
            style={{
              height: 104,
              backgroundColor: '#1C1C1C',
              borderWidth: 1,
              borderColor: '#343434',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 12,
            }}
          >
            <View style={{ gap: 7 }}>
              <Text 
                className="text-sm"
                style={{ 
                  color: '#A0A0A0',
                  fontSize: 14,
                  fontFamily: 'Inter'
                }}
              >
                節省總金額 (元)
              </Text>
              <View className="flex-row items-center" style={{ height: 35 }}>
                <Text 
                  className="text-xl font-bold"
                  style={{ 
                    color: '#EDEDED',
                    fontSize: 23,
                    lineHeight: 35,
                    fontFamily: 'Inter'
                  }}
                >
                  456
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* List Section */}
        <View 
          className="rounded-[7px]"
          style={{
            backgroundColor: '#1C1C1C',
            borderWidth: 1,
            borderColor: '#343434',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 12,
          }}
        >
          {/* First List Item */}
          <View 
            className="p-[13px] flex-row justify-between items-center"
            style={{
              borderWidth: 1,
              borderColor: '#343434',
              backgroundColor: '#1C1C1C',
            }}
          >
            <View style={{ gap: 7 }}>
              <Text 
                style={{ 
                  color: '#EDEDED',
                  fontSize: 13,
                  fontFamily: 'Inter'
                }}
              >
                政大茶亭一店
              </Text>
              <Text 
                style={{ 
                  color: '#A0A0A0',
                  fontSize: 12,
                  fontFamily: 'Inter'
                }}
              >
                2024/07/14 14:15
              </Text>
            </View>
          </View>

          {/* Second List Item */}
          <View 
            className="p-[13px] flex-row justify-between items-center"
            style={{
              borderWidth: 1,
              borderColor: '#343434',
              backgroundColor: '#1C1C1C',
            }}
          >
            <View style={{ gap: 7 }}>
              <Text 
                style={{ 
                  color: '#EDEDED',
                  fontSize: 13,
                  fontFamily: 'Inter'
                }}
              >
                政大茶亭一店
              </Text>
              <Text 
                style={{ 
                  color: '#A0A0A0',
                  fontSize: 12,
                  fontFamily: 'Inter'
                }}
              >
                2024/07/14 14:15
              </Text>
            </View>
          </View>

          {/* Third List Item */}
          <View 
            className="p-[13px] flex-row justify-between items-center"
            style={{
              borderWidth: 1,
              borderColor: '#343434',
              backgroundColor: '#1C1C1C',
            }}
          >
            <View style={{ gap: 7 }}>
              <Text 
                style={{ 
                  color: '#EDEDED',
                  fontSize: 13,
                  fontFamily: 'Inter'
                }}
              >
                使用紀錄
              </Text>
            </View>
          </View>
        </View>

        {/* Spacer to push navbar to bottom */}
        <View className="flex-1" />

        {/* Bottom Navigation */}
        <View 
          className="flex-row justify-center items-center"
          style={{
            width: 320,
            paddingHorizontal: 104,
            paddingVertical: 22,
            backgroundColor: '#F8F8F8',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.10,
            shadowRadius: 18,
            elevation: 18,
            alignSelf: 'center',
          }}
        >
          <TouchableOpacity className="flex-1 items-center">
            <Home size={24} color="#707070" strokeWidth={2} />
          </TouchableOpacity>
          
          <TouchableOpacity className="flex-1 items-center">
            <StretchHorizontal size={24} color="#707070" strokeWidth={2} />
          </TouchableOpacity>
          
          <TouchableOpacity className="flex-1 items-center">
            <BarChart2 size={24} color="#FFAD31" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default AchievementsList;
