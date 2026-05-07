import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import BottomSheet from '../../components/ui/BottomSheet';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';

interface CoopQRModalProps {
  visible: boolean;
  slotIndex: number;
  onCancel: () => void;
  onSimulateJoin: () => void;
}

// Deterministic QR-like placeholder grid
function QRPlaceholder({ size = 168 }: { size?: number }): React.JSX.Element {
  const N = 11;
  const cell = (size - 16) / N;
  const grid = React.useRef(
    Array.from({ length: N }, (_, r) =>
      Array.from({ length: N }, (_, c) => {
        // Corner finder patterns
        if ((r < 3 && c < 3) || (r < 3 && c >= N - 3) || (r >= N - 3 && c < 3)) return true;
        // Inner data-like noise
        return (r * 13 + c * 7 + r * c) % 3 !== 0;
      }),
    ),
  ).current;

  return (
    <View style={{ padding: 8, backgroundColor: '#fff', borderRadius: 4 }}>
      {grid.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.map((filled, c) => (
            <View
              key={c}
              style={{ width: cell, height: cell, backgroundColor: filled ? '#000' : '#fff' }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export default function CoopQRModal({
  visible,
  slotIndex,
  onCancel,
  onSimulateJoin,
}: CoopQRModalProps): React.JSX.Element {
  const sessionId = React.useRef(
    `COUP-${Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .toUpperCase()
      .padStart(6, '0')}`,
  ).current;

  return (
    <BottomSheet visible={visible} onClose={onCancel}>
      <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title}>邀請加入</Text>
          <Text style={styles.subtitle}>請朋友掃描以下 QR Code 加入此局</Text>

          <View style={styles.qrWrapper}>
            <QRPlaceholder size={168} />
          </View>

          <View style={styles.sessionRow}>
            <Text style={styles.sessionLabel}>SESSION</Text>
            <Text style={styles.sessionId}>{sessionId}</Text>
          </View>

          <Text style={styles.slotHint}>玩家 #{slotIndex} 等待加入</Text>

          <Pressable style={styles.simulateBtn} onPress={onSimulateJoin}>
            <Text style={styles.simulateBtnText}>模擬加入（測試）</Text>
          </Pressable>

          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>取消邀請</Text>
          </Pressable>
        </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 24,
    paddingBottom: 44,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    marginTop: 12,
    marginBottom: 18,
  },
  title: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 20,
    color: '#fff',
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 22,
    textAlign: 'center',
  },
  qrWrapper: {
    marginBottom: 18,
    borderRadius: 8,
    overflow: 'hidden',
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  sessionLabel: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)',
  },
  sessionId: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 15,
    color: colors.yellow,
    letterSpacing: 2.5,
  },
  slotHint: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 22,
  },
  simulateBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 6,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    marginBottom: 10,
  },
  simulateBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    color: colors.fg,
  },
  cancelBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
});
