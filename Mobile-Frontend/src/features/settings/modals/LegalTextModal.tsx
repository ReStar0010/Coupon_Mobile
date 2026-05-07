import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Dimensions } from 'react-native';
import BottomSheet from '@/src/components/ui/BottomSheet';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';

const SCREEN_HEIGHT = Dimensions.get('window').height;

const LEGAL_CONTENT: Record<'terms' | 'privacy', { title: string; body: string }> = {
  terms: {
    title: '服務條款',
    body: `本服務條款（「條款」）規定了您使用 CouPro 應用程式的條件。

1. 使用資格
您必須年滿 13 歲才能使用本服務。

2. 帳號責任
您負責維護帳號安全，並對帳號下的所有活動負責。

3. 優惠券使用
優惠券有效期限內方可使用，逾期失效恕不補發。分享或轉讓優惠券需遵守本服務規定。

4. 服務變更
我們保留隨時修改或中止服務的權利，將提前通知用戶。

5. 免責聲明
本服務「按現狀」提供，不提供任何明示或暗示的保證。

如有疑問請聯繫 support@coupro.app`,
  },
  privacy: {
    title: '隱私政策',
    body: `本隱私政策說明 CouPro 如何收集、使用及保護您的個人資料。

1. 資料收集
我們收集您提供的資訊（如姓名、電子信箱）及使用服務時產生的資料（如優惠券記錄、位置資料）。

2. 資料使用
• 提供和改善服務
• 發送優惠通知
• 防範欺詐行為

3. 隱私模式
開啟隱私模式後，您的位置將不會顯示在 CouMap 上。

4. 資料分享
我們不會出售您的個人資料。僅在法律要求或獲得您同意的情況下分享資料。

5. 資料保留
您可以隨時申請刪除帳號及相關資料。

如有疑問請聯繫 privacy@coupro.app`,
  },
};

interface LegalTextModalProps {
  visible: boolean;
  type: 'terms' | 'privacy';
  onClose: () => void;
}

export default function LegalTextModal({
  visible,
  type,
  onClose,
}: LegalTextModalProps): React.JSX.Element {
  const { title, body } = LEGAL_CONTENT[type];

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={[styles.sheet, { height: SCREEN_HEIGHT * 0.72 }]}>
          <View style={styles.accentStrip} />
          <View style={styles.dragHandle} />
          <Text style={styles.title}>{title}</Text>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.body}>{body}</Text>
          </ScrollView>
          <View style={styles.footer}>
            <View style={styles.closeBtnWrapper}>
              <View style={styles.closeBtnShadow} />
              <Pressable style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>關閉</Text>
              </Pressable>
            </View>
          </View>
        </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 3,
    borderBottomWidth: 0,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 0,
    overflow: 'hidden',
  },
  accentStrip: {
    height: 6,
    backgroundColor: colors.yellow,
    marginHorizontal: -16,
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 14,
    marginBottom: 14,
  },
  title: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    color: colors.fg,
    marginBottom: 14,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  body: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: colors.fg,
    lineHeight: 21,
  },
  footer: {
    paddingVertical: 14,
    paddingBottom: 32,
    backgroundColor: colors.bg,
  },
  closeBtnWrapper: {
    position: 'relative',
  },
  closeBtnShadow: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: '100%',
    height: '100%',
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  closeBtn: {
    backgroundColor: colors.fg,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 5,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: '#fff',
  },
});
