import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import BottomSheet from '@/src/components/ui/BottomSheet';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import TicketIcon from '@/src/components/icons/TicketIcon';

interface CouponItem {
  store: string;
  detail: string;
  expires: string;
  amount: number;
  prob: number;
}

const COUPON_POOL: CouponItem[] = [
  { store: '阿明早餐店', detail: '$25 現金折抵', expires: '12/31', amount: 25, prob: 0.15 },
  { store: '鼎泰豐', detail: '$50 現金折抵', expires: '12/31', amount: 50, prob: 0.08 },
  { store: '85度C', detail: '$10 現金折抵', expires: '12/31', amount: 10, prob: 0.25 },
  { store: '全聯福利中心', detail: '$20 現金折抵', expires: '12/31', amount: 20, prob: 0.12 },
  { store: '', detail: '', expires: '', amount: 0, prob: 0.40 },
];

interface DrawModalProps {
  visible: boolean;
  onClose: () => void;
  onDraw: (item: CouponItem) => void;
}

export default function DrawModal({
  visible,
  onClose,
  onDraw,
}: DrawModalProps): React.JSX.Element {
  const [drawing, setDrawing] = useState(false);
  const [result, setResult] = useState<CouponItem | null>(null);

  const doDraw = () => {
    setDrawing(true);
    setTimeout(() => {
      let r = Math.random();
      let acc = 0;
      let picked = COUPON_POOL[COUPON_POOL.length - 1];
      for (const c of COUPON_POOL) {
        acc += c.prob;
        if (r < acc) { picked = c; break; }
      }
      setResult(picked);
      setDrawing(false);
    }, 1400);
  };

  const handleClose = () => {
    setResult(null);
    setDrawing(false);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={handleClose}>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {!result ? (
          <>
            <Text style={styles.title}>抽券</Text>
            <Text style={styles.subtitle}>每次抽券消耗 <Text style={styles.bold}>20 pt</Text> · 機率如下</Text>
            <View style={styles.poolList}>
              {COUPON_POOL.map((c, i) => (
                <View key={i} style={styles.poolRow}>
                  <Text style={[styles.poolAmt, !c.amount && styles.textMuted]}>
                    {c.amount ? `$${c.amount}` : '空'}
                  </Text>
                  <Text style={[styles.poolStore, !c.amount && styles.textMuted]}>
                    {c.amount ? c.store : '沒抽到'}
                  </Text>
                  <View style={styles.probBar}>
                    <View
                      style={[
                        styles.probFill,
                        { width: `${c.prob * 100}%` as `${number}%` },
                        !c.amount && styles.probFillEmpty,
                      ]}
                    />
                  </View>
                  <Text style={styles.probText}>{Math.round(c.prob * 100)}%</Text>
                </View>
              ))}
            </View>
            <View style={styles.drawBtnWrapper}>
              {!drawing && <View style={styles.drawBtnShadow} />}
              <Pressable
                onPress={doDraw}
                disabled={drawing}
                style={[styles.drawBtn, drawing && styles.drawBtnDisabled]}
              >
                {drawing
                  ? <ActivityIndicator color={colors.muted} />
                  : null}
                <Text style={[styles.drawBtnText, drawing && styles.drawBtnTextDisabled]}>
                  {drawing ? '抽券中…' : '立即抽券 (−20 pt)'}
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            {result.amount > 0 ? (
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
                onPress={() => { onDraw(result); handleClose(); }}
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>
                  {result.amount > 0 ? '收下 →' : '關閉'}
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
  bold: {
    fontFamily: fontFamilies.bold,
    color: colors.fg,
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
  poolStore: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: colors.fg,
    flex: 1,
  },
  textMuted: {
    color: colors.muted,
  },
  probBar: {
    width: 48,
    height: 8,
    backgroundColor: colors.subtle,
    borderRadius: 2,
    overflow: 'hidden',
  },
  probFill: {
    height: '100%',
    backgroundColor: colors.yellow,
  },
  probFillEmpty: {
    backgroundColor: colors.subtle,
  },
  probText: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 10,
    color: colors.muted,
    width: 30,
    textAlign: 'right',
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
