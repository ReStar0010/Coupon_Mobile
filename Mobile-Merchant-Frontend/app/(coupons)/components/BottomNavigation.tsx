import React from 'react';
import { XStack } from 'tamagui';
import { TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { colors } from '@/constants/colors';
import { useRouter } from 'expo-router';

interface BottomNavigationProps {
  activeTab: 'home' | 'list' | 'statistics';
}

export function BottomNavigation({ activeTab }: BottomNavigationProps) {
  const router = useRouter();

  const tabs = [
    {
      id: 'home' as const,
      icon: 'home' as const,
      onPress: () => {
        router.push('/(coupons)/');
      },
    },
    {
      id: 'list' as const,
      icon: 'menu' as const,
      onPress: () => {
        // TODO: Navigate to list
        console.log('Navigate to list');
      },
    },
    {
      id: 'statistics' as const,
      icon: 'bar-chart' as const,
      onPress: () => {
        // TODO: Navigate to statistics
        console.log('Navigate to statistics');
      },
    },
  ];

  return (
    <XStack
      backgroundColor={colors.white}
      borderTopWidth={1}
      borderTopColor={colors.border}
      paddingVertical="$3"
      paddingHorizontal="$6"
      justifyContent="space-around"
      alignItems="center"
      style={styles.container}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={tab.onPress}
            activeOpacity={0.7}
            style={styles.tab}
          >
            <MaterialIcons
              name={tab.icon}
              size={24}
              color={isActive ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>
        );
      })}
    </XStack>
  );
}

const styles = StyleSheet.create({
  container: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  tab: {
    padding: 8,
  },
});

