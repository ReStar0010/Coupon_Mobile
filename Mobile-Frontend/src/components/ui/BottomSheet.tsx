import React, { useEffect, useRef, useState } from 'react';
import { Modal, Animated, Pressable, StyleSheet, View } from 'react-native';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function BottomSheet({ visible, onClose, children }: BottomSheetProps) {
  const [open, setOpen] = useState(false);
  const isOpen = useRef(false);
  const backdrop = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      isOpen.current = true;
      backdrop.setValue(0);
      sheetY.setValue(600);
      setOpen(true);
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(sheetY, { toValue: 0, tension: 70, friction: 12, useNativeDriver: true }),
      ]).start();
    } else if (isOpen.current) {
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(sheetY, { toValue: 600, duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) {
          isOpen.current = false;
          setOpen(false);
        }
      });
    }
  }, [visible]);

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdrop }]}
        pointerEvents="none"
      />
      <View style={styles.container}>
        <Pressable style={styles.dismissArea} onPress={onClose} accessible={false} />
        <Animated.View style={{ transform: [{ translateY: sheetY }] }}>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
});
