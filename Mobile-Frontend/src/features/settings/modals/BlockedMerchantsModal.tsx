import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const INIT_LIST = ['廣告商家 A', '煩人推播店 B'];

interface BlockedMerchantsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function BlockedMerchantsModal({
  visible,
  onClose,
}: BlockedMerchantsModalProps): React.JSX.Element {
  const [list, setList] = useState<string[]>(INIT_LIST);
  const [input, setInput] = useState('');

  function unblock(index: number) {
    setList(prev => prev.filter((_, i) => i !== index));
  }

  function addMerchant() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setList(prev => [...prev, trimmed]);
    setInput('');
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View testID="blocked-modal" style={[styles.sheet, { maxHeight: SCREEN_HEIGHT * 0.7 }]}>
          <View style={styles.accentStrip} />
          <View style={styles.dragHandle} />
          <Text style={styles.title}>封鎖商家</Text>
          <Text style={styles.subtitle}>
            封鎖的商家不會出現在你的 CouMap 或優惠通知中。
          </Text>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {list.length === 0 ? (
              <Text style={styles.emptyText}>尚未封鎖任何商家</Text>
            ) : (
              list.map((merchant, index) => (
                <View key={`${merchant}-${index}`} style={styles.merchantRow}>
                  <View style={styles.merchantShadow} />
                  <View style={styles.merchantCard}>
                    <Text style={styles.merchantName}>{merchant}</Text>
                    <Pressable
                      style={styles.unblockBtn}
                      onPress={() => unblock(index)}
                    >
                      <Text style={styles.unblockText}>解除</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              value={input}
              onChangeText={setInput}
              placeholder="輸入商家名稱…"
              placeholderTextColor={colors.muted}
            />
            <View style={styles.addBtnWrapper}>
              <View style={styles.addBtnShadow} />
              <Pressable style={styles.addBtn} onPress={addMerchant}>
                <Text style={styles.addBtnText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.doneBtnWrapper}>
            <View style={styles.doneBtnShadow} />
            <Pressable style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>完成</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
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
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 14,
    marginBottom: 14,
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
    marginBottom: 14,
  },
  list: {
    flexGrow: 1,
  },
  listContent: {
    paddingBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 20,
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    color: colors.muted,
  },
  merchantRow: {
    position: 'relative',
    marginBottom: 8,
  },
  merchantShadow: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: '100%',
    height: '100%',
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  merchantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 6,
  },
  merchantName: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    color: colors.fg,
    flex: 1,
  },
  unblockBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: colors.red,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 4,
  },
  unblockText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    color: '#fff',
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  addInput: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    color: colors.fg,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addBtnWrapper: {
    position: 'relative',
    width: 44,
    height: 44,
  },
  addBtnShadow: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 44,
    height: 44,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  addBtn: {
    width: 44,
    height: 44,
    backgroundColor: colors.yellow,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 20,
    color: colors.fg,
  },
  doneBtnWrapper: {
    position: 'relative',
  },
  doneBtnShadow: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: '100%',
    height: '100%',
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  doneBtn: {
    backgroundColor: colors.fg,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 5,
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: '#fff',
  },
});
