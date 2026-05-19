import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';
import FlagIcon from '@/src/components/icons/FlagIcon';
import BlockIcon from '@/src/components/icons/BlockIcon';
import type {
  MerchantDetail,
  MerchantCoupon,
  SharedCouponSummary,
} from '@/src/services/api/merchants';

interface MerchantSheetProps {
  visible: boolean;
  merchant: MerchantDetail | null;
  onClose: () => void;
  onUseCoupon: (coupon: MerchantCoupon) => void;
  onClaimSharedCoupon: (coupon: SharedCouponSummary) => void;
  onScanQR: () => void;
  onFlag?: () => void;
  onBlock?: () => void;
}

// Snap points: a brief preview at 35 % of the screen, then a deeper
// 90 % stop the user can drag up to. Mirrors Google Maps' merchant
// sheet behaviour where the user can peek then expand.
const SNAP_POINTS: string[] = ['35%', '90%'];

// Stable backdrop renderer outside the component so the sheet doesn't
// reinstantiate it every render (gorhom would otherwise re-mount the
// backdrop on each animation frame).
function renderBackdrop(props: BottomSheetBackdropProps): React.JSX.Element {
  return (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.5}
    />
  );
}

export default function MerchantSheet({
  visible,
  merchant,
  onClose,
  onUseCoupon,
  onClaimSharedCoupon,
  onScanQR,
  onFlag,
  onBlock,
}: MerchantSheetProps): React.JSX.Element {
  const sheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => SNAP_POINTS, []);

  // Bridge the controlled `visible` prop to gorhom's imperative ref
  // API. Keeping the controlled-component contract means MapScreen
  // doesn't have to thread a ref through.
  //
  // CRITICAL: do NOT early-return when merchant is null. Gorhom owns a
  // portal + a Reanimated animation; unmounting BottomSheetModal mid-
  // animation strands the backdrop and leaks the portal node. Render
  // the modal unconditionally and let `dismiss()` drive its lifecycle.
  useEffect(() => {
    if (visible && merchant) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible, merchant]);

  const myCoupons = merchant?.myCoupons ?? [];
  const sharedCoupons = merchant?.sharedCoupons ?? [];
  const myPublicShares = merchant?.myPublicShares ?? [];
  const news = merchant?.news ?? [];
  const firstNews = news[0];

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      index={0}
      enablePanDownToClose
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <View testID="merchant-sheet" style={styles.sheet}>
        <BottomSheetScrollView
          testID="merchant-sheet-scroll"
          // The sheet has its own bottom padding; let the scroll content
          // breathe at the end so the CTA never hugs the device bottom edge.
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
        {merchant && (<>
        {/* Header — pinned above the scroll area */}
        <View style={styles.headerRow}>
          <View style={styles.avatar}>
            <View style={styles.avatarShadow} />
            <View style={styles.avatarBody}>
              {/* Menu image placeholder — swap for an <Image source={{ uri: merchant.menuImageUrl }} /> when available */}
              <Text style={styles.avatarText}>🍱</Text>
            </View>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.storeName} numberOfLines={1}>
              {merchant.name}
            </Text>
            {(merchant.address || merchant.distanceKm != null) && (
              <Text style={styles.storeMeta} numberOfLines={1}>
                {[
                  merchant.address,
                  merchant.distanceKm != null ? `${merchant.distanceKm} km` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            )}
          </View>
          <View style={styles.modActions}>
            {onFlag && (
              <Pressable
                testID="merchant-sheet-flag"
                onPress={onFlag}
                style={styles.modBtn}
                accessibilityRole="button"
                accessibilityLabel={`檢舉 ${merchant.name}`}
                hitSlop={6}
              >
                <View testID="merchant-sheet-flag-icon">
                  <FlagIcon size={18} />
                </View>
              </Pressable>
            )}
            {onBlock && (
              <Pressable
                testID="merchant-sheet-block"
                onPress={onBlock}
                style={styles.modBtn}
                accessibilityRole="button"
                accessibilityLabel={`封鎖 ${merchant.name}`}
                hitSlop={6}
              >
                <View testID="merchant-sheet-block-icon">
                  <BlockIcon size={18} />
                </View>
              </Pressable>
            )}
          </View>
        </View>

        {/* My coupons — horizontal carousel */}
        <SectionHeader title="我的優惠券" subtitle="點擊使用" dotColor={colors.fg} />
        {myCoupons.length === 0 ? (
          <EmptyTile text="尚無可使用的優惠券" />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
            testID="my-coupons-carousel"
          >
            {myCoupons.map((c) => (
              <Pressable
                key={c.id}
                testID={`my-coupon-${c.id}`}
                onPress={() => onUseCoupon(c)}
                style={styles.myTile}
                accessibilityRole="button"
                accessibilityLabel={`使用 ${c.label} ${c.detail}`}
              >
                <Text style={styles.tileLabel}>{c.label}</Text>
                <Text style={styles.tileAmount} numberOfLines={1}>
                  {c.amount > 0 ? `$${c.amount}` : c.detail}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Shared coupons — horizontal carousel */}
        <SectionHeader title="CouMap 上的優惠券" subtitle="點擊領取" dotColor={colors.yellow} />
        {sharedCoupons.length === 0 ? (
          <EmptyTile text="目前沒有人在 CouMap 分享優惠" />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
            testID="shared-coupons-carousel"
          >
            {sharedCoupons.map((c, i) => (
              <Pressable
                key={`shared-${i}`}
                testID={`shared-coupon-${i}`}
                onPress={() => onClaimSharedCoupon(c)}
                style={styles.sharedTile}
                accessibilityRole="button"
                accessibilityLabel={`領取 ${c.label ?? '券'} $${c.amount}`}
              >
                <Text style={styles.tileLabel}>{c.label ?? '折抵'}</Text>
                <Text style={styles.tileAmount} numberOfLines={1}>
                  ${c.amount}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* My own outstanding public shares — read-only. The BE blocks the
            sharer from claiming their own coupon, so these tiles are
            non-interactive. They exist so the sharer sees confirmation
            that the coupon they released is live in the public pool. */}
        {myPublicShares.length > 0 && (
          <>
            <SectionHeader
              title="你在這裡釋出的優惠券"
              subtitle="等待別人領取"
              dotColor={colors.purple}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
              testID="my-public-shares-carousel"
            >
              {myPublicShares.map((c, i) => (
                <View
                  key={`mine-${i}`}
                  testID={`my-public-share-${i}`}
                  style={[styles.sharedTile, styles.myPublicShareTile]}
                  accessibilityRole="text"
                  accessibilityLabel={`你已釋出 ${c.label ?? '券'} $${c.amount}`}
                >
                  <Text style={styles.tileLabel}>{c.label ?? '折抵'}</Text>
                  <Text style={styles.tileAmount} numberOfLines={1}>
                    ${c.amount}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </>
        )}

        {/* Merchant news */}
        {firstNews && (
          <View style={styles.newsCard} testID="merchant-news">
            <View style={styles.newsAvatar}>
              <Text style={styles.newsAvatarText}>📣</Text>
            </View>
            <View style={styles.newsBody}>
              <View style={styles.newsHeadRow}>
                <Text style={styles.newsTitle}>店家近況</Text>
                <Text style={styles.newsAgo}>· {firstNews.agoText}</Text>
              </View>
              <Text style={styles.newsText} numberOfLines={2}>
                {firstNews.body}
              </Text>
            </View>
            <Text style={styles.newsLens}>🔍</Text>
          </View>
        )}

        {/* Claim CTA */}
        <View style={styles.ctaWrap}>
          <View style={styles.ctaShadow} />
          <Pressable
            testID="merchant-sheet-scan"
            onPress={onScanQR}
            style={styles.ctaBtn}
            accessibilityRole="button"
            accessibilityLabel="掃描店家 QR 領取優惠券"
          >
            <Text style={styles.ctaText}>領取</Text>
          </Pressable>
        </View>
        </>)}
        </BottomSheetScrollView>
      </View>
    </BottomSheetModal>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle: string;
  dotColor: string;
}

function SectionHeader({ title, subtitle, dotColor }: SectionHeaderProps): React.JSX.Element {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionDot, { backgroundColor: dotColor }]} />
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionDivider}>·</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
  );
}

function EmptyTile({ text }: { text: string }): React.JSX.Element {
  return (
    <View style={styles.emptyTile}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Gorhom owns the sheet's outer rounded background + handle indicator;
  // `sheet` here is the inner content padding only.
  sheet: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  // Outer-card neo-brutalism styling, applied via gorhom's backgroundStyle.
  sheetBackground: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 3,
    borderBottomWidth: 0,
    borderColor: colors.border,
  },
  handleIndicator: {
    backgroundColor: colors.border,
    width: 40,
    height: 5,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  avatar: {
    position: 'relative',
    width: 52,
    height: 52,
  },
  avatarShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.border,
  },
  avatarBody: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.yellow,
    borderWidth: 2.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 26,
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
  },
  storeName: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 19,
    letterSpacing: -0.4,
    color: colors.fg,
    marginBottom: 2,
  },
  storeMeta: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 12,
    color: colors.muted,
  },
  modActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    marginBottom: 8,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    color: colors.fg,
    letterSpacing: -0.15,
  },
  sectionDivider: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: colors.muted,
  },
  sectionSubtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    color: colors.muted,
  },
  carousel: {
    gap: 10,
    paddingVertical: 4,
    paddingRight: 10,
    marginBottom: 10,
  },
  myTile: {
    width: 140,
    minHeight: 76,
    backgroundColor: colors.card,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    justifyContent: 'space-between',
  },
  sharedTile: {
    width: 96,
    minHeight: 76,
    backgroundColor: colors.yellow,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    justifyContent: 'space-between',
  },
  // Distinct treatment for read-only "your own outstanding share" tiles —
  // dashed border + muted purple to differentiate from claimable yellow.
  myPublicShareTile: {
    backgroundColor: colors.purpleLight,
    borderStyle: 'dashed',
    borderColor: colors.purple,
    opacity: 0.92,
  },
  tileLabel: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.muted,
  },
  tileAmount: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 22,
    letterSpacing: -0.6,
    color: colors.fg,
  },
  emptyTile: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.subtle,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  emptyText: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 12,
    color: colors.muted,
  },
  newsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  newsAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.purpleLight,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newsAvatarText: {
    fontSize: 14,
  },
  newsBody: {
    flex: 1,
    minWidth: 0,
  },
  newsHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 2,
  },
  newsTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    color: colors.fg,
  },
  newsAgo: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 11,
    color: colors.muted,
  },
  newsText: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: colors.fg,
    lineHeight: 16,
  },
  newsLens: {
    fontSize: 14,
    marginLeft: 6,
  },
  ctaWrap: {
    position: 'relative',
    marginTop: 4,
  },
  ctaShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  ctaBtn: {
    backgroundColor: colors.yellow,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 17,
    letterSpacing: -0.2,
    color: colors.fg,
  },
});
