import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import HistoryDetailScreen from '@/src/features/home/HistoryDetailScreen';

export default function HistoryDetailRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  // Navigation is button-only app-wide (see app/_layout.tsx) — the screen's
  // own onBack handles return, so no per-screen gesture override is needed.
  return <HistoryDetailScreen id={id ?? ''} onBack={() => router.back()} />;
}
