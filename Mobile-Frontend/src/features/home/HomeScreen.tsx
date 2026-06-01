import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import TicketIcon from '@/src/components/icons/TicketIcon';
import GemIcon from '@/src/components/icons/GemIcon';
import CouponRow from '@/src/components/ui/CouponRow';
import HomeHeader from './HomeHeader';
import CouPointsCard from './CouPointsCard';
import DrawModal from './DrawModal';
import Coachmark from '@/src/features/onboarding/Coachmark';
import { OnboardingAnchor, ANCHOR } from '@/src/components/onboarding/onboardingAnchors';
import { useWallet } from '@/src/state/WalletContext';
import {
  listMyShares,
  withdrawShare,
  getDailyDrawStatus,
  type Coupon,
  type MyShare,
} from '@/src/services/api/coupons';

interface NavParams {
  id?: string;
  store?: string;
  detail?: string;
  expires?: string;
  amount?: number;
}
interface ScreenProps {
  onNavigate: (screen: string, params?: NavParams) => void;
  gems: number;
  setGems: (fn: (prev: number) => number) => void;
  couPoints: number;
  setCouPoints: (fn: (prev: number) => number) => void;
}

function getUrgency(coupon: Coupon): 'expiring' | 'new' | null {
  if (coupon.status === 'redeemed' || coupon.status === 'expired') return null;
  // Best-effort: BE returns 'MM/DD'. Compare with today.
  const parts = coupon.expires.split('/');
  if (parts.length === 2) {
    const now = new Date();
    const month = Number(parts[0]);
    const day = Number(parts[1]);
    if (!Number.isNaN(month) && !Number.isNaN(day)) {
      const year = month < now.getMonth() + 1 ? now.getFullYear() + 1 : now.getFullYear();
      const expiresAt = new Date(year, month - 1, day);
      const diffDays = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 7) return 'expiring';
    }
  }
  return null;
}

