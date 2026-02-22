import { Stack } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'DeleteAccount/index',
};

export default function DeleteAccountLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
      initialRouteName="DeleteAccount/index">
      <Stack.Screen name="DeleteAccount/index" />
    </Stack>
  );
}
