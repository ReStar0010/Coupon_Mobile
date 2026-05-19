import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../theme/colors';

interface FlagIconProps {
  size?: number;
  color?: string;
  strokeColor?: string;
}

export default function FlagIcon({
  size = 18,
  color = colors.red,
  strokeColor = colors.border,
}: FlagIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 3 L5 21"
        stroke={strokeColor}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <Path
        d="M5 4 L18 4 L15 9 L18 14 L5 14 Z"
        fill={color}
        stroke={strokeColor}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
