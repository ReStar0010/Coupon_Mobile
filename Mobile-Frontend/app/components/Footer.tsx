import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

const Footer = () => {
  const router = useRouter();

  return (
    <View className="h-12 w-full flex-row items-center justify-center gap-4 bg-black">
      <TouchableOpacity
        onPress={() => router.push('/demo')}
        className="rounded border-2 border-white bg-white px-4 py-2 text-3xl font-medium"
        activeOpacity={0.7}>
        <Text className="text-lg font-medium text-black">Demo</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/OptionsMenu')}
        className="rounded border-2 border-white bg-white px-4 py-2 text-3xl font-medium"
        activeOpacity={0.7}>
        <Text className="text-lg font-medium text-black">OptionsMenu</Text>
      </TouchableOpacity>
    </View>
  );
};

export default Footer;

// href: '/notifications', display: 'Notifications'
