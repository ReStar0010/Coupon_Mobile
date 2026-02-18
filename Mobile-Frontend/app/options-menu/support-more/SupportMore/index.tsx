import React, { useCallback } from 'react';
import { useRouter, Stack } from 'expo-router';
import { View, XStack, H4, ListItem, YStack, Separator } from 'tamagui';
import { ChevronLeft, ChevronRight, Phone, ScrollText, HelpCircle, Shield } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SupportMore: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleGoBack = useCallback(() => router.back(), [router]);
  const handleContactUs = useCallback(() => router.push('/options-menu/contact-us/ContactUs'), [router]);
  const handleTerms = useCallback(() => router.push('/options-menu/terms/Terms'), [router]);
  const handleHelpSupport = useCallback(() => router.push('/options-menu/help-support/HelpSupport'), [router]);
  const handlePrivacyPolicy = useCallback(() => router.push('/options-menu/privacy-policy/PrivacyPolicy'), [router]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View flex={1} px="$4" py="$6" style={{ paddingTop: insets.top + 10 }}>
        <XStack gap={13} items="center" mb="$3">
          <ChevronLeft size={24} onPress={handleGoBack} color="black" />
          <H4 fontWeight="bold">支援與條款</H4>
        </XStack>

        <YStack style={{ borderWidth: 1, borderColor: '#e1e1e1' }} rounded="$5">
          <ListItem
            icon={Phone}
            iconAfter={ChevronRight}
            style={{ borderTopLeftRadius: 10, borderTopRightRadius: 10 }}
            bg="white"
            hoverTheme
            pressTheme
            size="$6"
            onPress={handleContactUs}
          >
            <ListItem.Text>聯絡我們</ListItem.Text>
          </ListItem>
          <Separator />
          <ListItem
            icon={ScrollText}
            iconAfter={ChevronRight}
            bg="white"
            hoverTheme
            pressTheme
            size="$6"
            onPress={handleTerms}
          >
            <ListItem.Text>服務條款</ListItem.Text>
          </ListItem>
          <Separator />
          <ListItem
            icon={HelpCircle}
            iconAfter={ChevronRight}
            bg="white"
            hoverTheme
            pressTheme
            size="$6"
            onPress={handleHelpSupport}
          >
            <ListItem.Text>幫助與支援</ListItem.Text>
          </ListItem>
          <Separator />
          <ListItem
            icon={Shield}
            iconAfter={ChevronRight}
            style={{ borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}
            bg="white"
            hoverTheme
            pressTheme
            size="$6"
            onPress={handlePrivacyPolicy}
          >
            <ListItem.Text>隱私政策</ListItem.Text>
          </ListItem>
        </YStack>
      </View>
    </>
  );
};

export default SupportMore;
