/**
 * Route entry for the multiplayer (co-op) spinner room.
 *
 * The SpinnerScreen's "邀請朋友" / co-op invite flow used to open a fake
 * `CoopQRModal` with a placeholder QR grid and a "simulate join" button —
 * none of it touched the backend. The real co-op stack (CoopRoomScreen +
 * useCoopRoom + the WS consumer at /ws/spinner/v1/) was already implemented
 * but unmounted. This route wires it in so the SpinnerScreen can navigate
 * to it for actual room creation / invite / join.
 *
 * Token: the WS handshake authenticates via a JWT query param. We resolve
 * the access token before rendering CoopRoomScreen so an expired / missing
 * session lands the user on the spinner tab again with a friendly hint
 * rather than on a permanently-broken co-op screen showing a raw server
 * auth error. Token rotation mid-session is still handled by the thunk
 * passed to TokenProvider (re-read on every reconnect).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import CoopRoomScreen from '@/src/features/spinner/coop/CoopRoomScreen';
import { getAccessToken } from '@/src/services/auth/tokenStore';

type AuthState = 'checking' | 'ready' | 'unauthenticated';

export default function SpinnerCoopRoute(): React.JSX.Element {
  const [authState, setAuthState] = useState<AuthState>('checking');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getAccessToken();
      if (cancelled) return;
      setAuthState(token ? 'ready' : 'unauthenticated');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authState === 'unauthenticated') {
      // Bounce the user back to the spinner tab rather than leaving them
      // staring at a WS that will keep rejecting the handshake.
      router.replace('/(tabs)/spinner' as any);
    }
  }, [authState]);

  if (authState !== 'ready') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' }}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={{ color: '#fff', marginTop: 12 }}>
          {authState === 'unauthenticated' ? '請先登入' : '載入中…'}
        </Text>
      </View>
    );
  }

  return (
    <CoopRoomScreen
      token={async () => (await getAccessToken()) ?? ''}
      onExit={() => router.back()}
    />
  );
}
