import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import NeoButton from '@/src/components/ui/NeoButton';
import LogoIcon from '@/src/components/icons/LogoIcon';
import {
  normalizeTwPhone,
  sendPasswordResetOtp,
  resetPasswordWithOtp,
} from '@/src/services/api/auth';
import { phoneResetSchema, resetFieldErrorsFrom } from '@/src/features/auth/schemas';

const MIN_PASSWORD_LENGTH = 8;
const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

type Step = 'collect' | 'verify' | 'done';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('collect');
  const [phone, setPhone] = useState('');
  // Phone is normalized once when the OTP is requested and stored separately so
  // step 2 doesn't re-validate or worry about the visible field being edited.
  const [normalizedPhone, setNormalizedPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  // Synchronous in-flight guard against fast double-taps (see register.tsx).
  const submittingRef = useRef(false);

  // Resend-cooldown ticker — drives the "重新傳送 (Ns)" label.
  useEffect(() => {
    if (resendIn <= 0) return;
    const handle = setInterval(() => {
      setResendIn((n) => (n > 0 ? n - 1 : 0));
    }, 1000);
    return () => clearInterval(handle);
  }, [resendIn]);

  const messageFromError = (e: unknown, fallback: string): string =>
    e instanceof Error && e.message ? e.message : fallback;

  const handleSendOtp = async () => {
    if (submittingRef.current) return;
    if (!phone.trim()) return;
    submittingRef.current = true;
    setError('');
    setSending(true);
    try {
      // Validate phone format client-side for a clear message; normalizeTwPhone
      // throws an ApiRequestError with a friendly zh-TW string on bad input.
      const norm = normalizeTwPhone(phone);
      // BE is enumeration-safe: identical 200 whether or not the phone exists.
      await sendPasswordResetOtp(norm);
      setNormalizedPhone(norm);
      setOtp('');
      setStep('verify');
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (e) {
      setError(messageFromError(e, '無法傳送驗證碼，請稍後再試'));
    } finally {
      submittingRef.current = false;
      setSending(false);
    }
  };

  const handleResend = async () => {
    if (submittingRef.current || resendIn > 0) return;
    submittingRef.current = true;
    setError('');
    setSending(true);
    try {
      await sendPasswordResetOtp(normalizedPhone);
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (e) {
      setError(messageFromError(e, '無法重新傳送驗證碼'));
    } finally {
      submittingRef.current = false;
      setSending(false);
    }
  };

  const handleReset = async () => {
    if (submittingRef.current) return;
    // Single source of truth for "valid reset input" — the Zod schema.
    const parsed = phoneResetSchema.safeParse({
      phone: normalizedPhone,
      otp,
      newPassword,
    });
    setError('');
    if (!parsed.success) {
      const fields = resetFieldErrorsFrom(parsed.error);
      setError(fields.otp ?? fields.newPassword ?? fields.phone ?? '請檢查輸入內容');
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await resetPasswordWithOtp(
        parsed.data.phone,
        parsed.data.otp,
        parsed.data.newPassword,
      );
      setStep('done');
    } catch (e) {
      setError(messageFromError(e, '重設失敗，請確認驗證碼是否正確'));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoRow}>
          <View style={styles.logoBox}>
            <LogoIcon size={32} />
          </View>
          <Text style={styles.brand}>CouPro</Text>
        </View>

        <View style={styles.card}>
          {step === 'collect' ? (
            <>
              <Text style={styles.title}>重設密碼</Text>
              <Text style={styles.sub}>輸入註冊時使用的手機號碼，我們將傳送驗證碼。</Text>

              <Text style={styles.label}>手機號碼</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                autoCapitalize="none"
                keyboardType="phone-pad"
                placeholder="0912-345-678"
                testID="phone-input"
              />

              {error ? (
                <Text testID="form-error" style={styles.error}>
                  {error}
                </Text>
              ) : null}

              <NeoButton
                label={sending ? '傳送中…' : '傳送驗證碼'}
                onPress={handleSendOtp}
                disabled={sending || !phone.trim()}
                fullWidth
                style={styles.btn}
              />

              <Pressable onPress={() => router.back()} style={styles.link}>
                <Text style={styles.linkText}>返回登入</Text>
              </Pressable>
            </>
          ) : step === 'verify' ? (
            <>
              <Text style={styles.title}>輸入驗證碼</Text>
              <Text style={styles.sub}>若此號碼已註冊，驗證碼已傳送至 {normalizedPhone}</Text>

              <TextInput
                style={styles.otpInput}
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                keyboardType="number-pad"
                placeholder="6 位數驗證碼"
                maxLength={OTP_LENGTH}
                testID="otp-input"
              />

              <Text style={styles.label}>新密碼</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholder="至少 8 個字元"
                testID="new-password-input"
              />

              {error ? (
                <Text testID="form-error" style={styles.error}>
                  {error}
                </Text>
              ) : null}

              <NeoButton
                label={submitting ? '重設中…' : '重設密碼'}
                onPress={handleReset}
                disabled={
                  submitting ||
                  sending ||
                  otp.length !== OTP_LENGTH ||
                  newPassword.length < MIN_PASSWORD_LENGTH
                }
                fullWidth
                style={styles.btn}
              />

              <Pressable
                onPress={handleResend}
                style={styles.link}
                disabled={resendIn > 0 || sending || submitting}
              >
                <Text
                  style={[
                    styles.linkText,
                    (resendIn > 0 || sending || submitting) && styles.linkDisabled,
                  ]}
                >
                  {resendIn > 0 ? `重新傳送 (${resendIn}s)` : '重新傳送驗證碼'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setStep('collect');
                  setError('');
                  setOtp('');
                  setNewPassword('');
                }}
                style={styles.link}
              >
                <Text style={styles.linkText}>修改手機號碼</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>密碼已重設</Text>
              <Text style={styles.sub}>請使用新密碼登入。</Text>

              <NeoButton
                label="前往登入"
                onPress={() => router.replace('/(auth)/login')}
                fullWidth
                style={styles.btn}
              />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.xl, justifyContent: 'center' },
  logoBox: {
    width: 48, height: 48, backgroundColor: colors.yellow,
    borderWidth: 2.5, borderColor: colors.border, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  brand: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 28, color: '#fff' },
  card: {
    backgroundColor: colors.bg, borderWidth: 3, borderColor: colors.border,
    borderRadius: 12, padding: spacing.lg,
    shadowColor: colors.yellow, shadowOffset: { width: 6, height: 6 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 8,
  },
  title: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, color: colors.fg, marginBottom: spacing.md },
  sub: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 14, color: colors.muted, marginBottom: spacing.md },
  label: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 12, color: colors.muted, marginBottom: 5, marginTop: spacing.sm, letterSpacing: 0.5, textTransform: 'uppercase' },
  input: {
    borderWidth: 2, borderColor: colors.border, borderRadius: 6,
    padding: 12, fontSize: 15, fontFamily: 'SpaceGrotesk_400Regular', color: colors.fg,
    backgroundColor: colors.card,
    shadowColor: colors.border, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0,
  },
  otpInput: {
    borderWidth: 3, borderColor: colors.border, borderRadius: 8, padding: 16,
    fontSize: 28, fontFamily: 'JetBrainsMono_600SemiBold', color: colors.fg,
    backgroundColor: colors.card, textAlign: 'center', letterSpacing: 8,
    shadowColor: colors.border, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0,
  },
  error: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 12, color: colors.red, marginTop: spacing.sm },
  btn: { marginTop: spacing.md },
  link: { marginTop: spacing.md, alignItems: 'center' },
  linkText: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: colors.purple },
  linkDisabled: { opacity: 0.4 },
});
