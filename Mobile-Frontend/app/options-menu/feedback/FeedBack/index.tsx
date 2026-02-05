import React, { useState } from 'react';
import { Platform, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { View, Text, H4, H5, XStack, YStack, Tabs, Separator, TextArea, Button, ScrollView } from 'tamagui';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, Bug, Lightbulb, Send } from 'lucide-react-native';

const FeedBack: React.FC = () => {
  const router = useRouter();
  const [bugReport, setBugReport] = useState('');
  const [featureRequest, setFeatureRequest] = useState('');
  const [activeTab, setActiveTab] = useState('bug');

  const handleGoBack = () => router.back();

  const handleSubmit = () => {
    // Handle submission logic here
    const content = activeTab === 'bug' ? bugReport : featureRequest;
    if (content.trim()) {
      // You can implement your submission logic here
      console.log(`${activeTab === 'bug' ? 'Bug Report' : 'Feature Request'}: ${content}`);
      // Clear the form after submission
      if (activeTab === 'bug') {
        setBugReport('');
      } else {
        setFeatureRequest('');
      }
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true }} />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={90} // adjust if header overlaps
        >
          <View flex={1} px="$4" py="$6" gap="$4">
            {/* Header with back button and title */}
            <XStack gap={13} items="center">
              <ChevronLeft size={24} onPress={handleGoBack} color={'black'} />
              <H4 fontSize={30} color={'$black1'} fontWeight={'bold'}>
                意見回饋
              </H4>
            </XStack>

            {/* Tab Group */}
            <Tabs defaultValue="bug" onValueChange={setActiveTab} flex={1} orientation='horizontal' flexDirection='column'>
              <Tabs.List backgroundColor="$background" disablePassBorderRadius='bottom'>
                <Tabs.Tab
                  value="bug"
                  flex={1}
                  bordered
                  borderColor='#e1e1e1'
                  focusStyle={{ bg: '#ffad31' }}
                >
                  <XStack gap="$2" items="center">
                    <Bug size={18} />
                    <Text>Bug 回報</Text>
                  </XStack>
                </Tabs.Tab>

                <Tabs.Tab
                  value="feature"
                  flex={1}
                  bordered
                  borderColor='#e1e1e1'
                >
                  <XStack gap="$2" items="center">
                    <Lightbulb size={18} />
                    <Text>功能建議</Text>
                  </XStack>
                </Tabs.Tab>
              </Tabs.List>

              {/* Bug Report Tab Content */}
              <Tabs.Content value="bug" flex={1}>
                <YStack flex={1} gap="$4">

                  <TextArea
                    placeholder="發生了什麼事 ? 越詳盡越好 !"
                    value={bugReport}
                    onChangeText={setBugReport}
                    flex={1}
                    size="$4"
                    fontSize="$4"
                    borderColor="#e1e1e1"
                    borderWidth={1}
                    borderTopLeftRadius={0}
                    borderTopRightRadius={0}
                    p="$3"
                    maxH="60%"
                  />

                  <Button
                    bg="#ffad31"
                    onPress={handleSubmit}
                    disabled={!bugReport.trim()}
                    opacity={bugReport.trim() ? 1 : 0.5}
                    iconAfter={Send}
                  >
                    提交
                  </Button>
                </YStack>
              </Tabs.Content>

              {/* Feature Request Tab Content */}
              <Tabs.Content value="feature" flex={1} >
                <YStack flex={1} gap="$4">

                  <TextArea
                    placeholder="告訴我們可以怎麼樣讓 CouPro 更好 !"
                    value={featureRequest}
                    onChangeText={setFeatureRequest}
                    flex={1}
                    size="$4"
                    fontSize="$4"
                    borderColor="#e1e1e1"
                    borderWidth={1}
                    borderTopLeftRadius={0}
                    borderTopRightRadius={0}
                    p="$3"
                    maxH="60%"
                  />

                  <Button
                    bg="#ffad31"
                    onPress={handleSubmit}
                    disabled={!featureRequest.trim()}
                    opacity={featureRequest.trim() ? 1 : 0.5}
                    iconAfter={Send}
                  >
                    提交
                  </Button>
                </YStack>

              </Tabs.Content>
            </Tabs>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </>
  );
};

export default FeedBack;
