import React from 'react';
import Svg, { Circle, Text } from 'react-native-svg';
import { colors } from '../../theme/colors';

interface CoinIconProps {
  size?: number;
  color?: string;
}

export default function CoinIcon({ size = 24 }: CoinIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={10} fill={colors.yellow} stroke={colors.border} strokeWidth={2} />
      <Circle
        cx={12}
        cy={12}
        r={7}
        fill="none"
        stroke={colors.border}
        strokeWidth={1}
        strokeDasharray="2 2"
      />
      <Text
        x={12}
        y={16.5}
        textAnchor="middle"
        fontFamily="SpaceGrotesk_700Bold"
        fontSize={10}
        fontWeight="800"
        fill={colors.border}
      >
        P
      </Text>
    </Svg>
  );
}
