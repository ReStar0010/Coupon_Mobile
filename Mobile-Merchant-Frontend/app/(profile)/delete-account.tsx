import React, { useState, useEffect } from 'react';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { Button } from '@/components/ui';
import { StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { accountDeletionAPI, type PreDeleteCheckResponse, type DeletionWarning } from '@/utils/api';
import { logout } from '@/utils/api';

type DeletionStep = 'loading' | 'warnings' | 'password' | 'confirm' | 'processing' | 'success';

export default function DeleteAccountScreen() {
  const router = useRouter();
  
  const [step, setStep] = useState<DeletionStep>('loading');
  const [warnings, setWarnings] = useState<DeletionWarning[]>([]);
  const [dataSummary, setDataSummary] = useState<PreDeleteCheckResponse['data_summary'] | null>(null);
  const [acknowledgedWarnings, setAcknowledgedWarnings] = useState<Set<string>>(new Set());
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadPreDeleteCheck();
  }, []);

  const loadPreDeleteCheck = async () => {
    try {
      setStep('loading');
      const data = await accountDeletionAPI.preDeleteCheck();
      setWarnings(data.warnings);
      setDataSummary(data.data_summary);
      setStep('warnings');
    } catch (error: any) {
      console.error('Failed to load pre-delete check:', error);
      Alert.alert('錯誤', error?.message || '載入失敗,請稍後再試');
      router.back();
    }
  };

  const toggleAcknowledgment = (code: string) => {
    const newAcknowledged = new Set(acknowledgedWarnings);
    if (newAcknowledged.has(code)) {
      newAcknowledged.delete(code);
    } else {
      newAcknowledged.add(code);
    }
    setAcknowledgedWarnings(newAcknowledged);
  };

  const handleContinueFromWarnings = () => {
    // Check that all critical and warning severity warnings are acknowledged
    const requiredAcknowledgments = warnings.filter(
      w => w.severity === 'critical' || w.severity === 'warning'
    );
    
    const allAcknowledged = requiredAcknowledgments.every(
      w => acknowledgedWarnings.has(w.code)
    );

    if (!allAcknowledged) {
      setError('請確認您已閱讀並理解所有警告');
      return;
    }

    setError('');
    setStep('password');
  };

  const handleContinueFromPassword = () => {
    if (!password.trim()) {
      setError('請輸入密碼');
      return;
    }
    setError('');
    setStep('confirm');
  };

  const handleConfirmDeletion = async () => {
    try {
      setIsProcessing(true);
      setError('');

      await accountDeletionAPI.deleteAccount({
        password,
        acknowledgments: Array.from(acknowledgedWarnings),
      });

      setStep('success');
      
      // Logout and redirect after showing success message
      setTimeout(async () => {
        try {
          await logout();
        } catch (e) {
          // Ignore logout errors, user is already deleted
        }
        router.replace('/(auth)/login');
      }, 2000);

    } catch (error: any) {
      setIsProcessing(false);
      console.error('Account deletion failed:', error);
      
      // Check for specific error codes
      if (error?.message?.includes('密碼錯誤') || error?.code === 'INVALID_PASSWORD') {
        setError('密碼錯誤,請重新輸入');
        setStep('password');
        setPassword('');
      } else {
        setError(error?.message || '刪除失敗,請稍後再試');
      }
    }
  };

  const renderWarningsStep = () => (
    <>
      <Text style={styles.title}>刪除帳號</Text>
      <Text style={styles.subtitle}>刪除前請先了解以下資訊</Text>

      <YStack gap="$3" marginTop="$4">
        {dataSummary && (
          <YStack style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>您的資料摘要</Text>
            <XStack justifyContent="space-between" marginTop="$2">
              <Text style={styles.summaryLabel}>商店數量</Text>
              <Text style={styles.summaryValue}>{dataSummary.stores_count}</Text>
            </XStack>
            <XStack justifyContent="space-between" marginTop="$2">
              <Text style={styles.summaryLabel}>有效優惠券</Text>
              <Text style={styles.summaryValue}>{dataSummary.active_coupons_count}</Text>
            </XStack>
            <XStack justifyContent="space-between" marginTop="$2">
              <Text style={styles.summaryLabel}>累計兌換次數</Text>
              <Text style={styles.summaryValue}>{dataSummary.total_redemptions}</Text>
            </XStack>
          </YStack>
        )}

        {warnings.map((warning) => (
          <TouchableOpacity
            key={warning.code}
            onPress={() => toggleAcknowledgment(warning.code)}
            activeOpacity={0.7}
            style={[
              styles.warningCard,
              warning.severity === 'critical' && styles.warningCardCritical,
            ]}
          >
            <XStack alignItems="flex-start" gap="$3">
              <MaterialIcons
                name={acknowledgedWarnings.has(warning.code) ? 'check-box' : 'check-box-outline-blank'}
                size={24}
                color={warning.severity === 'critical' ? '#EF4444' : colors.textSecondary}
              />
              <YStack flex={1}>
                <Text style={[
                  styles.warningText,
                  warning.severity === 'critical' && styles.warningTextCritical,
                ]}>
                  {warning.message}
                </Text>
              </YStack>
            </XStack>
          </TouchableOpacity>
        ))}

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        <Button
          variant="primary"
          fullWidth
          onPress={handleContinueFromWarnings}
          marginTop="$2"
          backgroundColor="#EF4444"
        >
          繼續刪除
        </Button>

        <Button
          variant="outline"
          fullWidth
          onPress={() => router.back()}
        >
          取消
        </Button>
      </YStack>
    </>
  );

  const renderPasswordStep = () => (
    <>
      <Text style={styles.title}>驗證密碼</Text>
      <Text style={styles.subtitle}>為了安全起見,請輸入您的帳號密碼</Text>

      <YStack gap="$3" marginTop="$4">
        <YStack gap="$2">
          <Text style={styles.label}>密碼</Text>
          <TextInput
            style={styles.passwordInput}
            value={password}
            onChangeText={setPassword}
            placeholder="請輸入密碼"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            autoFocus
          />
        </YStack>

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        <Button
          variant="primary"
          fullWidth
          onPress={handleContinueFromPassword}
          marginTop="$2"
          backgroundColor="#EF4444"
        >
          確認
        </Button>

        <Button
          variant="outline"
          fullWidth
          onPress={() => setStep('warnings')}
        >
          返回
        </Button>
      </YStack>
    </>
  );

  const renderConfirmStep = () => (
    <>
      <Text style={styles.title}>最後確認</Text>
      <Text style={styles.subtitle}>此操作無法復原,請確認您要刪除帳號</Text>

      <YStack style={styles.confirmCard} marginTop="$4">
        <MaterialIcons name="warning" size={48} color="#EF4444" style={{ alignSelf: 'center' }} />
        <Text style={styles.confirmText}>
          刪除帳號後:
        </Text>
        <Text style={styles.confirmBullet}>• 您的個人資料將永久刪除</Text>
        <Text style={styles.confirmBullet}>• 您的商店資訊將被匿名化</Text>
        <Text style={styles.confirmBullet}>• 現有的優惠券仍可被顧客使用</Text>
        <Text style={styles.confirmBullet}>• 您可以使用相同的 email 重新註冊</Text>
      </YStack>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}

      <YStack gap="$3" marginTop="$4">
        <Button
          variant="primary"
          fullWidth
          onPress={handleConfirmDeletion}
          disabled={isProcessing}
          backgroundColor="#EF4444"
          opacity={isProcessing ? 0.6 : 1}
        >
          {isProcessing ? '刪除中...' : '確定刪除帳號'}
        </Button>

        <Button
          variant="outline"
          fullWidth
          onPress={() => setStep('password')}
          disabled={isProcessing}
        >
          取消
        </Button>
      </YStack>
    </>
  );

  const renderSuccessStep = () => (
    <YStack alignItems="center" justifyContent="center" flex={1} padding="$4">
      <MaterialIcons name="check-circle" size={80} color="#4ADE80" />
      <Text style={styles.successTitle}>帳號已成功刪除</Text>
      <Text style={styles.successSubtitle}>感謝您使用 CouPro</Text>
      <Text style={styles.successNote}>正在登出...</Text>
    </YStack>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <YStack flex={1} backgroundColor={colors.background}>
        {/* Header */}
        {step !== 'success' && step !== 'loading' && (
          <XStack
            paddingHorizontal="$4"
            paddingVertical="$3"
            backgroundColor={colors.white}
            alignItems="center"
            borderBottomWidth={1}
            borderBottomColor={colors.border}
          >
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <MaterialIcons name="chevron-left" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>刪除帳號</Text>
          </XStack>
        )}

        {/* Content */}
        <ScrollView
          contentContainerStyle={{ padding: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {step === 'loading' && (
            <YStack alignItems="center" justifyContent="center" padding="$8">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>載入中...</Text>
            </YStack>
          )}

          {step === 'warnings' && renderWarningsStep()}
          {step === 'password' && renderPasswordStep()}
          {step === 'confirm' && renderConfirmStep()}
          {step === 'processing' && (
            <YStack alignItems="center" justifyContent="center" padding="$8">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>刪除中...</Text>
            </YStack>
          )}
          {step === 'success' && renderSuccessStep()}
        </ScrollView>
      </YStack>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginLeft: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  warningCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  warningCardCritical: {
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  warningText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  warningTextCritical: {
    color: '#991B1B',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  passwordInput: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 16,
    color: colors.textPrimary,
  },
  confirmCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#991B1B',
    marginTop: 16,
    marginBottom: 8,
  },
  confirmBullet: {
    fontSize: 14,
    color: '#991B1B',
    marginTop: 4,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    marginTop: 8,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 24,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  successNote: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
});

