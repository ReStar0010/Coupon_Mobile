/**
 * Terms of Service Screen
 * Displays terms of service fetched from backend (same pattern as privacy policy).
 */

import React, { useState, useEffect } from 'react';
import { XStack, View, Text, H4, ScrollView, H6 } from 'tamagui';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator } from 'react-native';
import { API_URL } from '@/app/config/api';

interface TermsData {
  title: string;
  content: string;
  last_updated: string;
}

const Terms: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [termsData, setTermsData] = useState<TermsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGoBack = () => router.back();

  useEffect(() => {
    loadTerms();
  }, []);

  const loadTerms = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_URL}/terms/`);
      const data = await response.json();
      setTermsData(data);
    } catch (err) {
      console.error('Failed to load terms of service:', err);
      setError('無法載入服務條款，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  let content: React.ReactNode = null;

  if (loading) {
    content = (
      <View flex={1} py="$8" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text mt="$4" color="$gray10">載入中...</Text>
      </View>
    );
  } else if (error) {
    content = (
      <View flex={1} py="$8" style={{ alignItems: 'center' }}>
        <Text color="$red10" style={{ textAlign: 'center' }}>{error}</Text>
        <Text mt="$4" color="$blue10" onPress={loadTerms}>重試</Text>
      </View>
    );
  } else if (termsData) {
    content = (
      <View
        flex={1}
        gap={'$4'}
        mt={'$5'}
        bg="white"
        rounded={'$5'}
        p={'$5'}
        style={{ borderWidth: 1, borderColor: '#e1e1e1' }}
      >
        {termsData.last_updated ? (
          <View mb="$2">
            <Text fontSize={12} color="$gray10">
              最後更新：{new Date(termsData.last_updated).toLocaleDateString('zh-TW', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
        ) : null}
        <H6 fontWeight="500" mb="$2">{termsData.title}</H6>
        <Text fontSize={14} lineHeight={24} color="$gray12" whiteSpace="pre-line">
          {termsData.content}
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView px="$4" py="$6" style={{ paddingTop: insets.top + 10 }}>
        <XStack gap={'$3'} items="center">
          <ChevronLeft size={24} onPress={handleGoBack} color={'black'} />
          <H4 fontSize={30} color={'$black1'} fontWeight={'bold'}>
            服務條款
          </H4>
        </XStack>

        {content}
      </ScrollView>
    </>
  );
};

export default Terms;
