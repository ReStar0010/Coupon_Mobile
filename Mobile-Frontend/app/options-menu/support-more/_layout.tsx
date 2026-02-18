import { Stack } from 'expo-router';

export default function SupportMoreLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="SupportMore/index" />
    </Stack>
  );
}
