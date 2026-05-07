import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import BottomSheet from '@/src/components/ui/BottomSheet';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';

interface FeedbackModalProps {
  visible: boolean;
  type: 'bug' | 'feature';
  onClose: () => void;
}

export default function FeedbackModal({
  visible,
  type,
  onClose,
}: FeedbackModalProps): React.JSX.Element {
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const isBug = type === 'bug';
  const email = isBug ? 'bug@coupro.app' : 'feature@coupro.app';
  const canSend = text.trim().length > 0;

  function handleSend() {
    if (!canSend) return;
    setSent(true);
  }

  function handleClose() {
    setText('');
    setSent(false);
    onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={handleClose}>
      <View style={styles.sheet}>
          <View style={styles.accentStrip} />
          <View style={styles.dragHandle} />
          <Text style={styles.title}>
            {isBug ? '🐞 回報問題' : '💡 功能建議'}
          </Text>
          <Text style={styles.subtitle}>
            {isBug
              ? '描述你遇到的問題，我們會透過信箱回覆。'
              : '告訴我們你希望 CouPro 新增什麼功能。'}
          </Text>

          {sent ? (
            <View testID="success-card" style={styles.successCard}>
              <Text style={styles.successIcon}>✓</Text>
              <Text style={styles.successTitle}>已送出！謝謝你的回饋</Text>
              <Text style={styles.successSub}>
                我們會盡快透過 {email} 回覆
              </Text>
            </View>
          ) : (
            <>
              <TextInput
                testID="feedback-input"
                style={styles.textArea}
                value={text}
                onChangeText={setText}
                placeholder={
                  isBug
                    ? '例：點擊「抽券」後畫面閃退…'
                    : '例：希望可以掃描條碼直接領取…'
                }
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
              <View style={styles.sendBtnWrapper}>
                {canSend && <View style={styles.sendBtnShadow} />}
                <Pressable
                  testID="btn-send"
                  accessibilityState={{ disabled: !canSend }}
                  style={[
                    styles.sendBtn,
                    { backgroundColor: canSend ? colors.yellow : '#DDDDDD' },
                  ]}
                  onPress={handleSend}
                >
                  <Text style={styles.sendBtnText}>送出至 {email}</Text>
                </Pressable>
              </View>
            </>
          )}

          <View style={styles.closeBtnWrapper}>
            <View style={styles.closeBtnShadow} />
            <Pressable style={styles.closeBtn} onPress={handleClose}>
              <Text style={styles.closeBtnText}>關閉</Text>
            </Pressable>
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
    paddingBottom: 32,
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
    marginBottom: 16,
  },
  title: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    color: colors.fg,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: colors.muted,
    marginBottom: 14,
  },
  textArea: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    color: colors.fg,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 5,
    padding: 12,
    height: 110,
    marginBottom: 12,
  },
  sendBtnWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  sendBtnShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: '100%',
    height: '100%',
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  sendBtn: {
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sendBtnText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
    color: colors.fg,
  },
  successCard: {
    backgroundColor: colors.yellowLight,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  successIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  successTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    color: colors.fg,
  },
  successSub: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    color: colors.muted,
    marginTop: 3,
  },
  closeBtnWrapper: {
    position: 'relative',
    marginTop: 8,
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
    paddingVertical: 11,
    alignItems: 'center',
  },
  closeBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: '#fff',
  },
});
