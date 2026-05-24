import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import BottomSheet from '@/src/components/ui/BottomSheet';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import TicketIcon from '@/src/components/icons/TicketIcon';
import {
  listDailyDrawTemplates,
  dailyDraw,
  type DailyDrawTemplate,
} from '@/src/services/api/coupons';
import { localizeError } from '@/src/services/api/errorMessages';
import { useWallet } from '@/src/state/WalletContext';

/** UI projection of a daily-draw outcome (win or miss). */
interface DrawOutcome {
  success: boolean;
  /** Display store name (empty for a miss). */
  store: string;
  /** Display detail (empty for a miss). */
  detail: string;
  /** Display expiry in MM/DD (empty for a miss). */
  expires: string;
  /** Display amount (0 for a miss). */
  amount: number;
  /** Friendly message from the BE. */
  message: string;
}

interface DrawModalProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Optional callback fired with the BE-projected outcome when the user
   * dismisses the result. The parent may use this to navigate to the new
   * coupon's detail screen on success.
   */
  onDraw?: (outcome: DrawOutcome) => void;
}

function formatExpiry(iso: string): string {
  // Avoid Date parsing differences by extracting MM/DD directly when the
  // string is ISO-8601. Fall back to empty if shape doesn't match.
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[1]}/${m[2]}` : '';
}

export default function DrawModal({ visible, onClose, onDraw }: DrawModalProps): React.JSX.Element {
  const [templates, setTemplates] = useState<DailyDrawTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [result, setResult] = useState<DrawOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { refreshWallet } = useWallet();

  // Fetch templates each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setError(null);
    setLoadingTemplates(true);
    listDailyDrawTemplates()
      .then((rows) => {
        if (!cancelled) setTemplates(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError((err as Error).message || '無法載入抽券資訊');
      })
      .finally(() => {
        if (!cancelled) setLoadingTemplates(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const doDraw = async (): Promise<void> => {
    if (templates.length === 0 || drawing) return;
    setDrawing(true);
    setError(null);
    try {
      const response = await dailyDraw();
      if (response.success && response.coupon) {
        setResult({
          success: true,
          store: response.coupon.store_name,
          detail: response.coupon.detail,
          expires: formatExpiry(response.coupon.expiry_date),
          amount: Number(response.coupon.estimated_savings ?? 0),
          message: response.message,
        });
        void refreshWallet().catch(() => undefined);
      } else {
        setResult({
          success: false,
          store: '',
          detail: '',
          expires: '',
          amount: 0,
          message: response.message,
        });
      }
    } catch (err: unknown) {
      setError(localizeError(err, '抽券失敗，請稍後再試'));
    } finally {
      setDrawing(false);
    }
  };

  const handleClose = (): void => {
    setResult(null);
    setDrawing(false);
    setError(null);
    onClose();
  };

  const canDraw = !drawing && !loadingTemplates && templates.length > 0;

  return (
    <BottomSheet visible={visible} onClose={handleClose}>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {!result ? (
          <>
            <Text style={styles.title}>抽券</Text>
            <Text style={styles.subtitle}>
              {loadingTemplates ? '載入中…' : '免費抽券 · 從以下店家中隨機抽取'}
            </Text>
            {error ? (
              <Text style={styles.errorText} testID="draw-error">
                {error}
              </Text>
            ) : null}
            <View style={styles.poolList} testID="draw-pool">
              {loadingTemplates ? (
                <View style={styles.poolEmpty}>
                  <ActivityIndicator color={colors.muted} />
                </View>
              ) : templates.length === 0 ? (
                <View style={styles.poolEmpty}>
                  <Text style={styles.poolEmptyText}>目前沒有可抽的優惠券</Text>
                </View>
              ) : (
                templates.slice(0, 5).map((t) => (
                  <View key={t.id} style={styles.poolRow} testID={`draw-row-${t.id}`}>
                    <Text style={styles.poolAmt}>
                      {t.estimated_savings ? `$${Math.floor(Number(t.estimated_savings))}` : '—'}
                    </Text>
                    <View style={styles.poolInfo}>
                      <Text style={styles.poolStore}>{t.store_name}</Text>
                      <Text style={styles.poolDetail}>{t.coupon_name}</Text>
                    </View>
                    <View style={styles.poolMeta}>
                      <Text style={styles.probText}>{Math.round(t.draw_probability * 100)}%</Text>
                      <Text style={styles.qtyText}>{t.remaining_quantity} 張</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
            <View style={styles.drawBtnWrapper}>
              {canDraw && <View style={styles.drawBtnShadow} />}
              <Pressable
                onPress={doDraw}
                disabled={!canDraw}
                testID="draw-now-btn"
                style={[styles.drawBtn, !canDraw && styles.drawBtnDisabled]}
              >
                {drawing ? <ActivityIndicator color={colors.muted} /> : null}
                <Text style={[styles.drawBtnText, !canDraw && styles.drawBtnTextDisabled]}>
                  {drawing ? '抽券中…' : '立即抽券'}
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            {result.success && result.amount > 0 ? (
              <>
                <View style={styles.resultIconWrapper}>
                  <View style={styles.resultIconShadow} />
                  <View style={styles.resultIcon}>
                    <TicketIcon size={36} />
                  </View>
                </View>
                <Text style={styles.resultTitle}>抽中了！</Text>
                <Text style={styles.resultSub}>{result.store}</Text>
                <View style={styles.resultCard}>
                  <View style={styles.resultCardShadow} />
                  <View style={styles.resultCardInner}>
                    <Text style={styles.resultAmt}>${result.amount}</Text>
                    <Text style={styles.resultDetail}>
                      {result.detail} · 到期 {result.expires}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.missCenter}>
                <Text style={styles.missEmoji}>😔</Text>
                <Text style={styles.missTitle}>沒抽到</Text>
                <Text style={styles.missSub}>這次運氣不好，再試一次吧！</Text>
              </View>
            )}
            <View style={styles.closeBtnWrapper}>
              <View style={styles.closeBtnShadow} />
              <Pressable
                testID="draw-result-close"
                onPress={() => {
                  onDraw?.(result);
                  handleClose();
                }}
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>
                  {result.success && result.amount > 0 ? '收下 →' : '關閉'}
                </Text>
              </Pressable>
            </View>
          </>
        )}
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
    padding: 20,
    paddingBottom: 32,
    shadowColor: colors.yellow,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    color: colors.fg,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: colors.muted,
    marginBottom: 20,
  },
  poolList: {
    gap: 6,
    marginBottom: 20,
  },
  poolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 5,
  },
  poolAmt: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 13,
    color: colors.fg,
    width: 36,
  },
  poolInfo: {
    flex: 1,
  },
  poolStore: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: colors.fg,
  },
  poolDetail: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    color: colors.muted,
  },
  poolMeta: {
    alignItems: 'flex-end',
  },
  poolEmpty: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  poolEmptyText: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    color: colors.muted,
  },
  probText: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 12,
    color: colors.fg,
  },
  qtyText: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 9,
    color: colors.muted,
  },
  errorText: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: colors.red,
    marginBottom: 10,
  },
  drawBtnWrapper: {
    position: 'relative',
  },
  drawBtnShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: -3,
    bottom: -3,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  drawBtn: {
    backgroundColor: colors.yellow,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 15,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  drawBtnDisabled: {
    backgroundColor: colors.subtle,
    borderColor: colors.subtle,
  },
  drawBtnText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 16,
    color: colors.fg,
  },
  drawBtnTextDisabled: {
    color: colors.muted,
  },
  resultIconWrapper: {
    position: 'relative',
    width: 64,
    height: 64,
    alignSelf: 'center',
    marginBottom: 10,
  },
  resultIconShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: colors.border,
  },
  resultIcon: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: colors.yellow,
    borderWidth: 3,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitle: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 20,
    color: colors.fg,
    textAlign: 'center',
  },
  resultSub: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  resultCard: {
    position: 'relative',
    marginBottom: 16,
  },
  resultCardShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: -3,
    bottom: -3,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  resultCardInner: {
    backgroundColor: colors.yellow,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  resultAmt: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 36,
    color: colors.fg,
    letterSpacing: -1.44,
  },
  resultDetail: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: colors.fg,
    marginTop: 2,
  },
  missCenter: {
    paddingVertical: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  missEmoji: {
    fontSize: 48,
    marginBottom: 10,
  },
  missTitle: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 20,
    color: colors.fg,
  },
  missSub: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
  closeBtnWrapper: {
    position: 'relative',
  },
  closeBtnShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: -3,
    bottom: -3,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  closeBtn: {
    backgroundColor: colors.fg,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 15,
    alignItems: 'center',
  },
  closeBtnText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
    color: '#fff',
  },
});
