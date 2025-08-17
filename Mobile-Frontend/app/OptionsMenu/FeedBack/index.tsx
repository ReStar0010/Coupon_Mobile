import React from 'react';
import { SizableText, View, Text, H4, H5, XStack, YStack, Tabs, Separator } from 'tamagui';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, Bug, Lightbulb } from 'lucide-react-native';

const FeedBack: React.FC = () => {
  const router = useRouter();

  const handleGoBack = () => router.push('/OptionsMenu');

  return (
    <>
      <Stack.Screen options={{ headerShown: true }} />

      {/* Header with back button and title */}
      <XStack gap={13} items="center">
        <ChevronLeft size={24} onPress={handleGoBack} color={'black'} />
        <H4 fontSize={30} color={'$black1'} fontWeight={'bold'}>
          意見回饋
        </H4>
      </XStack>

      <Tabs defaultValue="bug" orientation="horizontal" flexDirection="column" overflow="hidden">
        <Tabs.List disablePassBorderRadius="bottom">
          <Tabs.Tab
            focusStyle={{ backgroundColor: 'red' }}
            flex={1}
            value="bug"
            // bordered
            // borderColor="#e1e1e1"
            // borderWidth={1}
          >
            {/* <XStack items='center' gap='$3'> */}
            {/* <Bug></Bug> */}
            <SizableText>Bug 回報</SizableText>
            {/* </XStack> */}
          </Tabs.Tab>

          <Tabs.Tab
            focusStyle={{ backgroundColor: 'red' }}
            flex={1}
            value="feature"
            // bordered
            // borderColor="#e1e1e1"
            // borderWidth={1}
          >
            {/* <XStack items='center' gap='$3'> */}
            {/* <Lightbulb></Lightbulb> */}
            <SizableText>功能建議</SizableText>
            {/* </XStack> */}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Content value="bug">
          <H5>Bug 回報</H5>
        </Tabs.Content>

        <Tabs.Content value="feature">
          <H5>功能建議</H5>
        </Tabs.Content>
      </Tabs>
    </>
  );
};

export default FeedBack;
