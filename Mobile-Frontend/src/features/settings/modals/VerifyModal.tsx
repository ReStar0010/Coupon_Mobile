import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import BottomSheet from '@/src/components/ui/BottomSheet';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';

type VerifyStep = 'input' | 'code' | 'done';

interface VerifyModalProps {
  visible: boolean;
  field: 'email' | 'phone';
  currentVal: string;
  onClose: () => void;
}

export default function VerifyModal({
  visible,
  field,
  currentVal,
  onClose,
}: VerifyModalProps): React.JSX.Element {
  const [step, setStep] = useState<VerifyStep>('input');
  const [code, setCode] = useState('');
  const isEmail = field === 'email';
  const label = isEmail ? '電子信箱' : '手機號碼';
  const canVerify = code.length === 6;

  function handleClose() {
    setStep('input');
    setCode('');
    onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={handleClose}>
      <View style={styles.sheet}>
          <View style={styles.accentStrip} />
          <View style={styles.dragHandle} />
          <Text style={styles.title}>驗證{label}</Text>

          {step === 'input' && (
            <>
              <Text style={styles.subtitle}>
                點擊後，驗證碼將發送至：{'\n'}
                <Text style={styles.boldVal}>{currentVal || '（尚未設定）'}</Text>
              </Text>
              <View style={styles.primaryBtnWrapper}>
                {currentVal ? <View style={styles.primaryBtnShadow} /> : null}
                <Pressable
                  style={[
                    styles.primaryBtn,
                    { backgroundColor: currentVal ? colors.yellow : '#DDDDDD' },
                  ]}
                  onPress={() => currentVal && setStep('code')}
                >
                  <Text style={styles.primaryBtnText}>發送驗證碼</Text>
                </Pressable>
              </View>
            </>
          )}

          {step === 'code' && (
            <>
              <Text style={styles.subtitle}>
                驗證碼已發送至{' '}
                <Text style={styles.boldVal}>{currentVal}</Text>
              </Text>
              <View style={styles.otpRow}>
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <View
                    key={i}
                    style={[
                      styles.otpBox,
                      { borderColor: i < code.length ? colors.yellow : colors.border },
                    ]}
                  >
                    <Text style={styles.otpChar}>{code[i] ?? ''}</Text>
                  </View>
                ))}
              </View>
              <TextInput
                style={styles.otpInput}
                value={code}
                onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="phone-pad"
                placeholder="輸入 6 位數驗證碼"
                placeholderTextColor={colors.muted}
                maxLength={6}
                textAlign="center"
              />
              <View style={styles.primaryBtnWrapper}>
                {canVerify && <View style={styles.primaryBtnShadow} />}
                <Pressable
                  style={[
                    styles.primaryBtn,
                    { backgroundColor: canVerify ? colors.yellow : '#DDDDDD' },
                  ]}
                  onPress={() => canVerify && setStep('done')}
                >
                  <Text style={styles.primaryBtnText}>確認驗證</Text>
                </Pressable>
              </View>
            </>
          )}

          {step === 'done' && (
            <View style={styles.doneBox}>
              <View style={styles.doneCircle}>
                <Text style={styles.doneCheckmark}>✓</Text>
              </View>
              <Text style={styles.doneText}>{label}驗證成功！</Text>
            </View>
          )}

          <View style={[styles.closeBtnWrapper, step === 'input' ? null : styles.closeBtnMarginTop]}>
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
    lineHeight: 18,
  },
  boldVal: {
    fontFamily: fontFamilies.bold,
    color: colors.fg,
  },
  otpRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  otpBox: {
    flex: 1,
    height: 52,
    backgroundColor: colors.card,
    borderWidth: 2.5,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpChar: {
    fontFamily: fontFamilies.bold,
    fontSize: 22,
    color: colors.fg,
  },
  otpInput: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    color: colors.fg,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 5,
    paddingVertical: 11,
    paddingHorizontal: 12,
    letterSpacing: 4,
    marginBottom: 12,
  },
  primaryBtnWrapper: {
    position: 'relative',
    marginBottom: 10,
  },
  primaryBtnShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: '100%',
    height: '100%',
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  primaryBtn: {
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
    color: colors.fg,
  },
  doneBox: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingBottom: 12,
  },
  doneCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.green,
    borderWidth: 2.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  doneCheckmark: {
    fontSize: 26,
    color: '#fff',
    fontFamily: fontFamilies.bold,
  },
  doneText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    color: colors.green,
  },
  closeBtnWrapper: {
    position: 'relative',
  },
  closeBtnMarginTop: {
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
