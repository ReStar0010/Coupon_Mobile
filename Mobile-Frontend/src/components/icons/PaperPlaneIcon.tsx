import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../theme/colors';

interface PaperPlaneIconProps {
  size?: number;
  color?: string;
}

export default function PaperPlaneIcon({
  size = 24,
  color = colors.fg,
}: PaperPlaneIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 2L11 13"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M22 2L15 22L11 13L2 9L22 2Z"
        fill={color}
        stroke={color}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
