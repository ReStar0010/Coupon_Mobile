import { Stack } from 'expo-router';

export default function ContactUsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="ContactUs/index" />
    </Stack>
  );
}
