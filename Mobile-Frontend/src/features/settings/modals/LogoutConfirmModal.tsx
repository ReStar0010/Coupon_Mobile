import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import BottomSheet from '@/src/components/ui/BottomSheet';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import { useAuth } from '@/src/state/AuthContext';

interface LogoutConfirmModalProps {
  visible: boolean;
  onLogout: () => void;
  onClose: () => void;
}

export default function LogoutConfirmModal({
  visible,
  onLogout,
  onClose,
}: LogoutConfirmModalProps): React.JSX.Element {
  const { logout } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleConfirm(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await logout();
      router.replace('/(auth)/login' as never);
      onLogout();
    } catch (err) {
      setError((err as Error).message || '登出失敗');
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View testID="logout-modal" style={styles.sheet}>
        <View style={styles.accentStrip} />
        <View style={styles.dragHandle} />
        <Text style={styles.title}>登出帳號</Text>
        <Text style={styles.subtitle}>
          確定要登出嗎？下次登入還需要驗證身份。
        </Text>
        {error ? (
          <Text testID="logout-error" style={styles.errorText}>{error}</Text>
        ) : null}
        <View style={styles.row}>
          <View style={styles.btnWrapper}>
            <View style={[styles.btnShadow, { backgroundColor: colors.border }]} />
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>取消</Text>
            </Pressable>
          </View>
          <View style={styles.btnWrapper}>
            <View style={[styles.btnShadow, { backgroundColor: colors.border }]} />
            <Pressable style={styles.logoutBtn} onPress={() => { void handleConfirm(); }}>
              <Text style={styles.logoutText}>{busy ? '登出中…' : '確定登出'}</Text>
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
    paddingBottom: 32,
    overflow: 'hidden',
  },
  accentStrip: {
    height: 6,
    backgroundColor: colors.red,
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
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    color: colors.muted,
    marginBottom: 22,
  },
  errorText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 12,
    color: colors.red,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  btnWrapper: {
    flex: 1,
    position: 'relative',
  },
  btnShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  cancelBtn: {
    paddingVertical: 13,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    color: colors.fg,
  },
  logoutBtn: {
    paddingVertical: 13,
    backgroundColor: colors.red,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 6,
    alignItems: 'center',
  },
  logoutText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 14,
    color: '#fff',
  },
});
