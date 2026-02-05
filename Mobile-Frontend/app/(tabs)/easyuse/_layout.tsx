import { Stack } from 'expo-router';

export default function EasyUseLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="qr-claim" />
      <Stack.Screen name="unified-redeem" />
    </Stack>
  );
}
