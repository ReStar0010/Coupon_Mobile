import React, { useCallback, useEffect } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { logout, fetchAPI } from '@/app/utils/authAPI';
import { Text, XStack, YStack, Card, H4, ListItem, Separator } from 'tamagui';
import {
  ChevronLeft,
  ChevronRight,
  Smartphone,
  LogOut,
  ShieldBan,
  HelpCircle,
  Mail,
  Trash2,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const OptionsMenu: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = React.useState<string>('');

  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const response = await fetchAPI('/user-info/', { method: 'GET' });
        setEmail(response.data?.email || '');
      } catch (error) {
        console.error('Failed to fetch user info:', error);
      }
    };
    loadUserInfo();
  }, []);

  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleSupportMore = useCallback(() => {
    router.push('/options-menu/support-more/SupportMore');
  }, [router]);

  const handlePhoneSettings = useCallback(() => {
    router.push('/options-menu/phone-settings/PhoneSettings');
  }, [router]);

  const handleBlockedMerchants = useCallback(() => {
    router.push('/options-menu/blocked-merchants/BlockedMerchants');
  }, [router]);

  const handleEmailSettings = useCallback(() => {
    router.push('/options-menu/email-settings/EmailSettings');
  }, [router]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert('刪除帳號', '刪除帳號是永久性操作，無法復原。確定要繼續嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '繼續',
        style: 'destructive',
        onPress: () => router.push('/options-menu/delete-account'),
      },
    ]);
  }, [router]);

  // 登出功能 - AuthOrchestrator 處理導航
  const handleLogout = () => {
    Alert.alert('確認登出', '您確定要登出嗎？', [
      {
        text: '取消',
        style: 'cancel',
      },
      {
        text: '登出',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
            // AuthOrchestrator will handle navigation to /Login
          } catch (error) {
            console.error('登出失敗:', error);
            // logout() already cleared tokens and emitted event
            // AuthOrchestrator will still handle navigation
          }
        },
      },
    ]);
  };
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <YStack flex={1} px="$4" py="$6" style={{ paddingTop: insets.top + 10, minHeight: 0 }}>
        <ScrollView
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: insets.bottom + 24,
          }}
          showsVerticalScrollIndicator={true}
          bounces={true}
          overScrollMode="always"
        >
          <YStack gap={13}>
            {/* Header with back button and title */}
            <XStack gap={13} items="center">
              <ChevronLeft size={24} onPress={handleGoBack} color={'black'} />
              <H4 fontWeight={'bold'}>選單</H4>
            </XStack>

            {/* Tamagui Card */}
            <Card bg={'$white1'} bordered>
              <Card.Header>
                <H4 fontWeight={'bold'}>{email}</H4>
                {/* <Text color={'gray'}>rickylu@gmail.com</Text> */}
              </Card.Header>
              {/* <Card.Footer pr={'$4'} pb={'$3'}> */}
              {/* <XStack flex={1}></XStack> */}
              {/* <Button borderRadius="$10" bg={'#ffad31'} onPress={handleUserDataEdit}> */}
              {/* 編輯 */}
              {/* </Button> */}
              {/* </Card.Footer> */}
            </Card>

            {/* Tamagui ListItem Group with 3 items */}
            <YStack style={{ borderWidth: 1, borderColor: '#e1e1e1' }} rounded={'$5'}>
              <ListItem
                icon={Smartphone}
                iconAfter={ChevronRight}
                style={{ borderTopLeftRadius: 10, borderTopRightRadius: 10 }}
                bg="white"
                hoverTheme
                pressTheme
                size="$6"
                onPress={handlePhoneSettings}
              >
                <ListItem.Text>手機號碼</ListItem.Text>
              </ListItem>
              <Separator />
              <ListItem
                icon={Mail}
                iconAfter={ChevronRight}
                bg="white"
                hoverTheme
                pressTheme
                size="$6"
                onPress={handleEmailSettings}
              >
                <ListItem.Text>Email</ListItem.Text>
              </ListItem>
              <Separator />
              <ListItem
                icon={ShieldBan}
                iconAfter={ChevronRight}
                bg="white"
                hoverTheme
                pressTheme
                size="$6"
                onPress={handleBlockedMerchants}
              >
                <ListItem.Text>封鎖的商家</ListItem.Text>
              </ListItem>
              <Separator />
              <ListItem
                icon={HelpCircle}
                iconAfter={ChevronRight}
                style={{ borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}
                bg="white"
                hoverTheme
                pressTheme
                size="$6"
                onPress={handleSupportMore}
              >
                <ListItem.Text>支援與條款</ListItem.Text>
              </ListItem>
            </YStack>

            {/* Single List Item */}
            <YStack style={{ borderWidth: 1, borderColor: '#e1e1e1' }} rounded={'$5'}>
              <ListItem
                rounded="$5"
                icon={LogOut}
                iconAfter={ChevronRight}
                style={{ borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}
                bg="white"
                hoverTheme
                pressTheme
                size="$6"
                onPress={handleLogout}
              >
                <ListItem.Text>登出</ListItem.Text>
              </ListItem>
            </YStack>

            {/* Delete Account */}
            <YStack style={{ borderWidth: 1, borderColor: '#fecaca' }} rounded={'$5'}>
              <ListItem
                rounded="$5"
                icon={() => <Trash2 size={20} color="#EF4444" />}
                iconAfter={ChevronRight}
                style={{ borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}
                bg="white"
                hoverTheme
                pressTheme
                size="$6"
                onPress={handleDeleteAccount}
              >
                <ListItem.Text color="#EF4444">刪除帳號</ListItem.Text>
              </ListItem>
            </YStack>

            {/* Footer with version info */}
            <Text text="center" color="#a0a0a0">
              Version {require('../../app.json').expo.version}
            </Text>
          </YStack>
        </ScrollView>
      </YStack>
    </>
  );
};

export default OptionsMenu;
