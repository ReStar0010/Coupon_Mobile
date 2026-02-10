import { Stack } from 'expo-router';

export default function OptionsMenuLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="phone-settings" />
      <Stack.Screen name="email-settings" />
      <Stack.Screen name="blocked-merchants" />
      <Stack.Screen name="contact-us" />
      <Stack.Screen name="feedback" />
      <Stack.Screen name="help-support" />
      <Stack.Screen name="privacy-policy" />
      <Stack.Screen name="terms" />
      <Stack.Screen name="user-data" />
      <Stack.Screen name="delete-account" />
    </Stack>
  );
}
