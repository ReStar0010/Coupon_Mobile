import React from 'react';
import { XStack, YStack, View, ListItem, H4, Separator } from 'tamagui';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';

const UserData: React.FC = () => {
  const router = useRouter();

  const handleGoBack = () => router.push('/OptionsMenu');

  return (
    <>
      <Stack.Screen options={{ headerShown: true }} />

      <View flex="1" px="$4" py="$6" gap={13}>
        {/* Header with back button and title */}
        <XStack gap={13} items="center">
          <ChevronLeft size={24} onPress={handleGoBack} color={'black'} />
          <H4 fontSize={30} color={'$black1'} fontWeight={'bold'}>
            個人資料
          </H4>
        </XStack>

        {/* Tamagui ListItem Group with 3 items */}
        <YStack style={{ borderWidth: 1, borderColor: '#e1e1e1' }} rounded={'$5'}>
          <ListItem
            style={{ borderTopLeftRadius: 10, borderTopRightRadius: 10 }}
            bg="white"
            hoverTheme
            pressTheme
            size="$6"
          />
          <Separator />
          <ListItem
            style={{ borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}
            bg="white"
            hoverTheme
            pressTheme
            size="$6"
          />
        </YStack>
      </View>
    </>
  );
};

export default UserData;
