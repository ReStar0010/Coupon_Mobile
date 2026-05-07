import React from 'react';
import Svg, { Path, Line, Circle } from 'react-native-svg';

interface LogoIconProps {
  size?: number;
}

export default function LogoIcon({ size = 36 }: LogoIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* C arc — center (29,34), radius 20, gap ±49° from right */}
      <Path
        d="M 42 19 A 20 20 0 1 0 42 49"
        fill="none"
        stroke="#FFAD31"
        strokeWidth={14}
        strokeLinecap="round"
      />
      {/* Diagonal bar */}
      <Line
        x1={76}
        y1={14}
        x2={24}
        y2={86}
        stroke="#333333"
        strokeWidth={15}
        strokeLinecap="round"
      />
      {/* Outer ring */}
      <Circle cx={70} cy={70} r={21} fill="#333333" />
      {/* Inner dot */}
      <Circle cx={70} cy={70} r={9} fill="#FFAD31" />
    </Svg>
  );
}
