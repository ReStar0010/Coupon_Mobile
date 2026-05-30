import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import BottomSheet from '@/src/components/ui/BottomSheet';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';

interface NicknamePromptModalProps {
  visible: boolean;
  /**
   * Persist the chosen nickname. Resolves on success (the parent closes the
   * sheet and continues its flow) or rejects with an Error whose message is
   * shown inline.
   */
  onSubmit: (nickname: string) => Promise<void>;
  onClose: () => void;
}

const MAX_NICKNAME_LEN = 80;

/**
 * One-field prompt asking the user to set a public nickname before releasing
 * a coupon to CouMap. Gating lives on the backend (NICKNAME_REQUIRED); this is
 * the FE affordance that lets the user satisfy it without leaving the share flow.
 */
export default function NicknamePromptModal({
  visible,
  onSubmit,
  onClose,
}: NicknamePromptModalProps): React.JSX.Element {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset to a clean slate each time the sheet opens — we never pre-fill,
  // because the profile's displayName may currently be a phone-derived
  // fallback we don't want to surface.
  useEffect(() => {
    if (visible) {
      setValue('');
      setError(null);
      setSaving(false);
    }
  }, [visible]);

  const trimmed = value.trim();
  const canSave = trimmed.length > 0 && !saving;

  const handleSave = async (): Promise<void> => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit(trimmed);
    } catch (err) {
      setError((err as Error).message || '儲存失敗，請稍後再試');
      setSaving(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.accentStrip} />
        <View style={styles.handle} />
        <Text style={styles.title}>先取個暱稱吧</Text>
        <Text style={styles.subtitle}>
          領取你分享優惠券的人會看到這個暱稱，不會看到你的電話號碼。
        </Text>
        <TextInput
          testID="nickname-input"
          style={styles.input}
          value={value}
          onChangeText={setValue}
          placeholder="例如：揪好康的阿明"
          placeholderTextColor={colors.muted}
          maxLength={MAX_NICKNAME_LEN}
          autoFocus
        />
        {error ? (
          <Text testID="nickname-error" style={styles.errorText}>
            {error}
          </Text>
        ) : null}
        <View style={styles.btnWrapper}>
          {canSave && <View style={styles.btnShadow} />}
          <Pressable
            testID="nickname-save-btn"
            onPress={() => {
              void handleSave();
            }}
            disabled={!canSave}
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          >
            <Text style={[styles.saveBtnText, !canSave && styles.saveBtnTextDisabled]}>
              {saving ? '儲存中…' : '儲存並分享'}
            </Text>
          </Pressable>
        </View>
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
    paddingHorizontal: 16,
    paddingBottom: 32,
    overflow: 'hidden',
  },
  accentStrip: {
    height: 6,
    backgroundColor: colors.yellow,
    marginHorizontal: -16,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 14,
    marginBottom: 16,
  },
  title: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 18,
    color: colors.fg,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 19,
    marginBottom: 16,
  },
  input: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    color: colors.fg,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  errorText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 12,
    color: colors.red,
    marginTop: 8,
  },
  btnWrapper: {
    position: 'relative',
    marginTop: 16,
  },
  btnShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: -3,
    bottom: -3,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  saveBtn: {
    backgroundColor: colors.yellow,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#ddd',
    borderColor: colors.subtle,
  },
  saveBtnText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
    color: colors.fg,
  },
  saveBtnTextDisabled: {
    color: colors.muted,
  },
});
