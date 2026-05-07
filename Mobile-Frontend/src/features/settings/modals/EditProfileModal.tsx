import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import BottomSheet from '@/src/components/ui/BottomSheet';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';

interface EditProfileModalProps {
  visible: boolean;
  name: string;
  email: string;
  phone: string;
  onSave: (name: string, email: string, phone: string) => void;
  onClose: () => void;
}

function FieldRow({
  label,
  value,
  onChangeText,
  keyboardType,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? 'default'}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
      />
    </View>
  );
}

export default function EditProfileModal({
  visible,
  name,
  email,
  phone,
  onSave,
  onClose,
}: EditProfileModalProps): React.JSX.Element {
  const [n, setN] = useState(name);
  const [e, setE] = useState(email);
  const [p, setP] = useState(phone);

  function handleSave() {
    onSave(n, e, p);
    onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.sheet}>
          <View style={styles.accentStrip} />
          <View style={styles.dragHandle} />
          <ScrollView>
            <Text style={styles.title}>編輯個人資料</Text>
            <FieldRow label="顯示名稱" value={n} onChangeText={setN} />
            <FieldRow
              label="電子信箱"
              value={e}
              onChangeText={setE}
              keyboardType="email-address"
            />
            <FieldRow
              label="手機號碼"
              value={p}
              onChangeText={setP}
              keyboardType="phone-pad"
              placeholder="+886 9xx-xxx-xxx"
            />
            <View style={styles.saveBtnWrapper}>
              <View style={styles.saveBtnShadow} />
              <Pressable style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>儲存</Text>
              </Pressable>
            </View>
          </ScrollView>
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
    marginTop: 0,
  },
  dragHandle: {
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
    marginBottom: 16,
  },
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 5,
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
  saveBtnWrapper: {
    position: 'relative',
    marginTop: 8,
  },
  saveBtnShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: '100%',
    height: '100%',
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
  saveBtnText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 15,
    color: colors.fg,
  },
});
