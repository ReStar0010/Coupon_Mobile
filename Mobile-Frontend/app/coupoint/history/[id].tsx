import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import HistoryDetailScreen from '@/src/features/home/HistoryDetailScreen';

export default function HistoryDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  return <HistoryDetailScreen id={id ?? ''} onBack={() => router.back()} />;
}
