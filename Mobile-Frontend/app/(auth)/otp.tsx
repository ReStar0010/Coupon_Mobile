import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/src/state/AuthContext';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import NeoButton from '@/src/components/ui/NeoButton';

export default function OtpScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { loginWithOtp } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (code.length !== 6 || !phone) return;
    setError('');
    setLoading(true);
    try {
      await loginWithOtp(phone, code);
      router.replace('/(tabs)/home');
    } catch {
      setError('驗證碼錯誤，請重試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>輸入驗證碼</Text>
        <Text style={styles.sub}>已傳送至 {phone}</Text>

        <TextInput
          style={styles.input}
          value={code}
          onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          placeholder="6 位數驗證碼"
          maxLength={6}
          testID="otp-input"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <NeoButton
          label={loading ? '驗證中…' : '驗證'}
          onPress={handleVerify}
          disabled={loading || code.length !== 6}
          fullWidth
          style={styles.btn}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center' },
  inner: { padding: spacing.lg },
  title: { fontFamily: 'SpaceGrotesk_800ExtraBold', fontSize: 26, color: colors.fg, marginBottom: spacing.xs },
  sub: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 14, color: colors.muted, marginBottom: spacing.lg },
  input: {
    borderWidth: 3, borderColor: colors.border, borderRadius: 8, padding: 16,
    fontSize: 28, fontFamily: 'JetBrainsMono_600SemiBold', color: colors.fg,
    backgroundColor: colors.card, textAlign: 'center', letterSpacing: 8,
    shadowColor: colors.border, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0,
  },
  error: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 13, color: colors.red, marginTop: spacing.sm },
  btn: { marginTop: spacing.md },
});
