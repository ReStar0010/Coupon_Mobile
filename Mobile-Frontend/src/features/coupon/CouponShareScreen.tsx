import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import GemIcon from '@/src/components/icons/GemIcon';

interface NavParams {
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

type ShareTarget = 'map' | 'link' | null;

const EXAMPLES = [
  '希望你會喜歡～～',
  '剛吃完真的不錯，推薦你試試！',
  '送給有緣人～有空去逛逛',
];

const SHARE_OPTIONS: Array<{ id: 'map' | 'link'; title: string; sub: string }> = [
  { id: 'map', title: '釋出到 CouMap', sub: '附近的人都看得到 · 適合無特定對象' },
  { id: 'link', title: '連結傳給朋友', sub: '複製連結，傳到 LINE / 訊息給特定的人' },
];

export default function CouponShareScreen({
  onNavigate,
  params,
  setGems,
}: CouponScreenProps): React.JSX.Element {
  const [target, setTarget] = useState<ShareTarget>(null);
  const [note, setNote] = useState('');
  const [success, setSuccess] = useState(false);

  const handleConfirm = () => {
    if (!target) return;
    setSuccess(true);
    setGems((g) => g + 1);
    setTimeout(() => onNavigate('home'), 2500);
  };

  const confirmLabel =
    target === 'map' ? '釋出到 CouMap' : target === 'link' ? '建立連結' : '選一個分享方式';

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <View style={s.backOuter}>
          <View style={s.backShadow} />
          <Pressable onPress={() => onNavigate('coupon-detail', params)} style={s.backBtn}>
            <Text style={s.backArrow}>←</Text>
          </Pressable>
        </View>
        <Text style={s.headerTitle}>分享優惠券</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <View style={s.gemBannerOuter}>
          <View style={s.gemBannerShadow} />
          <View style={s.gemBanner}>
            <GemIcon size={46} color={colors.purple} />
            <View style={s.gemBannerText}>
              <Text style={s.gemBannerTitle}>分享這張券，有人使用 → 你賺寶石</Text>
              <Text style={s.gemBannerSub}>
                每張券回饋 <Text style={s.purpleBold}>1 顆寶石</Text>，可在 Spinner 兌換獎品
              </Text>
            </View>
          </View>
        </View>
        <View style={s.noteSection}>
          <View style={s.noteHeader}>
            <Text style={s.noteLabel}>給領券的人留句話</Text>
            <Text style={s.noteOptional}>選填</Text>
          </View>
          <View style={s.noteInputWrapper}>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="例如：我吃過很喜歡，希望你也會喜歡 ☕"
              maxLength={80}
              multiline
              placeholderTextColor={colors.muted}
              style={s.noteInput}
            />
            <Text style={s.noteCounter}>{note.length}/80</Text>
          </View>
          <View style={s.examplesRow}>
            {EXAMPLES.map((ex, i) => (
              <Pressable key={i} onPress={() => setNote(ex)} style={s.exampleChip}>
                <Text style={s.exampleText}>{ex}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={s.targetSection}>
          <Text style={s.targetLabel}>選擇分享方式</Text>
          <View style={s.targetList}>
            {SHARE_OPTIONS.map((opt) => {
              const active = target === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  testID={`target-${opt.id}`}
                  onPress={() => setTarget(opt.id)}
                  style={[s.targetItem, active && s.targetItemActive]}
                >
                  <View style={s.targetIcon}>
                    {opt.id === 'map' ? (
                      <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M12 22 Q5 14 5 9 A7 7 0 1 1 19 9 Q19 14 12 22 Z"
                          fill={colors.yellow}
                          stroke="#fff"
                          strokeWidth={1.4}
                        />
                        <Circle cx={12} cy={9} r={2.6} fill="#fff" />
                      </Svg>
                    ) : (
                      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"
                          stroke="#fff"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                        />
                        <Path
                          d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"
                          stroke="#fff"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                        />
                      </Svg>
                    )}
                  </View>
                  <View style={s.targetTextWrap}>
                    <Text style={s.targetTitle}>{opt.title}</Text>
                    <Text style={s.targetSub}>{opt.sub}</Text>
                  </View>
                  <View style={[s.radio, active && s.radioActive]}>
                    {active && <View style={s.radioDot} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={s.confirmSection}>
          <View style={s.confirmOuter}>
            {target && <View style={s.confirmShadow} />}
            <Pressable
              testID="confirm-btn"
              onPress={handleConfirm}
              disabled={!target}
              accessibilityState={{ disabled: !target }}
              style={[s.confirmBtn, !target && s.confirmBtnDisabled]}
            >
              <GemIcon size={18} color={target ? colors.purpleLight : colors.muted} />
              <Text style={[s.confirmText, !target && s.confirmTextDisabled]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      {success && (
        <View style={s.successOverlay}>
          <View style={s.successIcon}>
            <GemIcon size={46} color={colors.purpleLight} />
          </View>
          <Text style={s.successTitle}>已分享！</Text>
          <Text style={s.successSub}>+1 顆寶石 已入帳</Text>
          <Text style={s.successReturn}>返回首頁中…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
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
    fontSize: 26,
    letterSpacing: -0.78,
    color: colors.fg,
    flex: 1,
  },
  content: { paddingBottom: 24 },
  gemBannerOuter: { position: 'relative', marginHorizontal: 16, marginBottom: 12 },
  gemBannerShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: -3,
    bottom: -3,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  gemBanner: {
    backgroundColor: colors.purpleLight,
    borderWidth: 2.5,
    borderColor: colors.purple,
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gemBannerText: { flex: 1 },
  gemBannerTitle: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 14,
    color: colors.fg,
    lineHeight: 19,
  },
  gemBannerSub: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    color: colors.fg,
    marginTop: 4,
    lineHeight: 16,
  },
  purpleBold: { fontFamily: fontFamilies.bold, color: colors.purple },
  noteSection: { marginHorizontal: 16, marginBottom: 12 },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  noteLabel: { fontFamily: fontFamilies.bold, fontSize: 13, color: colors.fg },
  noteOptional: { fontFamily: fontFamilies.regular, fontSize: 10, color: colors.muted },
  noteInputWrapper: { position: 'relative' },
  noteInput: {
    height: 70,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    paddingRight: 38,
    fontSize: 12,
    lineHeight: 18,
    color: colors.fg,
    backgroundColor: colors.bg,
    textAlignVertical: 'top',
  },
  noteCounter: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    fontFamily: fontFamilies.monoRegular,
    fontSize: 9,
    color: colors.muted,
  },
  examplesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  exampleChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.subtle,
    borderRadius: 4,
  },
  exampleText: { fontFamily: fontFamilies.medium, fontSize: 10, color: colors.fg },
  targetSection: { marginHorizontal: 16, marginBottom: 14 },
  targetLabel: { fontFamily: fontFamilies.bold, fontSize: 13, color: colors.fg, marginBottom: 8 },
  targetList: { gap: 8 },
  targetItem: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 6,
  },
  targetItemActive: {
    backgroundColor: colors.yellowLight,
    borderWidth: 2.5,
    borderColor: colors.yellow,
  },
  targetIcon: {
    width: 46,
    height: 46,
    borderRadius: 6,
    backgroundColor: colors.fg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  targetTextWrap: { flex: 1 },
  targetTitle: { fontFamily: fontFamilies.bold, fontSize: 14, color: colors.fg },
  targetSub: {
    fontFamily: fontFamilies.regular,
    fontSize: 10,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 14,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.subtle,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioActive: { borderColor: colors.fg, backgroundColor: colors.fg },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  confirmSection: { paddingHorizontal: 16 },
  confirmOuter: { position: 'relative', marginBottom: 7 },
  confirmShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: -3,
    bottom: -3,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  confirmBtn: {
    backgroundColor: colors.purple,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  confirmBtnDisabled: { backgroundColor: '#ddd', borderColor: colors.subtle },
  confirmText: { fontFamily: fontFamilies.extraBold, fontSize: 15, color: '#fff' },
  confirmTextDisabled: { color: colors.muted },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(250,250,248,0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.purple,
    borderWidth: 3,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 22,
    letterSpacing: -0.44,
    color: colors.fg,
  },
  successSub: { fontFamily: fontFamilies.regular, fontSize: 13, color: colors.muted, marginTop: 6 },
  successReturn: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 11,
    color: colors.muted,
    marginTop: 8,
  },
});
