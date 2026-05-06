import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Modal, TouchableWithoutFeedback,
} from 'react-native';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';

interface BlockStoreModalProps {
  visible: boolean;
  store: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function BlockStoreModal({
  visible, store, onConfirm, onClose,
}: BlockStoreModalProps): React.JSX.Element {
  const [blocked, setBlocked] = useState(false);

  const handleConfirm = () => {
    setBlocked(true);
    onConfirm();
  };

  const handleClose = () => {
    setBlocked(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {blocked ? (
          <View style={styles.doneContainer}>
            <Text style={styles.checkmark}>🚫</Text>
            <Text style={styles.doneTitle}>已封鎖</Text>
            <Text style={styles.doneSub}>「{store}」已從地圖和搜尋中移除。</Text>
            <Pressable onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>關閉</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.title}>封鎖此商家？</Text>
            <Text style={styles.body}>
              封鎖後，「<Text style={styles.storeName}>{store}</Text>」將不會出現在 CouMap 和搜尋結果中。
            </Text>
            <Text style={styles.hint}>你可以隨時在設定 → 封鎖商家 中解除封鎖。</Text>
            <View style={styles.btnRow}>
              <Pressable onPress={handleClose} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>取消</Text>
              </Pressable>
              <Pressable onPress={handleConfirm} style={styles.confirmBtn}>
                <Text style={styles.confirmBtnText}>封鎖</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderWidth: 3, borderBottomWidth: 0, borderColor: colors.border,
    padding: 20, paddingBottom: 36,
    shadowColor: colors.border, shadowOffset: { width: 0, height: -6 }, shadowOpacity: 1, shadowRadius: 0,
  },
  handle: { width: 40, height: 5, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontFamily: fontFamilies.bold, fontSize: 18, color: colors.fg, marginBottom: 6 },
  body: { fontFamily: fontFamilies.regular, fontSize: 13, color: colors.muted, marginBottom: 6, lineHeight: 20 },
  storeName: { fontFamily: fontFamilies.bold, color: colors.fg },
  hint: { fontFamily: fontFamilies.regular, fontSize: 12, color: colors.muted, marginBottom: 22 },
  btnRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, padding: 13, backgroundColor: colors.card,
    borderWidth: 2, borderColor: colors.border, borderRadius: 6, alignItems: 'center',
    shadowColor: colors.border, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0,
  },
  cancelBtnText: { fontFamily: fontFamilies.bold, fontSize: 14, color: colors.fg },
  confirmBtn: {
    flex: 1, padding: 13, backgroundColor: colors.fg,
    borderWidth: 2, borderColor: colors.border, borderRadius: 6, alignItems: 'center',
    shadowColor: colors.border, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0,
  },
  confirmBtnText: { fontFamily: fontFamilies.bold, fontSize: 14, color: colors.bg },
  doneContainer: { alignItems: 'center', paddingVertical: 8 },
  checkmark: { fontSize: 32, marginBottom: 8 },
  doneTitle: { fontFamily: fontFamilies.bold, fontSize: 17, color: colors.fg, marginBottom: 6 },
  doneSub: { fontFamily: fontFamilies.regular, fontSize: 13, color: colors.muted, textAlign: 'center', marginBottom: 20 },
  closeBtn: {
    width: '100%', padding: 13, backgroundColor: colors.yellow,
    borderWidth: 2, borderColor: colors.border, borderRadius: 6, alignItems: 'center',
  },
  closeBtnText: { fontFamily: fontFamilies.bold, fontSize: 14, color: colors.fg },
});
