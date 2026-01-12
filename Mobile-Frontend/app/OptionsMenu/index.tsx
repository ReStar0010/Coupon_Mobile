import React, { useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logout, fetchAPI } from '../utils/authAPI';
import { View, Text, XStack, YStack, Card, Button, H4, ListItem, Separator } from 'tamagui';
import {
  ChevronLeft,
  ChevronRight,
  MessageSquareText,
  Phone,
  Smartphone,
  ScrollText,
  LogOut,
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
    router.push('/EasyUse'); // Always go back to EasyUse
  }, [router]);

  const handleUserDataEdit = useCallback(() => {
    router.push('/OptionsMenu/UserData');
  }, [router]);

  const handleFeedBack = useCallback(() => {
    router.push('/OptionsMenu/FeedBack');
  }, [router]);

  const handleContactUs = useCallback(() => {
    router.push('/OptionsMenu/ContactUs');
  }, [router]);

  const handleTerms = useCallback(() => {
    router.push('/OptionsMenu/Terms');
  }, [router]);

  const handlePhoneSettings = useCallback(() => {
    router.push('/OptionsMenu/PhoneSettings');
  }, [router]);

  // 登出功能 - 使用 AsyncStorage 方式
  const handleLogout = async () => {
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
          } catch (error) {
            console.error('登出失敗:', error);
            // 即使 API 請求失敗，也清除前端狀態並重定向
            try {
              await AsyncStorage.multiRemove([
                'auth_token',
                'user_id',
                'is_logged_in',
                'user_info',
              ]);
            } catch (storageError) {
              console.error('清除儲存失敗:', storageError);
            }
          }
          router.replace('/Login');
        },
      },
    ]);
  };
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <YStack flex="1" px="$4" py="$6" gap={13} style={{ paddingTop: insets.top + 10 }}>
        {/* Header with back button and title */}
        <XStack gap={13} items="center" >
          <ChevronLeft size={24} onPress={handleGoBack} color={'black'} />
          <H4 fontWeight={'bold'}>
            選單
          </H4>
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
            onPress={handlePhoneSettings}>
            <ListItem.Text>手機號碼</ListItem.Text>
          </ListItem>
          <Separator />
          <ListItem
            icon={Phone}
            iconAfter={ChevronRight}
            bg="white"
            hoverTheme
            pressTheme
            size="$6"
            onPress={handleContactUs}>
            <ListItem.Text>聯絡我們</ListItem.Text>
          </ListItem>
          <Separator />
          <ListItem
            icon={ScrollText}
            iconAfter={ChevronRight}
            style={{ borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}
            bg="white"
            hoverTheme
            pressTheme
            size="$6"
            onPress={handleTerms}>
            <ListItem.Text>服務條款</ListItem.Text>
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
            onPress={handleLogout}>
            <ListItem.Text>登出</ListItem.Text>
          </ListItem>
        </YStack>

        {/* Footer with version info */}
        <Text text="center" color="#a0a0a0">
          Version 1.0.0
        </Text>
      </YStack>
    </>
  );
};

export default OptionsMenu;
