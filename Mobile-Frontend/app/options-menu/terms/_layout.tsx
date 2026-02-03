import { Stack } from 'expo-router';

export default function TermsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Terms/index" />
    </Stack>
  );
}
