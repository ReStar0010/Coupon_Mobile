import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import GemIcon from '@/src/components/icons/GemIcon';
import { getCoupon } from '@/src/services/api/coupons';
import type { CouponDetail } from '@/src/services/api/coupons';
import { track } from '@/src/services/analytics/posthog';
import Coachmark from '@/src/features/onboarding/Coachmark';
import { OnboardingAnchor, ANCHOR } from '@/src/components/onboarding/onboardingAnchors';

// BE returns expiry_date as ISO datetime; the ticket UI shows "2026 / MM/DD".
// Format defensively — a bad date string falls back to the legacy 'MM/DD'
// param so navigation from older screens still renders something.
function formatExpiryMMDD(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}`;
}

interface NavParams {
  id?: string;
  store?: string;
  detail?: string;
  expires?: string;
  amount?: number;
}
interface CouponScreenProps {
  onNavigate: (screen: string, params?: NavParams) => void;
  gems: number;
  setGems: (fn: (prev: number) => number) => void;
  couPoints: number;
  setCouPoints: (fn: (prev: number) => number) => void;
  params: NavParams;
}

export default function CouponDetailScreen({
  onNavigate,
  params,
}: CouponScreenProps): React.JSX.Element {
  const [fetched, setFetched] = useState<CouponDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(params.id));
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) {
      return;
    }
    track('coupon.viewed', { couponId: params.id });
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    getCoupon(params.id)
      .then((data) => {
        if (!cancelled) {
          setFetched(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to load coupon';
          setLoadError(msg);
          console.warn('[CouponDetailScreen] getCoupon failed:', msg);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const store = fetched?.store_name ?? params.store ?? '阿明早餐店';
  // Title (big text) — was the dollar amount; users couldn't tell coupons apart
  // because savings is a secondary attribute and the name is the primary one.
  const couponName = fetched?.coupon_name ?? '優惠券';
  // Description (medium text) — short pitch of what the coupon does.
  const couponDetailText = fetched?.coupon_detail ?? params.detail ?? '';
  const expires =
    formatExpiryMMDD(fetched?.expiry_date) ?? params.expires ?? '11/08';
  // BE returns estimated_savings as Decimal → JSON string. Coerce defensively;
  // an unparseable value hides the badge instead of rendering "$NaN".
  const savingsRaw = fetched?.estimated_savings;
  const savings =
    savingsRaw === null || savingsRaw === undefined || savingsRaw === ''
      ? null
      : Number(savingsRaw);
  const hasSavings = savings !== null && Number.isFinite(savings) && savings > 0;
  const typeLabel =
    fetched?.coupon_type === 'exclusive' ? '專屬優惠' : '隨取即用';
  const gemReward = fetched?.gem_reward ?? 1;
  // Legacy params shape kept for downstream screens (coupon-share / coupon-qr).
  // They still read {store, detail, expires, amount} — populate `amount` from
  // savings so existing renders that condition on it stay correct.
  const legacyAmount = hasSavings ? (savings as number) : params.amount ?? 0;

  if (isLoading) {
    return (
      <SafeAreaView style={s.root} testID="coupon-detail-loading">
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={colors.fg} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <View style={s.backOuter}>
          <View style={s.backShadow} />
          <Pressable onPress={() => onNavigate('home')} style={s.backBtn}>
            <Text style={s.backArrow}>←</Text>
          </Pressable>
        </View>
        <Text style={s.headerTitle}>優惠券</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {loadError ? (
          <View style={s.errorBanner} testID="coupon-detail-error">
            <Text style={s.errorText}>{loadError}</Text>
          </View>
        ) : null}
        <OnboardingAnchor id={ANCHOR.detailTicket} style={s.ticketOuter}>
          <View style={s.ticketShadow} />
          <View style={s.ticket}>
            <View style={s.expiryBadge}>
              <Text style={s.expiryText}>⚡ 7天內到期</Text>
            </View>
            <Text style={s.storeLabel}>{store}</Text>
            <Text style={s.couponName} numberOfLines={2}>
              {couponName}
            </Text>
            {couponDetailText ? (
              <Text style={s.couponDetailText} numberOfLines={3}>
                {couponDetailText}
              </Text>
            ) : null}
            {hasSavings ? (
              <Text style={s.savingsHint}>可省 ${Math.round(savings as number)}</Text>
            ) : null}
            <Text style={s.detailLabel}>{typeLabel}</Text>
            <View style={s.tearLine}>
              <View style={s.tearCircleLeft} />
              <View style={s.dashed} />
              <View style={s.tearCircleRight} />
            </View>
            <View style={s.metaGrid}>
              <View>
                <Text style={s.metaKey}>到期日</Text>
                <Text style={s.metaVal}>2026 / {expires}</Text>
              </View>
              <View>
                <Text style={s.metaKey}>分享獎勵</Text>
                <View style={s.gemRow}>
                  {Array.from({ length: Math.min(gemReward, 5) }).map((_, i) => (
                    <GemIcon key={i} size={18} color={colors.purpleLight} />
                  ))}
                </View>
              </View>
            </View>
          </View>
        </OnboardingAnchor>
        <View style={s.usageSection}>
          <Text style={s.usageTitle}>使用說明</Text>
          <Text style={s.usageItem}>· 結帳時出示 QR Code 給店員掃描</Text>
          <Text style={s.usageItem}>· 不可與其他優惠合併使用</Text>
          <Text style={s.usageItem}>· 店內、外帶皆可使用 · 限本人使用</Text>
        </View>
        <View style={s.shareBanner}>
          <GemIcon size={22} color={colors.purple} />
          <View style={s.shareBannerText}>
            <Text style={s.shareBannerBold}>用不到? 分享出去</Text>
            <Text style={s.shareBannerSub}>
              有人使用後，你可以賺到 <Text style={s.shareBold}>{gemReward} 顆 CouGem</Text> !
            </Text>
          </View>
        </View>
        <View style={s.ctaRow}>
          <OnboardingAnchor id={ANCHOR.detailShare} style={s.ctaOuter}>
            <View style={s.ctaShadow} />
            <Pressable
              testID="share-btn"
              onPress={() => {
                track('coupon.share_started', { couponId: params.id });
                onNavigate('coupon-share', { id: params.id, store, detail: couponDetailText, expires, amount: legacyAmount });
              }}
              style={[s.ctaBtn, s.ctaBtnShare]}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M21 3L11 13" stroke={colors.fg} strokeWidth={2} strokeLinecap="round" />
                <Path
                  d="M21 3L14 21L11 13L3 10Z"
                  stroke={colors.fg}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
              </Svg>
              <Text style={s.ctaBtnTextDark}>分享賺寶石</Text>
            </Pressable>
          </OnboardingAnchor>
          <OnboardingAnchor id={ANCHOR.detailUse} style={s.ctaOuter}>
            <View style={[s.ctaShadow, s.ctaShadowDark]} />
            <Pressable
              testID="use-btn"
              onPress={() => {
                track('coupon.redeem_started', { couponId: params.id });
                onNavigate('coupon-qr', { id: params.id, store, detail: couponDetailText, expires, amount: legacyAmount });
              }}
              style={[s.ctaBtn, s.ctaBtnUse]}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Rect x={3} y={3} width={7} height={7} rx={1} stroke="#fff" strokeWidth={1.8} />
                <Rect x={14} y={3} width={7} height={7} rx={1} stroke="#fff" strokeWidth={1.8} />
                <Rect x={3} y={14} width={7} height={7} rx={1} stroke="#fff" strokeWidth={1.8} />
                <Path
                  d="M14 14h3v3h-3zM18 14h3M14 18v3"
                  stroke="#fff"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                />
              </Svg>
              <Text style={s.ctaBtnTextLight}>立即使用</Text>
            </Pressable>
          </OnboardingAnchor>
        </View>
      </ScrollView>
      <Coachmark screen="coupon-detail" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.red,
    borderRadius: 6,
  },
  errorText: { fontFamily: fontFamilies.bold, fontSize: 12, color: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 2,
  },
  backOuter: { position: 'relative', width: 36, height: 36 },
  backShadow: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 36,
    height: 36,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { fontSize: 20, color: colors.fg },
  headerTitle: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    letterSpacing: -0.36,
    color: colors.fg,
    flex: 1,
  },
  content: { paddingBottom: 24 },
  ticketOuter: { position: 'relative', marginHorizontal: 16, marginBottom: 14 },
  ticketShadow: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: -5,
    bottom: -5,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  ticket: {
    backgroundColor: colors.yellow,
    borderWidth: 3,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 20,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  expiryBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: colors.red,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  expiryText: { fontFamily: fontFamilies.monoSemiBold, fontSize: 10, color: '#fff' },
  storeLabel: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(51,51,51,0.65)',
    marginBottom: 8,
  },
  couponName: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 32,
    letterSpacing: -1.2,
    color: colors.fg,
    lineHeight: 38,
    marginBottom: 8,
  },
  couponDetailText: {
    fontFamily: fontFamilies.regular,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(51,51,51,0.82)',
    marginBottom: 8,
  },
  savingsHint: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 12,
    letterSpacing: 0.4,
    color: colors.fg,
    backgroundColor: 'rgba(51,51,51,0.10)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  detailLabel: { fontFamily: fontFamilies.bold, fontSize: 14, color: colors.fg },
  tearLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    marginHorizontal: -20,
  },
  tearCircleLeft: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.border,
    marginLeft: -8,
  },
  dashed: {
    flex: 1,
    borderTopWidth: 2.5,
    borderColor: 'rgba(51,51,51,0.25)',
    borderStyle: 'dashed',
    marginHorizontal: 4,
  },
  tearCircleRight: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: -8,
  },
  metaGrid: { flexDirection: 'row', gap: 10 },
  metaKey: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: 'rgba(51,51,51,0.6)',
    marginBottom: 3,
  },
  metaVal: { fontFamily: fontFamilies.monoSemiBold, fontSize: 14, color: colors.fg },
  gemRow: { flexDirection: 'row', gap: 3 },
  usageSection: { paddingHorizontal: 16, marginBottom: 12 },
  usageTitle: { fontFamily: fontFamilies.bold, fontSize: 14, color: colors.fg, marginBottom: 8 },
  usageItem: { fontFamily: fontFamilies.regular, fontSize: 12, color: colors.fg, lineHeight: 21 },
  shareBanner: {
    marginHorizontal: 16,
    marginBottom: 80,
    padding: 10,
    backgroundColor: colors.purpleLight,
    borderWidth: 2,
    borderColor: colors.purple,
    borderStyle: 'dashed',
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shareBannerText: { flex: 1 },
  shareBannerBold: { fontFamily: fontFamilies.bold, fontSize: 12, color: colors.fg },
  shareBannerSub: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
  },
  shareBold: { fontFamily: fontFamilies.bold, color: colors.fg },
  ctaRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
    backgroundColor: `${colors.bg}CC`,
  },
  ctaOuter: { flex: 1, position: 'relative' },
  ctaShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: -3,
    bottom: -3,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  ctaShadowDark: { backgroundColor: colors.border },
  ctaBtn: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  ctaBtnShare: { backgroundColor: colors.yellow },
  ctaBtnUse: { backgroundColor: colors.fg },
  ctaBtnTextDark: { fontFamily: fontFamilies.extraBold, fontSize: 13, color: colors.fg },
  ctaBtnTextLight: { fontFamily: fontFamilies.extraBold, fontSize: 13, color: '#fff' },
});
