import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Keyboard,
  ScrollView,
} from 'react-native';
import BottomSheet from '@/src/components/ui/BottomSheet';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import { submitFeedback } from '@/src/services/api/profile';
import { track } from '@/src/services/analytics/posthog';

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
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Lift the sheet body up by the keyboard's reported height. This is
  // more reliable than KeyboardAvoidingView inside a Modal because the
  // Modal opens its own window and softInputMode=adjustResize does not
  // propagate cleanly on Android in Expo SDK 54.
  //
  // Gated on `visible` so we don't leak keyboard subscriptions while
  // the modal is closed — and so we reset `kbHeight` to 0 every time
  // the modal reopens, defending against a stale value if the keyboard
  // happened to stay open across a previous close.
  const scrollRef = useRef<ScrollView>(null);
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    if (!visible) {
      setKbHeight(0);
      return;
    }
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setKbHeight(e.endCoordinates.height);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [visible]);
  const isBug = type === 'bug';
  // Backend routes feedback via settings.SUPPORT_EMAIL (default
  // coupro707@gmail.com). Keep the FE label aligned with where the
  // message actually goes — anything else is a lie to the user.
  const email = 'coupro707@gmail.com';
  const canSend = text.trim().length > 0 && !sending;

  async function handleSend(): Promise<void> {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      await submitFeedback(type, text.trim());
      track('settings.feedback_submitted', { type, length: text.trim().length });
      setSent(true);
    } catch (err) {
      setError((err as Error).message || '送出失敗，請稍後再試');
    } finally {
      setSending(false);
    }
  }

  function handleClose() {
    setText('');
    setSent(false);
    setError(null);
    setSending(false);
    onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={handleClose}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
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
              {error ? (
                <Text testID="feedback-error" style={styles.errorText}>{error}</Text>
              ) : null}
              <View style={styles.sendBtnWrapper}>
                {canSend && <View style={styles.sendBtnShadow} />}
                <Pressable
                  testID="btn-send"
                  accessibilityState={{ disabled: !canSend }}
                  style={[
                    styles.sendBtn,
                    { backgroundColor: canSend ? colors.yellow : '#DDDDDD' },
                  ]}
                  onPress={() => { void handleSend(); }}
                >
                  <Text style={styles.sendBtnText}>
                    {sending ? '送出中…' : `送出至 ${email}`}
                  </Text>
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
          {/* Keyboard spacer — height tracks the live keyboard height so
              the textarea and send button stay above the keyboard top edge. */}
          <View testID="feedback-keyboard-spacer" style={{ height: kbHeight }} />
        </View>
      </ScrollView>
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
  errorText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 12,
    color: colors.red,
    marginBottom: 8,
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
