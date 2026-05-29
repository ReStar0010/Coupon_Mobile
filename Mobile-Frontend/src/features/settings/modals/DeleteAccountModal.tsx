import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import BottomSheet from '@/src/components/ui/BottomSheet';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import { deleteAccount } from '@/src/services/api/profile';
import { useAuth } from '@/src/state/AuthContext';

type DeleteStep = null | 'confirm' | 'done';

interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
  testID?: string;
}

export default function DeleteAccountModal({
  visible,
  onClose,
  testID,
}: DeleteAccountModalProps): React.JSX.Element {
  const [step, setStep] = useState<DeleteStep>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { logout } = useAuth();
  const router = useRouter();

  function resetState(): void {
    setStep(null);
    setPassword('');
    setError(null);
    setBusy(false);
  }

  function handleClose() {
    resetState();
    onClose();
  }

  async function handleConfirm(): Promise<void> {
    if (busy) return;
    if (!password.trim()) {
      setError('請輸入密碼以確認刪除');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(password, ['DATA_LOSS']);
      setStep('done');
      await logout();
      router.replace('/(auth)/login' as never);
    } catch (err) {
      setError((err as Error).message || '刪除失敗，請確認密碼是否正確');
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={handleClose}>
      <View testID={testID ?? 'delete-modal'} style={styles.sheet}>
          <View style={styles.accentStrip} />
          <View style={styles.dragHandle} />
          <Text style={styles.title}>刪除帳號</Text>
          <Text style={styles.subtitle}>這個動作無法撤銷。所有資料將永久消失。</Text>

          {step === 'confirm' && (
            <View testID="confirm-warning-box" style={styles.warningBox}>
              <Text style={styles.warningTitle}>⚠ 最後確認</Text>
              <Text style={styles.warningBody}>
                所有優惠券、寶石和 CouPoints 將無法恢復
              </Text>
              <Text style={styles.passwordLabel}>輸入密碼以確認</Text>
              <TextInput
                testID="delete-password-input"
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="密碼"
                placeholderTextColor={colors.muted}
                secureTextEntry
                autoCapitalize="none"
              />
              {error ? (
                <Text testID="delete-error" style={styles.errorText}>{error}</Text>
              ) : null}
              <View style={styles.confirmRow}>
                <View style={styles.halfWrapper}>
                  <View style={styles.halfShadow} />
                  <Pressable
                    style={styles.cancelBtn}
                    onPress={() => { resetState(); }}
                  >
                    <Text style={styles.cancelText}>取消</Text>
                  </Pressable>
                </View>
                <View style={styles.halfWrapper}>
                  <View style={[styles.halfShadow, { backgroundColor: colors.border }]} />
                  <Pressable
                    testID="btn-confirm-delete"
                    style={styles.confirmDeleteBtn}
                    onPress={() => { void handleConfirm(); }}
                  >
                    <Text style={styles.confirmDeleteText}>
                      {busy ? '刪除中…' : '確認刪除'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {step === 'done' && (
            <View testID="done-message" style={styles.doneBox}>
              <Text style={styles.doneEmoji}>👋</Text>
              <Text style={styles.doneTitle}>帳號已刪除</Text>
              <Text style={styles.doneSub}>感謝使用 CouPro，掰掰！</Text>
            </View>
          )}

          {step === null && (
            <View style={styles.deleteBtnWrapper}>
              <View style={styles.deleteBtnShadow} />
              <Pressable
                testID="btn-initial-delete"
                style={styles.deleteBtn}
                onPress={() => setStep('confirm')}
              >
                <Text style={styles.deleteBtnText}>我確定要刪除帳號</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.closeBtnWrapper}>
            <View style={styles.closeBtnShadow} />
            <Pressable style={styles.closeBtn} onPress={handleClose}>
              <Text style={styles.closeBtnText}>取消</Text>
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
    borderColor: colors.red,
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
    color: colors.red,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: colors.muted,
    marginBottom: 18,
  },
  warningBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 2,
    borderColor: colors.red,
    borderRadius: 6,
    padding: 12,
    marginBottom: 14,
  },
  warningTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: colors.red,
  },
  warningBody: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    color: colors.muted,
    marginTop: 3,
    marginBottom: 10,
  },
  passwordLabel: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    color: colors.red,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  passwordInput: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    color: colors.fg,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  errorText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 12,
    color: colors.red,
    marginBottom: 8,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  halfWrapper: {
    flex: 1,
    position: 'relative',
  },
  halfShadow: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: '100%',
    height: '100%',
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  cancelBtn: {
    paddingVertical: 11,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 5,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: colors.fg,
  },
  confirmDeleteBtn: {
    paddingVertical: 11,
    backgroundColor: colors.red,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 5,
    alignItems: 'center',
  },
  confirmDeleteText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: '#fff',
  },
  doneBox: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingBottom: 24,
  },
  doneEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  doneTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    color: colors.fg,
  },
  doneSub: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
  },
  deleteBtnWrapper: {
    position: 'relative',
    marginBottom: 10,
  },
  deleteBtnShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: '100%',
    height: '100%',
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  deleteBtn: {
    backgroundColor: colors.red,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteBtnText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
    color: '#fff',
  },
  closeBtnWrapper: {
    position: 'relative',
    marginTop: 4,
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
