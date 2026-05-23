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
//
// Rotation is delivered via the Marker's NATIVE `rotation` prop, applied to
// the marker bitmap by MapKit/Google-Maps SDK directly. The inner View
// deliberately does NOT carry a `transform: rotate` — that was the
// previous implementation and it caused the iOS "marker jumps between
// center and top-left" bug. With JS-side rotation, the Marker has to
// re-rasterise its child bitmap on every heading tick (10 Hz from
// `Location.watchHeadingAsync`), and during re-rasterisation iOS briefly
// projects the marker at screen coord (0,0) before snapping back.
//
// `tracksViewChanges={false}` pins the marker bitmap as static. Heading
// updates change only the native `rotation` value — no re-rasterise, no
// flicker. The cone still rotates because MapKit re-renders the rotated
// bitmap each frame natively, which is what we wanted all along.
function UserLocationMarker({ coordinate, heading }: UserLocationMarkerProps): React.JSX.Element {
  const rotation = heading ?? 0;
  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      flat
      rotation={rotation}
      tracksViewChanges={false}
    >
      <View testID="user-location-marker" style={styles.wrap}>
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
