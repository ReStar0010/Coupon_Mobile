import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Image, Animated, ScrollView } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import { Ionicons } from '@expo/vector-icons';

export type LargeWidgetType = {
  className?: string;
  usage?: number; // e.g. 5
  metric?: string; // e.g. "TWD"
  total?: number; // e.g. 45
  logoUrl?: string; // e.g. "/spotify.png"
  label?: string; // e.g. "spotify"
  onGoalClick?: () => void; // Callback for when the widget is clicked to set a goal
  goalAchieved?: boolean; // Whether the goal has been achieved
  onGoalReset?: () => void; // Callback for resetting the goal
  completedGoals?: { name: string; image: string; amount: number }[]; // List of completed goals to display as badges
};

const CIRCLE_SIZE = 220;
const STROKE_WIDTH = 12;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const LargeWidget: React.FC<LargeWidgetType> = ({
  className = "",
  usage = 0,
  metric = "TWD",
  total = 0,
  logoUrl = "",
  label = "",
  onGoalClick,
  goalAchieved = false,
  onGoalReset,
  completedGoals = [],
}) => {
  const hasGoal = total > 0 && label !== "";
  const progress = hasGoal ? Math.min(usage / total, 1) : 0;
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  
  const [showCheckmark, setShowCheckmark] = useState(false);
  const [showConfirmScreen, setShowConfirmScreen] = useState(false);
  const [showBadges, setShowBadges] = useState(false);
  
  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const checkmarkAnim = useRef(new Animated.Value(0)).current;

  // Animation for when goal is achieved
  useEffect(() => {
    if (goalAchieved && !showConfirmScreen) {
      // Show the checkmark animation when goal is achieved
      setShowCheckmark(true);
      
      // Start checkmark animation
      Animated.sequence([
        Animated.timing(checkmarkAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Show confirmation screen after animation
      const animationTimeout = setTimeout(() => {
        setShowConfirmScreen(true);
      }, 2000);

      return () => {
        clearTimeout(animationTimeout);
      };
    } else if (!goalAchieved) {
      // Reset states when goal is not achieved
      setShowCheckmark(false);
      setShowConfirmScreen(false);
      checkmarkAnim.setValue(0);
      scaleAnim.setValue(1);
    }
  }, [goalAchieved, showConfirmScreen, label, total]);

  // Handle confirmation
  const handleConfirm = () => {
    setShowCheckmark(false);
    setShowConfirmScreen(false);
    checkmarkAnim.setValue(0);
    scaleAnim.setValue(1);

    if (onGoalReset) {
      onGoalReset();
    }
  };

  // Toggle badges display
  const toggleBadges = () => {
    if (completedGoals.length > 0) {
      setShowBadges(!showBadges);
    }
  };

  // Confirmation screen
  if (showConfirmScreen && goalAchieved) {
    return (
      <View 
        className={`bg-bg-white rounded-2xl shadow-[0px_1px_10px_rgba(0,0,0,0.25)] flex flex-col items-center justify-center p-8 ${className}`}
        style={{ width: "100%", height: 300 }}
      >
        <View className="flex flex-col items-center justify-center">
          <View className="w-20 h-20 mb-4 bg-green-500 rounded-full flex items-center justify-center">
            <Ionicons name="checkmark" size={48} color="white" />
          </View>
          <Text className="text-xl font-medium text-gray-700 mb-2">
            目標已達成！
          </Text>
          <Text className="text-gray-500 text-center mb-4 px-4">
            <Text className="font-bold">
              「恭喜你！你已經靠每次的優惠省下了 {label} ！」
            </Text>
          </Text>
          <TouchableOpacity
            className="px-4 py-2 bg-green-500 rounded-md"
            onPress={handleConfirm}
            activeOpacity={0.7}
          >
            <Text className="text-white font-medium">確認</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Badges list screen
  if (showBadges) {
    return (
      <View 
        className={`bg-bg-white rounded-2xl shadow-[0px_1px_10px_rgba(0,0,0,0.25)] flex flex-col items-center justify-start p-4 ${className}`}
        style={{ width: "100%", height: 300 }}
      >
        <View className="w-full flex flex-row justify-between items-center mb-4">
          <Text className="text-xl text-sec-black">已完成的儲蓄目標</Text>
          <TouchableOpacity onPress={() => setShowBadges(false)}>
            <Ionicons name="close" size={24} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          className="w-full"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          <View className="w-full flex flex-row flex-wrap justify-between">
            {completedGoals.map((goal, index) => (
              <View
                key={index}
                className="flex flex-col items-center bg-gray-50 rounded-lg p-3 shadow-sm mb-3"
                style={{ width: '48%' }}
              >
                <View className="w-12 h-12 rounded-full overflow-hidden mb-2 bg-white border border-gray-200">
                  <Image
                    source={
                      goal.image && goal.image !== "/Info.png"
                        ? { uri: goal.image }
                        : require("../../../assets/Info.png")
                    }
                    className="w-full h-full"
                    style={{ width: 48, height: 48 }}
                    resizeMode="cover"
                  />
                </View>
                <Text className="text-sm font-medium text-center" numberOfLines={2}>
                  {goal.name}
                </Text>
                <Text className="text-xs text-gray-500">
                  {goal.amount} {metric}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  // Main widget
  return (
    <TouchableOpacity
      className={`bg-bg-white rounded-2xl shadow-[0px_1px_10px_rgba(0,0,0,0.25)] flex flex-col items-center justify-center p-8 ${className}`}
      style={{ width: "100%", height: 300 }}
      onPress={!goalAchieved ? onGoalClick : undefined}
      activeOpacity={goalAchieved ? 1 : 0.7}
      disabled={goalAchieved}
    >
      {/* Completed goals badge */}
      {completedGoals.length > 0 && (
        <TouchableOpacity
          className="absolute top-2 right-2 bg-act-yellow rounded-full w-12 h-12 flex items-center justify-center z-10"
          onPress={toggleBadges}
          activeOpacity={0.7}
        >
          <Text className="text-sm font-bold text-sec-black">
            {completedGoals.length}
          </Text>
        </TouchableOpacity>
      )}

      {hasGoal ? (
        <Animated.View 
          className="items-center justify-center"
          style={{ transform: [{ scale: scaleAnim }] }}
        >
          {/* Progress Circle */}
          <View className="absolute" style={{ top: 30 }}>
            <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
              {/* Background Circle */}
              <Circle
                cx={CIRCLE_SIZE / 2}
                cy={CIRCLE_SIZE / 2}
                r={RADIUS}
                stroke="#E5E7EB"
                strokeWidth={STROKE_WIDTH}
                fill="none"
              />
              {/* Progress Circle */}
              <Circle
                cx={CIRCLE_SIZE / 2}
                cy={CIRCLE_SIZE / 2}
                r={RADIUS}
                stroke={goalAchieved ? "#22c55e" : "#1db954"}
                strokeWidth={STROKE_WIDTH}
                fill="none"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
              />
              
              {/* Checkmark animation */}
              {showCheckmark && (
                <Animated.View style={{ opacity: checkmarkAnim }}>
                  <G transform={`translate(${CIRCLE_SIZE / 2 - 30}, ${CIRCLE_SIZE / 2 - 30})`}>
                    <Circle
                      fill="#22c55e"
                      cx="30"
                      cy="30"
                      r="30"
                    />
                    <Path
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M18,30 L27,39 L42,21"
                    />
                  </G>
                </Animated.View>
              )}
            </Svg>
          </View>

          {/* Logo */}
          {logoUrl && !showCheckmark && (
            <View 
              className="absolute rounded-full bg-white"
              style={{
                top: 90,
                width: 70,
                height: 70,
              }}
            >
              <Image
                source={
                  logoUrl && logoUrl !== "/Info.png"
                    ? { uri: logoUrl }
                    : require("../../../assets/Info.png")
                }
                className="w-full h-full rounded-full"
                style={{ width: 70, height: 70 }}
                resizeMode="cover"
              />
            </View>
          )}

          {/* Progress Text */}
          <View 
            className="flex flex-col items-center justify-center absolute"
            style={{ top: 180 }}
          >
            <Text className="text-xl font-bold text-sec-black">
              {usage}/{total} {metric}
            </Text>
            <Text className="text-xl text-sec-black">{label}</Text>
          </View>
        </Animated.View>
      ) : (
        <View className="flex flex-col items-center justify-center">
          <View className="w-20 h-20 mb-4">
            <Ionicons name="flash" size={80} color="#D1D5DB" />
          </View>
          <Text className="text-xl font-medium text-gray-700 mb-2">
            還沒有儲蓄目標
          </Text>
          <Text className="text-gray-500 text-center mb-4 px-4">
            設定一個儲蓄目標來追蹤你的省錢進度
          </Text>
          <TouchableOpacity 
            className="px-4 py-2 bg-act-yellow rounded-md"
            activeOpacity={0.7}
          >
            <Text className="text-white font-medium">設定儲蓄目標</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default LargeWidget;
