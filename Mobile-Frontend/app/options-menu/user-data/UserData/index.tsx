import React from 'react';
import { 
  Select, 
  TooltipSimple, 
  Paragraph, 
  Sheet, 
  Text, 
  Button, 
  XStack, YStack, View, ListItem, H4, Separator, Dialog, Fieldset, Label, Input, Unspaced, Adapt } from 'tamagui';
import { X, Pencil, ChevronLeft, ChevronDown } from 'lucide-react-native';
import { Stack, useRouter } from 'expo-router';
import { DismissKeyboardView } from '@/app/components/DismissKeyboardView';

const UserData: React.FC = () => {

  const router = useRouter();

  const handleGoBack = () => router.back();

  return (
    <>
      <Stack.Screen options={{ headerShown: true }} />

      <DismissKeyboardView>
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
            size="$6"
          >
            <ListItem.Text>名稱</ListItem.Text>
            <ListItem.Text text='right'>RickyLu</ListItem.Text>
          </ListItem>

          <Separator borderColor="#e1e1e1" />

          <ListItem
            style={{ borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}
            bg="white"
            size="$6"
          >
            <ListItem.Text>Email</ListItem.Text>
            <ListItem.Text text='right'>rickylu@gmail.com</ListItem.Text>
          </ListItem>

        </YStack>

        <DialogInstance></DialogInstance>

        </View>
      </DismissKeyboardView>
    </>
  );
};

function DialogInstance({ disableAdapt }: { disableAdapt?: boolean }) {
  return (

    <Dialog modal>
      <Dialog.Trigger asChild>
        <Button bg='#FFAD31'>
          <Button.Text>編輯{disableAdapt ? ` (No Sheet)` : ''}</Button.Text>
        </Button>
      </Dialog.Trigger>

      {!disableAdapt && (
        <Adapt when="maxMd" platform="touch">
          <Sheet
            animation="medium"
            zIndex={200000}
            modal
            dismissOnSnapToBottom
            unmountChildrenWhenHidden // we're nesting infinitely so need this
          >
            <Sheet.Overlay backgroundColor="$shadow6" animation="lazy" enterStyle={{ opacity: 0 }} exitStyle={{ opacity: 0 }} />
            <Sheet.Handle></Sheet.Handle>
            <Sheet.Frame padding="$4" gap="$4">
              <Adapt.Contents />
            </Sheet.Frame>
          </Sheet>
        </Adapt>
      )}

      <Dialog.Portal>
        <Dialog.Overlay
          key="overlay"
          backgroundColor="$shadow6"
          animateOnly={['transform', 'opacity']}
          animation={[
            'quicker',
            {
              opacity: {
                overshootClamping: true,
              },
            },
          ]}
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
        />

        <Dialog.Content
          bordered
          paddingVertical="$4"
          paddingHorizontal="$6"
          elevate
          borderRadius="$6"
          key="content"
          animateOnly={['transform', 'opacity']}
          animation={[
            'quicker',
            {
              opacity: {
                overshootClamping: true,
              },
            },
          ]}
          enterStyle={{ x: 0, y: 20, opacity: 0 }}
          exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
          gap="$4"
        >
          <Dialog.Title>
            編輯
          </Dialog.Title>
          <Dialog.Description>
            在這裡更改您的個人資料，完成後點擊儲存。
          </Dialog.Description>

          <Fieldset gap="$4" horizontal>
            <Label width={64} htmlFor="name">
              名稱
            </Label>
            <Input flex={1} id="name" defaultValue="User Name" />
          </Fieldset>

          <XStack alignSelf="flex-end" gap="$4">
            <Dialog.Close displayWhenAdapted asChild>
              <Button bg='#FFAD31' aria-label="Close">
                儲存
              </Button>
            </Dialog.Close>
          </XStack>

        </Dialog.Content>

      </Dialog.Portal>
    </Dialog>
  )
}

export default UserData;
