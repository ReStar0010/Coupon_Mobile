import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Share,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { platformVoucherAPI } from '@/app/utils/authAPI';
import type { PlatformVoucherDetail } from '@/app/utils/authAPI';

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function PlatformVoucherDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [voucher, setVoucher] = useState<PlatformVoucherDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const numId = id ? parseInt(id, 10) : NaN;

  const fetchDetail = useCallback(async () => {
    if (!id || Number.isNaN(numId)) {
      setError('無效的現金券');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await platformVoucherAPI.detail(numId);
      setVoucher(data);
    } catch (err: unknown) {
      const msg =
        err && typeof (err as { response?: { data?: { error?: string }; status?: number } })?.response?.data?.error === 'string'
          ? (err as { response: { data: { error: string } } }).response.data.error
          : (err as { response?: { status?: number } })?.response?.status === 403
            ? '您不是此現金券的持有人'
            : '無法載入現金券，請稍後再試。';
      setError(msg);
      setVoucher(null);
    } finally {
      setIsLoading(false);
    }
  }, [id, numId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleRedeem = useCallback(() => {
    router.push('/(tabs)/easyuse/enter-redeem-code');
  }, [router]);

  const handleSharePublic = useCallback(() => {
    Alert.alert(
      '確認分享現金券',
      '此現金券將移至公共交換池，其他用戶可領取。此操作無法復原。確定要分享嗎？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '確定分享',
          style: 'destructive',
          onPress: async () => {
            setIsSharing(true);
            try {
              await platformVoucherAPI.sharePublic(numId);
              Alert.alert('分享成功', '現金券已移至公共交換池');
              router.back();
            } catch {
              Alert.alert('分享失敗', '無法分享現金券，請稍後再試。');
            } finally {
              setIsSharing(false);
            }
          },
        },
      ],
    );
  }, [numId, router]);

  const handleShareLink = useCallback(async () => {
    setIsSharing(true);
    try {
      const result = await platformVoucherAPI.share(numId);
      const shareUrl = result.share_url || result.token;
      await Share.share({
        message: `我分享了一張現金券給你！連結：${shareUrl}`,
        url: shareUrl,
      });
    } catch {
      Alert.alert('分享失敗', '無法生成分享連結，請稍後再試。');
    } finally {
      setIsSharing(false);
    }
  }, [numId]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#FFAD31" />
          <Text style={styles.loadingText}>載入中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !voucher) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
            <ArrowLeft size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>現金券詳情</Text>
        </View>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error || '找不到此現金券'}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleBack} activeOpacity={0.7}>
            <Text style={styles.primaryButtonText}>返回</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isRedeemed = voucher.is_redeemed;
  const faceVal = String(voucher.face_value ?? '');
  const dotIdx = faceVal.indexOf('.');
  const valueInt = dotIdx >= 0 ? faceVal.slice(0, dotIdx) : faceVal;
  const valueDec = dotIdx >= 0 ? faceVal.slice(dotIdx) : '';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>現金券詳情</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.leftAccent} />
        <View style={styles.cardInner}>
          <View style={styles.amountBlock}>
            <Text style={styles.currencySymbol}>{voucher.currency_code} $</Text>
            <View style={styles.amountRow}>
              <Text style={styles.faceValueInt}>{valueInt}</Text>
              {valueDec ? <Text style={styles.faceValueDec}>{valueDec}</Text> : null}
            </View>
          </View>
          {voucher.batch_name ? (
            <Text style={styles.batchName}>{voucher.batch_name}</Text>
          ) : null}
          <View style={styles.meta}>
            <Text style={styles.metaLabel}>有效期間</Text>
            <Text style={styles.metaValue}>
              {formatDate(voucher.start_date)} ～ {formatDate(voucher.expiry_date)}
            </Text>
          </View>
          {isRedeemed && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>已核銷</Text>
            </View>
          )}
        </View>
      </View>

      {!isRedeemed && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleRedeem}
            activeOpacity={0.7}
            disabled={isSharing}
          >
            <Text style={styles.primaryButtonText}>到店核銷</Text>
          </TouchableOpacity>

          <View style={styles.shareRow}>
            <TouchableOpacity
              style={[styles.secondaryButton, isSharing && styles.buttonDisabled]}
              onPress={handleSharePublic}
              activeOpacity={0.7}
              disabled={isSharing}
            >
              <Text style={styles.secondaryButtonText}>
                {isSharing ? '分享中...' : '分享到 CouPro'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, isSharing && styles.buttonDisabled]}
              onPress={handleShareLink}
              activeOpacity={0.7}
              disabled={isSharing}
            >
              <Text style={styles.secondaryButtonText}>分享連結</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>至店家後輸入該店家的 6 碼核銷碼即可核銷此現金券</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 24,
  },
  card: {
    marginHorizontal: 20,
    marginTop: 24,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  leftAccent: {
    width: 5,
    backgroundColor: '#FFAD31',
  },
  cardInner: {
    flex: 1,
    padding: 24,
  },
  amountBlock: {
    marginBottom: 16,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFAD31',
    marginBottom: 4,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  faceValueInt: {
    fontSize: 36,
    fontWeight: '800',
    color: '#065f46',
    letterSpacing: -0.5,
  },
  faceValueDec: {
    fontSize: 24,
    fontWeight: '700',
    color: '#047857',
    marginLeft: 2,
  },
  batchName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  meta: {
    marginTop: 4,
  },
  metaLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 14,
    color: '#6b7280',
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 16,
    backgroundColor: '#d1fae5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
  },
  actions: {
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  primaryButton: {
    backgroundColor: '#FFAD31',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  shareRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#FFAD31',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFAD31',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  hint: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
});
