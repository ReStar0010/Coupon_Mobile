import React from 'react';
import { View, Text, ScrollView } from 'react-native';

export type TextPanelType = {
  className?: string;
};

const TextPanel: React.FC<TextPanelType> = ({ className = '' }) => {
  return (
    <View
      className={`bg-bg-white flex flex-row items-start justify-start self-stretch rounded-xl px-[27px] py-[33.3px] shadow-[0px_1px_10px_rgba(0,_0,_0,_0.25)] ${className}`}>
      <View className="flex flex-1 flex-row items-start justify-start px-0.5 py-0">
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={true}
          contentContainerStyle={{
            paddingBottom: 20,
          }}>
          <View className="flex-1">
            <Text
              className="text-sec-black font-jost text-base"
              style={{
                lineHeight: 27,
                marginBottom: 16,
              }}>
              歡迎使用 CouPro！為了保障所有使用者與合作商家的權益，請留意以下幾點使用規則：
            </Text>

            <Text
              className="text-sec-black font-jost text-base font-bold"
              style={{
                lineHeight: 27,
                marginTop: 16,
                marginBottom: 8,
              }}>
              一、使用即表示同意以下事項：
            </Text>
            <View style={{ paddingLeft: 16, marginBottom: 16 }}>
              <Text
                className="text-sec-black font-jost text-base"
                style={{
                  lineHeight: 27,
                  marginBottom: 4,
                }}>
                • 遵守平台規範，誠實使用優惠券
              </Text>
              <Text
                className="text-sec-black font-jost text-base"
                style={{
                  lineHeight: 27,
                  marginBottom: 4,
                }}>
                • 不得以任何形式轉賣或惡意使用優惠
              </Text>
              <Text
                className="text-sec-black font-jost text-base"
                style={{
                  lineHeight: 27,
                  marginBottom: 4,
                }}>
                • 不得以機器人、腳本等方式自動操作或濫用優惠
              </Text>
            </View>

            <Text
              className="text-sec-black font-jost text-base font-bold"
              style={{
                lineHeight: 27,
                marginTop: 16,
                marginBottom: 8,
              }}>
              二、優惠券說明：
            </Text>
            <View style={{ paddingLeft: 16, marginBottom: 16 }}>
              <Text
                className="text-sec-black font-jost text-base"
                style={{
                  lineHeight: 27,
                  marginBottom: 4,
                }}>
                • 所有優惠皆由合作商家提供，優惠內容與有效期限以商家設定為準，平台不負責兌現
              </Text>
              <Text
                className="text-sec-black font-jost text-base"
                style={{
                  lineHeight: 27,
                  marginBottom: 4,
                }}>
                • 優惠內容可能隨時變動，請於使用前再次確認
              </Text>
              <Text
                className="text-sec-black font-jost text-base"
                style={{
                  lineHeight: 27,
                  marginBottom: 4,
                }}>
                • 「隨取即用」為公開優惠；「專屬酷胖」則需登入帳號抽取或經他人轉傳獲得
              </Text>
            </View>

            <Text
              className="text-sec-black font-jost text-base font-bold"
              style={{
                lineHeight: 27,
                marginTop: 16,
                marginBottom: 8,
              }}>
              三、會員資料與帳號規範：
            </Text>
            <View style={{ paddingLeft: 16, marginBottom: 16 }}>
              <Text
                className="text-sec-black font-jost text-base"
                style={{
                  lineHeight: 27,
                  marginBottom: 4,
                }}>
                • 請妥善保管您的帳號資訊，勿與他人共用
              </Text>
              <Text
                className="text-sec-black font-jost text-base"
                style={{
                  lineHeight: 27,
                  marginBottom: 4,
                }}>
                • 遇有違規行為（如濫用優惠、冒用他人身份等），平台有權限制使用或停權處理
              </Text>
              <Text
                className="text-sec-black font-jost text-base"
                style={{
                  lineHeight: 27,
                  marginBottom: 4,
                }}>
                • 平台不會主動向您索取密碼或個人付款資訊
              </Text>
            </View>

            <Text
              className="text-sec-black font-jost text-base font-bold"
              style={{
                lineHeight: 27,
                marginTop: 16,
                marginBottom: 8,
              }}>
              四、商家資訊與服務：
            </Text>
            <View style={{ paddingLeft: 16, marginBottom: 16 }}>
              <Text
                className="text-sec-black font-jost text-base"
                style={{
                  lineHeight: 27,
                  marginBottom: 4,
                }}>
                • 各店家優惠內容、服務條件與商品皆由商家提供與負責
              </Text>
              <Text
                className="text-sec-black font-jost text-base"
                style={{
                  lineHeight: 27,
                  marginBottom: 4,
                }}>
                • 如有任何糾紛，建議直接與商家聯繫，我們也樂意協助處理
              </Text>
            </View>

            <Text
              className="text-sec-black font-jost text-base font-bold"
              style={{
                lineHeight: 27,
                marginTop: 16,
              }}>
              CouPro 致力於提供方便、安全的優惠體驗，感謝您的支持與配合！
            </Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

export default TextPanel;
