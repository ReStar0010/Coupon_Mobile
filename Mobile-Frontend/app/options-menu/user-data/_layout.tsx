import { Stack } from 'expo-router';

export default function UserDataLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="UserData/index" />
    </Stack>
  );
}
