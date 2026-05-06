import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';

interface BaseModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export default function BaseModal({
  visible,
  onClose,
  children,
  title,
}: BaseModalProps): React.JSX.Element {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose} accessible={false}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      <View style={styles.centeredView} pointerEvents="box-none">
        <View
          testID="base-modal"
          accessible
          accessibilityViewIsModal
          style={styles.modal}
        >
          <View style={styles.header}>
            {title !== undefined && (
              <Text style={styles.title}>{title}</Text>
            )}
            <View style={styles.closeBtnWrapper}>
              <View style={styles.closeBtnShadow} />
              <Pressable
                testID="modal-close-btn"
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close modal"
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowOffset: { width: 5, height: 5 },
    shadowColor: colors.border,
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    color: colors.fg,
    flex: 1,
  },
  closeBtnWrapper: {
    position: 'relative',
    width: 32,
    height: 32,
  },
  closeBtnShadow: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    color: colors.fg,
  },
});
