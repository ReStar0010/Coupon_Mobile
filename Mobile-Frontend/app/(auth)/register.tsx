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
import * as authService from '@/src/services/api/auth';

export default function RegisterScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email.trim() || !password) return;
    setError('');
    setLoading(true);
    try {
      await authService.register({ email: email.trim(), password, phone: phone.trim() || undefined });
      await login(email.trim(), '', password);
      router.replace('/(tabs)/home');
    } catch {
      setError('註冊失敗，請確認填寫資訊');
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
          <Text style={styles.title}>建立帳號</Text>

          <Text style={styles.label}>電子信箱</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="your@email.com"
            testID="email-input"
          />

          <Text style={styles.label}>密碼</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="至少 8 個字元"
            testID="password-input"
          />

          <Text style={styles.label}>手機號碼（選填）</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="+886 9xx-xxx-xxx"
            testID="phone-input"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <NeoButton
            label={loading ? '建立中…' : '建立帳號'}
            onPress={handleRegister}
            disabled={loading || !email.trim() || !password}
            fullWidth
            style={styles.btn}
          />

          <Pressable onPress={() => router.back()} style={styles.link}>
            <Text style={styles.linkText}>已有帳號？返回登入</Text>
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
  brand: { fontFamily: 'SpaceGrotesk_800ExtraBold', fontSize: 28, color: '#fff' },
  card: {
    backgroundColor: colors.bg, borderWidth: 3, borderColor: colors.border,
    borderRadius: 12, padding: spacing.lg,
    shadowColor: colors.yellow, shadowOffset: { width: 6, height: 6 }, shadowOpacity: 1, shadowRadius: 0,
    elevation: 8,
  },
  title: { fontFamily: 'SpaceGrotesk_800ExtraBold', fontSize: 24, color: colors.fg, marginBottom: spacing.md },
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
