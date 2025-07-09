import * as React from "react";
import { Svg, Circle, Path } from "react-native-svg";

interface SuccessIconProps {
  size?: number;
  color?: string;
}

export const SuccessIcon: React.FC<SuccessIconProps> = ({ 
  size = 89, 
  color = "#FFAD31" // act-yellow 的顏色值
}) => {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 89 89"
      fill="none"
    >
      <Circle cx="44.5" cy="44.5" r="44.5" fill={color} />
      <Path
        d="M34.4153 42.8999L42.7475 24C44.4049 24 45.9944 24.6637 47.1663 25.8452C48.3382 27.0267 48.9966 28.6291 48.9966 30.3V38.6999H60.7867C61.3906 38.693 61.9888 38.8186 62.5398 39.0679C63.0907 39.3172 63.5814 39.6842 63.9777 40.1437C64.3739 40.6031 64.6664 41.1439 64.8348 41.7286C65.0032 42.3133 65.0435 42.9279 64.9528 43.5299L62.0782 62.4298C61.9276 63.4312 61.423 64.3441 60.6574 65.0001C59.8918 65.6562 58.9168 66.0112 57.9121 65.9997H34.4153M34.4153 42.8999V65.9997M34.4153 42.8999H28.1661C27.0612 42.8999 26.0015 43.3424 25.2202 44.13C24.4389 44.9177 24 45.9859 24 47.0999V61.7998C24 62.9137 24.4389 63.9819 25.2202 64.7696C26.0015 65.5572 27.0612 65.9997 28.1661 65.9997H34.4153"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};