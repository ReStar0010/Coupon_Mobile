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
import { useAuth } from '@/src/state/AuthContext';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import NeoButton from '@/src/components/ui/NeoButton';
import LogoIcon from '@/src/components/icons/LogoIcon';
import { normalizeTwPhone, sendRegistrationOtp } from '@/src/services/api/auth';

// Lowest-friction registration: any non-empty password is accepted. The
// phone-OTP backend never enforced a length (create_user skips Django's
// password validators), so this only aligns the UI with existing BE behavior.
// Kept as a named constant so the non-empty guards below still read clearly.
const MIN_PASSWORD_LENGTH = 1;
const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

type Step = 'collect' | 'verify';

export default function RegisterScreen() {
  const router = useRouter();
  const { registerWithPhone } = useAuth();
  const [step, setStep] = useState<Step>('collect');
  const [phone, setPhone] = useState('');
  // Phone is normalized once at the end of step 1 and stored separately so
  // step 2 doesn't have to re-validate or worry about the user editing the
  // visible field after the OTP was sent.
  const [normalizedPhone, setNormalizedPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  // Synchronous guard for in-flight network calls. React state updates are
  // batched and don't help against a fast double-tap that fires two handlers
  // before the first re-render lands. A ref reads/writes synchronously, so
  // the second tap sees `true` and returns immediately.
  const submittingRef = useRef(false);

  // Resend-cooldown ticker. Drives the "重新傳送 (Ns)" label and re-enables
  // the resend link when it hits zero.
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
    if (!phone.trim() || password.length < MIN_PASSWORD_LENGTH) return;
    submittingRef.current = true;
    setError('');
    setSending(true);
    try {
      const norm = normalizeTwPhone(phone);
      // No pre-flight phone existence check — that was an account
      // enumeration vector. send-otp will fail with a clear BE message if
      // the phone is already registered, and we surface that as-is.
      await sendRegistrationOtp(norm);
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
      await sendRegistrationOtp(normalizedPhone);
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (e) {
      setError(messageFromError(e, '無法重新傳送驗證碼'));
    } finally {
      submittingRef.current = false;
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (submittingRef.current) return;
    if (otp.length !== OTP_LENGTH) return;
    submittingRef.current = true;
    setError('');
    setVerifying(true);
    try {
      await registerWithPhone(normalizedPhone, otp, password);
      router.replace('/(tabs)/home');
    } catch (e) {
      setError(messageFromError(e, '驗證失敗，請確認驗證碼是否正確'));
    } finally {
      submittingRef.current = false;
      setVerifying(false);
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
              <Text style={styles.title}>建立帳號</Text>

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

              <Text style={styles.label}>密碼</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="請輸入密碼"
                testID="password-input"
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <NeoButton
                label={sending ? '傳送中…' : '傳送驗證碼'}
                onPress={handleSendOtp}
                disabled={
                  sending ||
                  !phone.trim() ||
                  password.length < MIN_PASSWORD_LENGTH
                }
                fullWidth
                style={styles.btn}
              />

              <Pressable onPress={() => router.back()} style={styles.link}>
                <Text style={styles.linkText}>已有帳號？返回登入</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>輸入驗證碼</Text>
              <Text style={styles.sub}>已傳送至 {normalizedPhone}</Text>

              <TextInput
                style={styles.otpInput}
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                keyboardType="number-pad"
                placeholder="6 位數驗證碼"
                maxLength={OTP_LENGTH}
                testID="otp-input"
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <NeoButton
                label={verifying ? '建立中…' : '建立帳號'}
                onPress={handleVerify}
                disabled={verifying || sending || otp.length !== OTP_LENGTH}
                fullWidth
                style={styles.btn}
              />

              <Pressable
                onPress={handleResend}
                style={styles.link}
                disabled={resendIn > 0 || sending || verifying}
              >
                <Text
                  style={[
                    styles.linkText,
                    (resendIn > 0 || sending || verifying) && styles.linkDisabled,
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
                }}
                style={styles.link}
              >
                <Text style={styles.linkText}>修改手機號碼</Text>
              </Pressable>
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
