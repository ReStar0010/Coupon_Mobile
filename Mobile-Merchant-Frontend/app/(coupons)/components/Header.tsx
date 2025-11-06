import React from 'react';
import { XStack, Text } from 'tamagui';
import { colors } from '@/constants/colors';
import { TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image as ExpoImage } from 'expo-image';

interface HeaderProps {
  onLogoPress?: () => void;
}

export function Header({ onLogoPress }: HeaderProps) {
  return (
    <XStack
      paddingHorizontal="$4"
      paddingVertical="$3"
      backgroundColor={colors.white}
      alignItems="center"
      justifyContent="space-between"
      borderBottomWidth={1}
      borderBottomColor={colors.border}
    >
      {/* Logo */}
      <TouchableOpacity 
        onPress={onLogoPress} 
        activeOpacity={onLogoPress ? 0.7 : 1}
        disabled={!onLogoPress}
      >
        <XStack alignItems="center" gap="$2.5">
          <ExpoImage
            source={require('@/assets/images/adaptive-icon.png')}
            style={styles.logoIcon}
            contentFit="contain"
          />
          <Text 
            fontSize={30} 
            fontWeight="800" 
            color={colors.textPrimary}
            style={styles.logoText}
          >
            CouPro
          </Text>
        </XStack>
      </TouchableOpacity>

      {/* Hamburger Menu */}
      <TouchableOpacity
        onPress={() => {
          // TODO: Open navigation drawer
          console.log('Menu pressed');
        }}
        activeOpacity={0.7}
      >
        <MaterialIcons name="menu" size={24} color={colors.textPrimary} />
      </TouchableOpacity>
    </XStack>
  );
}

const styles = StyleSheet.create({
  logoIcon: {
    width: 36,
    height: 36,
  },
  logoText: {
    fontFamily: 'System',
    letterSpacing: -0.5,
  },
});

