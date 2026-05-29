import React from 'react';
import { useRouter } from 'expo-router';
import HistoryScreen from '@/src/features/home/HistoryScreen';

export default function HistoryRoute() {
  const router = useRouter();
  return (
    <HistoryScreen
      onBack={() => router.back()}
      onSelect={(id) => router.push(`/coupoint/history/${id}` as any)}
    />
  );
}
