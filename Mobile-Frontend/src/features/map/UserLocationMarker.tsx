import React, { useEffect, useRef, useState } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import Svg, { G, Path, Circle } from 'react-native-svg';
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
// Platform split:
//   Android — Marker `rotation` prop rotates the whole bitmap at the Google
//             Maps SDK level. `tracksViewChanges={false}` is fine.
//   iOS    — MapKit's `rotation` prop does NOT work on custom-view markers
//             (only on `image` markers). We rotate the SVG cone via an SVG
//             `<G transform="rotate(…)">` instead and keep
//             `tracksViewChanges` briefly true so MapKit re-snapshots the
//             bitmap. Heading updates are throttled to ≥1° deltas (see
//             ./heading.ts), so re-snapshots happen at most a few times per
//             second — well below the 10 Hz that caused the old flicker bug.
function UserLocationMarker({ coordinate, heading }: UserLocationMarkerProps): React.JSX.Element {
  const rotation = heading ?? 0;
  const isIOS = Platform.OS === 'ios';

  // On iOS we re-snapshot the marker bitmap after each heading change.
  // Flip tracksViewChanges true, let MapKit capture the new SVG, then
  // disable again so the bitmap is static between updates.
  const [tracksViewChanges, setTracksViewChanges] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isIOS) return;
    setTracksViewChanges(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setTracksViewChanges(false), 150);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [rotation, isIOS]);

  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      flat
      rotation={isIOS ? 0 : rotation}
      tracksViewChanges={tracksViewChanges}
    >
      <View testID="user-location-marker" style={styles.wrap}>
        <Svg width={44} height={44} viewBox="0 0 44 44">
          {heading !== null && (
            <G transform={isIOS ? `rotate(${rotation}, 22, 22)` : undefined}>
              <Path
                d="M22 4 L30 18 L14 18 Z"
                fill={colors.yellow}
                stroke={colors.border}
                strokeWidth={2}
                strokeLinejoin="round"
              />
            </G>
          )}
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
