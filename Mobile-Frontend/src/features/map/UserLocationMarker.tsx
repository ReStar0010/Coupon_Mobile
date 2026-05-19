import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '../../theme/colors';

interface UserLocationMarkerProps {
  coordinate: { latitude: number; longitude: number };
  /** Degrees clockwise from north. `null` means heading is unknown. */
  heading: number | null;
}

// Neo-brutalism "you are here" marker:
//   • a hard-bordered purple disc (your position)
//   • a yellow triangle cone pointing in the direction the device is facing
// `tracksViewChanges` is left at its default (true) on purpose: the rotation
// transform must propagate to the native marker bitmap on every heading
// update, otherwise the cone appears frozen. The cost is a single marker
// re-rasterise per heading tick (~10 Hz on iOS, less on Android), which is
// cheap compared to the many merchant pins around it.
function UserLocationMarker({ coordinate, heading }: UserLocationMarkerProps): React.JSX.Element {
  const rotation = heading ?? 0;
  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      flat
    >
      <View
        testID="user-location-marker"
        style={[styles.wrap, { transform: [{ rotate: `${rotation}deg` }] }]}
      >
        <Svg width={44} height={44} viewBox="0 0 44 44">
          {/* heading cone — only render when heading is known */}
          {heading !== null && (
            <Path
              d="M22 4 L30 18 L14 18 Z"
              fill={colors.yellow}
              stroke={colors.border}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          )}
          {/* the dot itself, rotation-invariant via center anchor */}
          <Circle cx={22} cy={22} r={8} fill={colors.purple} stroke={colors.border} strokeWidth={2.5} />
        </Svg>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default UserLocationMarker;
