import React from 'react';
import { XStack, View, Text, H4, ScrollView, H6 } from 'tamagui';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

const Terms: React.FC = () => {
  const router = useRouter();

  const handleGoBack = () => router.push('/OptionsMenu');

  return (
    <>
      <Stack.Screen options={{ headerShown: true }} />

      <ScrollView px="$4" py="$6">
        {/* Header with back button and title */}
        <XStack gap={'$3'} items="center">
          <ChevronLeft size={24} onPress={handleGoBack} color={'black'} />
          <H4 fontSize={30} color={'$black1'} fontWeight={'bold'}>
            服務條款
          </H4>
        </XStack>

        <View
          flex={1}
          gap={'$10'}
          mt={'$5'}
          bg="white"
          rounded={'$5'}
          p={'$5'}
          style={{ borderWidth: 1, borderColor: '#e1e1e1' }}>
          <Text>
            {' '}
            歡迎使用 CouPro！為了保障所有使用者與合作商家的權益，請留意以下幾點使用規則：{' '}
          </Text>

          <View gap={'$3'}>
            <H6 fontWeight={'medium'}> 一、使用即表示同意以下事項： </H6>
            <Text> • 遵守平台規範，誠實使用優惠券 </Text>
            <Text> • 不得以任何形式轉賣或惡意使用優惠 </Text>
            <Text> • 不得以機器人、腳本等方式自動操作或濫用優惠</Text>
          </View>

          <View gap={'$3'}>
            <H6 fontWeight={'medium'}> 二、優惠券說明： </H6>
            <Text>
              {' '}
              • 所有優惠皆由合作商家提供，優惠內容與有效期限以商家設定為準，平台不負責兌現{' '}
            </Text>
            <Text> • 優惠內容可能隨時變動，請於使用前再次確認 </Text>
            <Text> • 「隨取即用」為公開優惠；「專屬酷胖」則需登入帳號抽取或經他人轉傳獲得 </Text>
          </View>

          <View gap={'$3'}>
            <H6 fontWeight={'medium'}> 三、會員資料與帳號規範： </H6>
            <Text> • 請妥善保管您的帳號資訊，勿與他人共用 </Text>
            <Text> • 遇有違規行為（如濫用優惠、冒用他人身份等），平台有權限制使用或停權處理 </Text>
            <Text> • 平台不會主動向您索取密碼或個人付款資訊 </Text>
          </View>

          <View gap={'$3'}>
            <H6 fontWeight={'medium'}> 四、商家資訊與服務： </H6>
            <Text> • 各店家優惠內容、服務條件與商品皆由商家提供與負責 </Text>
            <Text> • 如有任何糾紛，建議直接與商家聯繫，我們也樂意協助處理 </Text>
          </View>

          <Text> CouPro 致力於提供方便、安全的優惠體驗，感謝您的支持與配合！ </Text>
        </View>
      </ScrollView>
    </>
  );
};

export default Terms;
