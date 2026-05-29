import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../theme/colors';

interface TicketIconProps {
  size?: number;
  color?: string;
}

export default function TicketIcon({
  size = 24,
  color = colors.fg,
}: TicketIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 8V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a2 2 0 0 0 0 4v2a2 2 0 0 0 0 4v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a2 2 0 0 0 0-4V12a2 2 0 0 0 0-4Z"
        fill={colors.yellow}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M12 5v14"
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray="2 2"
      />
    </Svg>
  );
}
