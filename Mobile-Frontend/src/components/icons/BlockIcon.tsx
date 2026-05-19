import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../../theme/colors';

interface BlockIconProps {
  size?: number;
  color?: string;
  strokeColor?: string;
}

export default function BlockIcon({
  size = 18,
  color = colors.fg,
  strokeColor = colors.border,
}: BlockIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx={12}
        cy={12}
        r={9}
        fill="none"
        stroke={strokeColor}
        strokeWidth={2.4}
      />
      <Path
        d="M6 6 L18 18"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}
