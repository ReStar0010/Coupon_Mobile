import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

const Footer = () => {
  const router = useRouter();

  return (
    <View className="w-full bg-black items-center h-12 flex-row justify-center gap-4">
      <TouchableOpacity
        onPress={() => router.push("/demo")}
        className="font-medium text-3xl bg-white border-2 border-white px-4 py-2 rounded"
        activeOpacity={0.7}
      >
        <Text className="text-black text-lg font-medium">Demo</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/OptionsMenu")}
        className="font-medium text-3xl bg-white border-2 border-white px-4 py-2 rounded"
        activeOpacity={0.7}
      >
        <Text className="text-black text-lg font-medium">OptionsMenu</Text>
      </TouchableOpacity>
    </View>
  );
};

export default Footer;

// href: '/notifications', display: 'Notifications'
