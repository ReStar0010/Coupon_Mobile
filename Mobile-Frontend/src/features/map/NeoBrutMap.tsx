import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { MapStyleElement, Region } from 'react-native-maps';

const CUSTOM_MAP_STYLE: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#E8E3D8' }] },
  { elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#F2EDE3' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#C4BEAF' }] },
  { featureType: 'water', stylers: [{ color: '#D4CFC0' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

const INITIAL_REGION: Region = {
  latitude: 25.0478,
  longitude: 121.5318,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export interface NeoBrutMapHandle {
  /** Smoothly pan the camera to a region. Used by the locate-me button. */
  animateToRegion: (region: Region, durationMs?: number) => void;
}

interface NeoBrutMapProps {
  children?: React.ReactNode;
  /** Render the native blue "you are here" dot (requires location permission). */
  showsUserLocation?: boolean;
}

const NeoBrutMap = forwardRef<NeoBrutMapHandle, NeoBrutMapProps>(
  ({ children, showsUserLocation = false }, ref) => {
    const mapRef = useRef<MapView | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        animateToRegion: (region, durationMs = 600) => {
          mapRef.current?.animateToRegion(region, durationMs);
        },
      }),
      [],
    );

    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        customMapStyle={CUSTOM_MAP_STYLE}
        showsCompass={false}
        showsTraffic={false}
        showsIndoors={false}
        showsBuildings={false}
        rotateEnabled={false}
        pitchEnabled={false}
        showsUserLocation={showsUserLocation}
        showsMyLocationButton={false}
      >
        {children}
      </MapView>
    );
  },
);

NeoBrutMap.displayName = 'NeoBrutMap';

export default NeoBrutMap;

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});
