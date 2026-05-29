import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';

interface NeoBrutMapProps {
  children?: React.ReactNode;
}

export default function NeoBrutMap({ children: _children }: NeoBrutMapProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>地圖僅支援原生裝置</Text>
      <Text style={styles.sub}>Map is not available on web</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E8E3D8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  label: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    color: colors.fg,
    marginBottom: 4,
  },
  sub: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 12,
    color: colors.muted,
  },
});
