import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../theme/colors';

interface GemIconProps {
  size?: number;
  color?: string;
}

export default function GemIcon({
  size = 24,
  color = colors.purple,
}: GemIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6 3 L18 3 L22 9 L12 22 L2 9 Z"
        fill={color}
        stroke={colors.border}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path
        d="M6 3 L9 9 L2 9 M18 3 L15 9 L22 9 M9 9 L15 9 L12 22"
        stroke={colors.border}
        strokeWidth={1}
        fill="none"
      />
      <Path d="M9 9 L12 3 L15 9 Z" fill="rgba(255,255,255,0.32)" />
    </Svg>
  );
}
