import { Stack } from 'expo-router';

export default function BlockedMerchantsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="BlockedMerchants/index" />
    </Stack>
  );
}
