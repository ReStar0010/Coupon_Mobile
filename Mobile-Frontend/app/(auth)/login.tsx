import React, { useState } from 'react';
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
import { loginSchema, fieldErrorsFrom } from '@/src/features/auth/schemas';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    // Single source of truth for "what counts as a valid login input"
    // — the Zod schema. Per-field issues drive inline UI; anything
    // server-side comes back as `formError`.
    const parsed = loginSchema.safeParse({ phone, password });
    setPhoneError(null);
    setPasswordError(null);
    setFormError('');
    if (!parsed.success) {
      const fields = fieldErrorsFrom(parsed.error);
      setPhoneError(fields.phone ?? null);
      setPasswordError(fields.password ?? null);
      return;
    }
    setLoading(true);
    try {
      await login(undefined, parsed.data.phone, parsed.data.password);
      router.replace('/(tabs)/home');
    } catch (e) {
      const message =
        e instanceof Error && e.message ? e.message : '登入失敗，請確認手機號碼與密碼';
      setFormError(message);
    } finally {
      setLoading(false);
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
          <Text style={styles.title}>登入</Text>

          <Text style={styles.label}>手機號碼</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={(v) => {
              setPhone(v);
              if (phoneError) setPhoneError(null);
            }}
            autoCapitalize="none"
            keyboardType="phone-pad"
            placeholder="0912-345-678"
            testID="phone-input"
          />
          {phoneError ? (
            <Text testID="phone-error" style={styles.error}>
              {phoneError}
            </Text>
          ) : null}

          <Text style={styles.label}>密碼</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (passwordError) setPasswordError(null);
            }}
            secureTextEntry
            placeholder="••••••••"
            testID="password-input"
          />
          {passwordError ? (
            <Text testID="password-error" style={styles.error}>
              {passwordError}
            </Text>
          ) : null}

          {formError ? (
            <Text testID="form-error" style={styles.error}>
              {formError}
            </Text>
          ) : null}

          <NeoButton
            label={loading ? '登入中…' : '登入'}
            onPress={handleLogin}
            disabled={loading || !phone.trim() || !password}
            fullWidth
            style={styles.btn}
          />

          <Pressable onPress={() => router.push('/(auth)/register')} style={styles.link}>
            <Text style={styles.linkText}>還沒有帳號？立即註冊</Text>
          </Pressable>
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
  label: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 12, color: colors.muted, marginBottom: 5, marginTop: spacing.sm, letterSpacing: 0.5, textTransform: 'uppercase' },
  input: {
    borderWidth: 2, borderColor: colors.border, borderRadius: 6,
    padding: 12, fontSize: 15, fontFamily: 'SpaceGrotesk_400Regular', color: colors.fg,
    backgroundColor: colors.card,
    shadowColor: colors.border, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0,
  },
  error: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 12, color: colors.red, marginTop: spacing.sm },
  btn: { marginTop: spacing.md },
  link: { marginTop: spacing.md, alignItems: 'center' },
  linkText: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: colors.purple },
});
