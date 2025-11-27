import { Stack } from 'expo-router';

export default function StatisticsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="History/index" />
      <Stack.Screen name="History/[id]/index" />
    </Stack>
  );
}

