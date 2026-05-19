import React from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import HistoryDetailScreen from '@/src/features/home/HistoryDetailScreen';

export default function HistoryDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      {/* History detail is a read-only view — allow iOS edge-swipe back. */}
      <Stack.Screen options={{ gestureEnabled: true, fullScreenGestureEnabled: true }} />
      <HistoryDetailScreen id={id ?? ''} onBack={() => router.back()} />
    </>
  );
}
