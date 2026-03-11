import React, { useState, useEffect, useCallback } from 'react';
import { Alert, ActivityIndicator, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { YStack, XStack, Text, H4, ScrollView, Card } from 'tamagui';
import { ChevronLeft, AlertTriangle, Trash2, CheckSquare, Square } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchAPI, logout } from '@/app/utils/authAPI';

interface DeletionWarning {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

interface PreDeleteCheckResponse {
  can_delete: boolean;
  warnings: DeletionWarning[];
  data_summary: {
    held_coupons_count: number;
    total_redemptions: number;
  };
}

type DeletionStep = 'loading' | 'warnings' | 'password' | 'confirm' | 'processing' | 'success';

const DeleteAccount: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<DeletionStep>('loading');
  const [warnings, setWarnings] = useState<DeletionWarning[]>([]);
  const [dataSummary, setDataSummary] = useState<PreDeleteCheckResponse['data_summary'] | null>(
    null,
  );
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
      const response = await fetchAPI('/account/pre-delete-check/', { method: 'GET' });
      const data = response.data as PreDeleteCheckResponse;
      setWarnings(data.warnings);
      setDataSummary(data.data_summary);
      setStep('warnings');
    } catch (err: any) {
      console.error('Failed to load pre-delete check:', err);
      Alert.alert('錯誤', '載入失敗，請稍後再試');
      router.back();
    }
  };

  const toggleAcknowledgment = useCallback((code: string) => {
    setAcknowledgedWarnings((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }, []);

  const handleContinueFromWarnings = () => {
    const required = warnings.filter((w) => w.severity === 'critical' || w.severity === 'warning');
    const allAcknowledged = required.every((w) => acknowledgedWarnings.has(w.code));

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

      await fetchAPI('/account/delete/', {
        method: 'POST',
        data: {
          password,
          acknowledgments: Array.from(acknowledgedWarnings),
        },
      });

      setStep('success');

      setTimeout(async () => {
        try {
          await logout();
        } catch {
          // User already deleted, ignore
        }
      }, 2000);
    } catch (err: any) {
      setIsProcessing(false);
      console.error('Account deletion failed:', err);

      const errMsg = err?.response?.data?.error || err?.message || '';
      if (errMsg.includes('密碼錯誤') || err?.response?.data?.code === 'INVALID_PASSWORD') {
        setError('密碼錯誤，請重新輸入');
        setStep('password');
        setPassword('');
      } else {
        setError(errMsg || '刪除失敗，請稍後再試');
      }
    }
  };

  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  // --- Loading ---
  if (step === 'loading') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <YStack flex={1} items="center" justify="center" style={{ paddingTop: insets.top }}>
          <ActivityIndicator size="large" color="#FFAD31" />
          <Text mt="$4" color="gray">
            載入中...
          </Text>
        </YStack>
      </>
    );
  }

  // --- Success ---
  if (step === 'success') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <YStack flex={1} items="center" justify="center" px="$4" style={{ paddingTop: insets.top }}>
          <Trash2 size={64} color="#4ADE80" />
          <H4 fontWeight="bold" mt="$4">
            帳號已成功刪除
          </H4>
          <Text color="gray" mt="$2">
            感謝您使用 CouPro
          </Text>
          <Text color="gray" mt="$4" fontSize={14}>
            正在登出...
          </Text>
        </YStack>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <YStack flex={1} style={{ paddingTop: insets.top + 10 }}>
        {/* Header */}
        <XStack gap={13} items="center" px="$4" pb="$3">
          <ChevronLeft size={24} onPress={handleGoBack} color="black" />
          <H4 fontWeight="bold">刪除帳號</H4>
        </XStack>

        <ScrollView flex={1} px="$4" contentContainerStyle={{ paddingBottom: 40 }}>
          {/* --- Warnings Step --- */}
          {step === 'warnings' && (
            <YStack gap="$3">
              <Text fontSize={14} color="gray">
                刪除前請先了解以下資訊
              </Text>

              {/* Data summary */}
              {dataSummary && (
                <Card bordered p="$4" bg="white">
                  <Text fontWeight="600" fontSize={16} mb="$2">
                    您的資料摘要
                  </Text>
                  <XStack justify="space-between" mt="$2">
                    <Text color="gray" fontSize={14}>
                      持有優惠券
                    </Text>
                    <Text fontWeight="600" fontSize={14}>
                      {dataSummary.held_coupons_count}
                    </Text>
                  </XStack>
                  <XStack justify="space-between" mt="$2">
                    <Text color="gray" fontSize={14}>
                      累計兌換次數
                    </Text>
                    <Text fontWeight="600" fontSize={14}>
                      {dataSummary.total_redemptions}
                    </Text>
                  </XStack>
                </Card>
              )}

              {/* Warning cards with checkboxes */}
              {warnings.map((warning) => {
                const isChecked = acknowledgedWarnings.has(warning.code);
                const isCritical = warning.severity === 'critical';
                return (
                  <TouchableOpacity
                    key={warning.code}
                    onPress={() => toggleAcknowledgment(warning.code)}
                    activeOpacity={0.7}
                  >
                    <Card
                      bordered
                      p="$4"
                      bg={isCritical ? '#FEF2F2' : 'white'}
                      borderColor={isCritical ? '#FEE2E2' : '$borderColor'}
                    >
                      <XStack gap="$3" items="flex-start">
                        {isChecked ? (
                          <CheckSquare size={22} color={isCritical ? '#EF4444' : '#FFAD31'} />
                        ) : (
                          <Square size={22} color={isCritical ? '#EF4444' : 'gray'} />
                        )}
                        <Text
                          flex={1}
                          fontSize={14}
                          lineHeight={20}
                          color={isCritical ? '#991B1B' : 'black'}
                        >
                          {warning.message}
                        </Text>
                      </XStack>
                    </Card>
                  </TouchableOpacity>
                );
              })}

              {error ? (
                <Text color="#EF4444" fontSize={14}>
                  {error}
                </Text>
              ) : null}

              <TouchableOpacity
                onPress={handleContinueFromWarnings}
                style={styles.dangerButton}
                activeOpacity={0.8}
              >
                <Text color="white" fontWeight="600" fontSize={16}>
                  繼續刪除
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleGoBack}
                style={styles.cancelButton}
                activeOpacity={0.8}
              >
                <Text fontWeight="600" fontSize={16}>
                  取消
                </Text>
              </TouchableOpacity>
            </YStack>
          )}

          {/* --- Password Step --- */}
          {step === 'password' && (
            <YStack gap="$3">
              <Text fontSize={14} color="gray">
                為了安全起見，請輸入您的帳號密碼
              </Text>

              <YStack gap="$2" mt="$2">
                <Text fontWeight="500" fontSize={14}>
                  密碼
                </Text>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="請輸入密碼"
                  placeholderTextColor="#a0a0a0"
                  secureTextEntry
                  autoFocus
                />
              </YStack>

              {error ? (
                <Text color="#EF4444" fontSize={14}>
                  {error}
                </Text>
              ) : null}

              <TouchableOpacity
                onPress={handleContinueFromPassword}
                style={styles.dangerButton}
                activeOpacity={0.8}
              >
                <Text color="white" fontWeight="600" fontSize={16}>
                  確認
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setStep('warnings');
                  setError('');
                }}
                style={styles.cancelButton}
                activeOpacity={0.8}
              >
                <Text fontWeight="600" fontSize={16}>
                  返回
                </Text>
              </TouchableOpacity>
            </YStack>
          )}

          {/* --- Confirm Step --- */}
          {step === 'confirm' && (
            <YStack gap="$3">
              <Text fontSize={14} color="gray">
                此操作無法復原，請確認您要刪除帳號
              </Text>

              <Card bordered p="$5" bg="#FEF2F2" borderColor="#FEE2E2" mt="$2">
                <YStack items="center">
                  <AlertTriangle size={48} color="#EF4444" />
                </YStack>
                <Text fontWeight="600" fontSize={16} color="#991B1B" mt="$4" mb="$2">
                  刪除帳號後：
                </Text>
                <Text fontSize={14} color="#991B1B" lineHeight={22}>
                  {'\u2022'} 您的個人資料將永久刪除
                </Text>
                <Text fontSize={14} color="#991B1B" lineHeight={22}>
                  {'\u2022'} 持有的優惠券將無法再使用
                </Text>
                <Text fontSize={14} color="#991B1B" lineHeight={22}>
                  {'\u2022'} 使用紀錄將被清除
                </Text>
                <Text fontSize={14} color="#991B1B" lineHeight={22}>
                  {'\u2022'} 您可以使用相同的帳號重新註冊
                </Text>
              </Card>

              {error ? (
                <Text color="#EF4444" fontSize={14}>
                  {error}
                </Text>
              ) : null}

              <TouchableOpacity
                onPress={handleConfirmDeletion}
                style={[styles.dangerButton, isProcessing && { opacity: 0.6 }]}
                activeOpacity={0.8}
                disabled={isProcessing}
              >
                <Text color="white" fontWeight="600" fontSize={16}>
                  {isProcessing ? '刪除中...' : '確定刪除帳號'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setStep('password');
                  setError('');
                }}
                style={styles.cancelButton}
                activeOpacity={0.8}
                disabled={isProcessing}
              >
                <Text fontWeight="600" fontSize={16}>
                  取消
                </Text>
              </TouchableOpacity>
            </YStack>
          )}

          {/* --- Processing Step --- */}
          {step === 'processing' && (
            <YStack items="center" justify="center" py="$8">
              <ActivityIndicator size="large" color="#FFAD31" />
              <Text color="gray" mt="$4">
                刪除中...
              </Text>
            </YStack>
          )}
        </ScrollView>
      </YStack>
    </>
  );
};

const styles = StyleSheet.create({
  dangerButton: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  passwordInput: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    fontSize: 16,
    color: 'black',
  },
});

export default DeleteAccount;
