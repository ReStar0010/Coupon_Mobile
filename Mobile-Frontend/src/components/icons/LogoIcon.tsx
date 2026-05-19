import React from 'react';
import Svg, { Path, Line, Circle } from 'react-native-svg';

interface LogoIconProps {
  size?: number;
}

const ORANGE = '#FFAD31';
const DARK = '#333333';

/**
 * Recreated as inline SVG (mirrors assets/adaptive-icon.png) so the icon scales
 * crisply at any size and avoids the runtime cost of decoding a raster.
 *
 * Composition: orange C-arc (top-left) + dark diagonal slash + dark filled
 * circle with an orange dot (bottom-right).
 */
export default function LogoIcon({ size = 36 }: LogoIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Orange C-arc — center (~29, 34), radius 20, opening on the right */}
      <Path
        d="M 42 19 A 20 20 0 1 0 42 49"
        fill="none"
        stroke={ORANGE}
        strokeWidth={14}
        strokeLinecap="round"
      />
      {/* Diagonal slash — top-right to bottom-left */}
      <Line x1={76} y1={14} x2={24} y2={86} stroke={DARK} strokeWidth={15} strokeLinecap="round" />
      {/* Bottom-right filled circle */}
      <Circle cx={70} cy={70} r={21} fill={DARK} />
      {/* Orange dot inside the circle */}
      <Circle cx={70} cy={70} r={9} fill={ORANGE} />
    </Svg>
  );
}
