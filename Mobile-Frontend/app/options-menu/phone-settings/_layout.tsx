import { Stack } from 'expo-router';

export default function PhoneSettingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="PhoneSettings/index" />
      <Stack.Screen name="PhoneSettings/OTPRequestScreen" />
      <Stack.Screen name="PhoneSettings/OTPVerifyScreen" />
    </Stack>
  );
}