export default function HomeScreen({
  onNavigate,
  gems,
  couPoints,
}: ScreenProps): React.JSX.Element {
  const [showDraw, setShowDraw] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [shares, setShares] = useState<MyShare[]>([]);
  const [withdrawingId, setWithdrawingId] = useState<number | null>(null);
  // Mirror of the server's once-per-day gate. Defaults to true so the card
  // is usable while the first status fetch is in flight; the draw endpoint
  // still rejects a second draw authoritatively if this is stale.
  const [canDrawToday, setCanDrawToday] = useState(true);
  const { coupons, refreshWallet } = useWallet();

  // 'shared' = held by the user with an outstanding LINK share, still theirs
  // until the recipient collects it. Keep these visible (they carry a 分享中
  // badge + 收回 control); they only drop off once collected/withdrawn.
  const visibleCoupons = coupons.filter((c) => c.status === 'active' || c.status === 'shared');
  // listMyShares already returns pending-only, but filter defensively.
  const pendingShares = shares.filter((s) => s.status === 'pending');
  // CouMap (public) shares live in the footer; the coupon left the wallet.
  const pendingPublicShares = pendingShares.filter((s) => s.is_public);
  // Link (private) shares keep the coupon in the wallet, so we attach a badge
  // + withdraw onto the matching active coupon card. BE coupon_id is numeric;
  // wallet coupon ids are strings — key by String() so the lookup matches.
  const privateShareByCouponId = new Map<string, MyShare>(
    pendingShares.filter((s) => !s.is_public).map((s) => [String(s.coupon_id), s]),
  );

  const loadShares = useCallback(async () => {
    try {
      const next = await listMyShares();
      setShares(next);
    } catch {
      setShares([]);
    }
  }, []);

  const loadDrawStatus = useCallback(async () => {
    try {
      const status = await getDailyDrawStatus();
      setCanDrawToday(status.canDrawToday);
    } catch {
      // Fail-open: leave the card enabled; the BE enforces the limit.
      setCanDrawToday(true);
    }
  }, []);

  // Single canonical reload of everything the home list derives from:
  // the wallet (coupon entries + balances), pending shares (分享中 badges
  // + CouMap footer), and the daily-draw gate. Silent — no pull-spinner.
  const reload = useCallback(async (): Promise<void> => {
    await Promise.all([refreshWallet(), loadShares(), loadDrawStatus()]);
  }, [refreshWallet, loadShares, loadDrawStatus]);

  // Initial load of the share/draw state on mount. The wallet itself is
  // already fetched by WalletContext when auth becomes true, so we don't
  // refresh it here — the focus effect below handles every later return.
  useEffect(() => {
    void loadShares();
    void loadDrawStatus();
  }, [loadShares, loadDrawStatus]);

  // Auto-refresh whenever the home screen regains focus — returning from
  // any coupon-changing flow (receive, redeem, share, withdraw, draw, or a
  // share-link claim) re-focuses this tab and pulls canonical state, so the
  // list never goes stale without a manual pull. The first focus is skipped:
  // WalletContext + the mount effect above already loaded everything, and a
  // refetch there would just double-fetch on cold start.
  const hasFocusedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedRef.current) {
        hasFocusedRef.current = true;
        return;
      }
      void reload();
    }, [reload]),
  );

  const handleWithdraw = useCallback(
    (share: MyShare) => {
      const [title, message] = share.is_public
        ? ['收回優惠券', `確定要從 CouMap 收回「${share.coupon_name}」嗎？`]
        : ['收回分享連結', `確定要收回「${share.coupon_name}」的分享連結嗎？對方將無法再領取。`];
      Alert.alert(title, message, [
        { text: '取消', style: 'cancel' },
        {
          text: '收回',
          style: 'destructive',
          onPress: async () => {
            setWithdrawingId(share.share_id);
            try {
              await withdrawShare(share.share_id);
              await Promise.all([refreshWallet(), loadShares()]);
            } catch {
              Alert.alert('收回失敗', '請稍後再試');
            } finally {
              setWithdrawingId(null);
            }
          },
        },
      ]);
    },
    [refreshWallet, loadShares],
  );

  const onRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  const header = (
    <>
      <HomeHeader onSettings={() => onNavigate('settings')} />
      <OnboardingAnchor id={ANCHOR.homeWallet}>
        <CouPointsCard
          couPoints={couPoints}
          onUse={() => onNavigate('coupoint-use')}
          onHistory={() => onNavigate('coupoint-history')}
        />
      </OnboardingAnchor>
      <OnboardingAnchor id={ANCHOR.homeGem} style={s.gemBannerOuter}>
        <View style={s.gemBannerShadow} />
        <Pressable onPress={() => onNavigate('spinner')} style={s.gemBanner}>
          <View style={s.gemInfo}>
            <Text style={s.gemLabel}>CouGem 寶石</Text>
            <View style={s.gemCountRow}>
              <View style={s.gemIconWrap}>
                <GemIcon size={38} color={colors.purpleLight} />
              </View>
              <View style={s.gemNumRow}>
                <Text style={s.gemNum}>{gems}</Text>
                <Text style={s.gemUnit}>顆</Text>
              </View>
            </View>
          </View>
          <View style={s.gemCtaBtn}>
            <Text style={s.gemCta}>抽獎 →</Text>
          </View>
        </Pressable>
      </OnboardingAnchor>
      <View style={s.sectionHeader}>
        <View style={s.sectionLeft}>
          <TicketIcon size={18} />
          <Text style={s.sectionTitle}>我的券</Text>
        </View>
        <View style={s.countOuter}>
          <View style={s.countShadow} />
          <View style={s.countBadge}>
            <Text style={s.countNum}>{visibleCoupons.length}</Text>
            <Text style={s.countLabel}>張</Text>
          </View>
        </View>
      </View>
      <View style={s.drawOuter}>
        {canDrawToday && <View style={s.drawShadow} />}
        <Pressable
          onPress={() => setShowDraw(true)}
          disabled={!canDrawToday}
          style={[s.drawBtn, !canDrawToday && s.drawBtnDisabled]}
        >
          <Text style={s.drawLabel}>DAILY DRAW</Text>
          <View style={s.drawMain}>
            <TicketIcon size={32} />
            <Text style={[s.drawTitle, !canDrawToday && s.drawTitleDisabled]}>
              {canDrawToday ? '每日抽券' : '今天已抽 · 明天再來'}
            </Text>
          </View>
        </Pressable>
      </View>
    </>
  );

  return (
    <View style={s.root}>
      <FlatList
        data={visibleCoupons}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View testID="coupons-empty" style={s.emptyState}>
            <Text style={s.emptyTitle}>尚無優惠券</Text>
            <Text style={s.emptySub}>抽券或前往 CouMap 領取你的第一張券</Text>
          </View>
        }
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.fg} />
        }
        renderItem={({ item, index }) => {
          const linkShare = privateShareByCouponId.get(item.id);
          const row = (
            <CouponRow
              store={item.store}
              detail={item.detail}
              expires={item.expires}
              amount={item.amount}
              urgency={getUrgency(item)}
              gems={item.gem_reward}
              sharing={!!linkShare}
              withdrawing={!!linkShare && withdrawingId === linkShare.share_id}
              onWithdraw={linkShare ? () => handleWithdraw(linkShare) : undefined}
              onPress={() =>
                onNavigate('coupon-detail', {
                  id: item.id,
                  store: item.store,
                  detail: item.detail,
                  expires: item.expires,
                  amount: item.amount,
                })
              }
              onShare={() =>
                onNavigate('coupon-share', {
                  id: item.id,
                  store: item.store,
                  detail: item.detail,
                  expires: item.expires,
                  amount: item.amount,
                })
              }
            />
          );
          return (
            <View style={s.rowWrap}>
              {/* Anchor only the first row so the coach-mark spotlight has a
                  stable target; later rows render unwrapped. */}
              {index === 0 ? (
                <OnboardingAnchor id={ANCHOR.homeCoupon}>{row}</OnboardingAnchor>
              ) : (
                row
              )}
            </View>
          );
        }}
        ListFooterComponent={
          pendingPublicShares.length > 0 ? (
            <View style={s.sharedSection}>
              <Text style={s.sharedTitle}>已釋出到 CouMap</Text>
              {pendingPublicShares.map((sh) => (
                <View key={sh.share_id} style={s.sharedRow}>
                  <View style={s.sharedInfo}>
                    <Text style={s.sharedName}>{sh.coupon_name}</Text>
                    <Text style={s.sharedStore}>{sh.store_name ?? ''}</Text>
                  </View>
                  <Pressable
                    testID={`withdraw-btn-${sh.share_id}`}
                    onPress={() => {
                      void handleWithdraw(sh);
                    }}
                    disabled={withdrawingId === sh.share_id}
                    style={s.withdrawBtn}
                  >
                    {withdrawingId === sh.share_id ? (
                      <ActivityIndicator size="small" color={colors.fg} />
                    ) : (
                      <Text style={s.withdrawText}>收回</Text>
                    )}
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null
        }
      />
      <DrawModal
        visible={showDraw}
        onClose={() => setShowDraw(false)}
        onDraw={() => {
          // Any completed draw (win, miss, or already-drawn) spends the day.
          setCanDrawToday(false);
        }}
      />
      <Coachmark screen="home" />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  listContent: { paddingBottom: 88 },
  rowWrap: { paddingHorizontal: 16, marginBottom: 8 },
  emptyState: {
    paddingHorizontal: 24,
    paddingVertical: 36,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    color: colors.fg,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  emptySub: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
  },
  gemInfo: { flex: 1 },
  gemBannerOuter: { position: 'relative', marginHorizontal: 16, marginBottom: 20 },
  gemBannerShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  gemBanner: {
    backgroundColor: colors.purple,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gemLabel: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 2,
  },
  gemCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gemIconWrap: {
    width: 38,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gemNumRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  gemNum: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -1.44,
    color: '#fff',
  },
  gemUnit: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  gemCtaBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  gemCta: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    color: '#fff',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 14,
  },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 15,
    color: colors.fg,
    letterSpacing: -0.15,
  },
  countOuter: { position: 'relative' },
  countShadow: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: -2,
    bottom: -2,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countNum: { fontFamily: fontFamilies.extraBold, fontSize: 17, color: colors.fg },
  countLabel: { fontFamily: fontFamilies.regular, fontSize: 11, color: colors.muted },
  drawOuter: { position: 'relative', marginHorizontal: 16, marginBottom: 20 },
  drawShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  drawBtn: {
    backgroundColor: colors.yellowLight,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  drawBtnDisabled: {
    backgroundColor: colors.subtle,
    borderColor: colors.subtle,
  },
  drawTitleDisabled: {
    color: colors.muted,
    fontSize: 20,
  },
  drawLabel: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 10,
    letterSpacing: 1.2,
    color: 'rgba(51,51,51,0.55)',
    marginBottom: 8,
  },
  drawMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  drawTitle: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 26,
    letterSpacing: -0.52,
    color: colors.fg,
  },
  sharedSection: {
    paddingHorizontal: 16,
    marginTop: 20,
    gap: 6,
  },
  sharedTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: colors.muted,
    marginBottom: 4,
  },
  sharedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 12,
    gap: 10,
  },
  sharedInfo: {
    flex: 1,
  },
  sharedName: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: colors.fg,
  },
  sharedStore: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  withdrawBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.subtle,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 4,
  },
  withdrawText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    color: colors.fg,
  },
});
