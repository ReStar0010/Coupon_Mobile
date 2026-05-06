import React from 'react';
import Svg, { Path, Line, Circle } from 'react-native-svg';

interface LogoIconProps {
  size?: number;
  color?: string;
}

export default function LogoIcon({ size = 36 }: LogoIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d="M 46 8 A 24 24 0 1 0 8 44"
        fill="none"
        stroke="#FFAD31"
        strokeWidth={17}
        strokeLinecap="round"
      />
      <Line
        x1={76}
        y1={14}
        x2={24}
        y2={86}
        stroke="#333333"
        strokeWidth={16}
        strokeLinecap="round"
      />
      <Circle cx={70} cy={70} r={22} fill="#333333" />
      <Circle cx={70} cy={70} r={10} fill="#FFAD31" />
    </Svg>
  );
}
