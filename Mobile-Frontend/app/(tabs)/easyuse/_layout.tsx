import { Stack } from 'expo-router';

export default function EasyUseLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="qr-claim" />
      <Stack.Screen name="enter-redeem-code" />
      <Stack.Screen name="[id]/index" />
      <Stack.Screen name="[id]/redeem/index" />
      <Stack.Screen name="unified-redeem/[code]" />
    </Stack>
  );
}
