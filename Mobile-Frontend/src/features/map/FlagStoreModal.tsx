import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import BottomSheet from '@/src/components/ui/BottomSheet';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';

const FLAG_REASONS = ['廣告/詐騙', '不存在的商家', '以名牟利', '無法兌現', '其他'];

interface FlagStoreModalProps {
  visible: boolean;
  store: string;
  onClose: () => void;
  /** Optional submit hook — called with the chosen reason when the user confirms. */
  onSubmit?: (reason: string) => void;
}

export default function FlagStoreModal({
  visible, store, onClose, onSubmit,
}: FlagStoreModalProps): React.JSX.Element {
  const [selected, setSelected] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleClose = () => {
    setSelected(null);
    setDone(false);
    onClose();
  };

  const handleSubmit = () => {
    if (!selected) return;
    if (onSubmit) onSubmit(selected);
    setDone(true);
  };

  return (
    <BottomSheet visible={visible} onClose={handleClose}>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {done ? (
          <View style={styles.doneContainer}>
            <Text style={styles.checkmark}>✓</Text>
            <Text style={styles.doneTitle}>已回報</Text>
            <Text style={styles.doneSub}>我們會在 3 個工作天內審核「{store}」的舉報。</Text>
            <Pressable onPress={handleClose} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>關閉</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.title}>舉報店家</Text>
            <Text style={styles.sub}>「{store}」— 請選擇舉報原因</Text>
            {FLAG_REASONS.map((r) => (
              <Pressable
                key={r}
                onPress={() => setSelected(r)}
                style={[styles.reasonRow, selected === r && styles.reasonRowSelected]}
              >
                <View style={[styles.radio, selected === r && styles.radioSelected]} />
                <Text style={[styles.reasonText, selected === r && styles.reasonTextSelected]}>{r}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={handleSubmit}
              style={[styles.submitBtn, !selected && styles.submitBtnDisabled]}
            >
              <Text style={[styles.submitBtnText, !selected && styles.submitBtnTextDisabled]}>提交舉報</Text>
            </Pressable>
          </>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderWidth: 3, borderBottomWidth: 0, borderColor: colors.border,
    padding: 20, paddingBottom: 36,
    shadowColor: colors.red, shadowOffset: { width: 0, height: -6 }, shadowOpacity: 1, shadowRadius: 0,
  },
  handle: { width: 40, height: 5, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  title: { fontFamily: fontFamilies.bold, fontSize: 17, color: colors.fg, marginBottom: 4 },
  sub: { fontFamily: fontFamilies.regular, fontSize: 12, color: colors.muted, marginBottom: 14 },
  reasonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 11, paddingHorizontal: 14, marginBottom: 8,
    backgroundColor: colors.card, borderWidth: 2, borderColor: colors.subtle, borderRadius: 6,
  },
  reasonRowSelected: { backgroundColor: colors.yellow, borderColor: colors.border },
  radio: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.border, backgroundColor: 'transparent' },
  radioSelected: { backgroundColor: colors.fg },
  reasonText: { fontFamily: fontFamilies.regular, fontSize: 14, color: colors.fg },
  reasonTextSelected: { fontFamily: fontFamilies.bold },
  submitBtn: {
    marginTop: 4, padding: 13, backgroundColor: colors.red,
    borderWidth: 2.5, borderColor: colors.border, borderRadius: 6, alignItems: 'center',
    shadowColor: colors.border, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0,
  },
  submitBtnDisabled: { backgroundColor: colors.subtle, shadowOpacity: 0 },
  submitBtnText: { fontFamily: fontFamilies.bold, fontSize: 14, color: '#FFFFFF' },
  submitBtnTextDisabled: { color: colors.muted },
  doneContainer: { alignItems: 'center', paddingVertical: 12 },
  checkmark: { fontSize: 32, marginBottom: 8, color: colors.fg },
  doneTitle: { fontFamily: fontFamilies.bold, fontSize: 17, color: colors.fg, marginBottom: 6 },
  doneSub: { fontFamily: fontFamilies.regular, fontSize: 13, color: colors.muted, textAlign: 'center', marginBottom: 20 },
  primaryBtn: {
    width: '100%', padding: 13, backgroundColor: colors.yellow,
    borderWidth: 2, borderColor: colors.border, borderRadius: 6, alignItems: 'center',
    shadowColor: colors.border, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0,
  },
  primaryBtnText: { fontFamily: fontFamilies.bold, fontSize: 14, color: colors.fg },
});
