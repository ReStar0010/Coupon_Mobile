import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, { MapStyleElement } from 'react-native-maps';

const CUSTOM_MAP_STYLE: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#E8E3D8' }] },
  { elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#F2EDE3' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#C4BEAF' }] },
  { featureType: 'water', stylers: [{ color: '#D4CFC0' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

const INITIAL_REGION = {
  latitude: 25.0478,
  longitude: 121.5318,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

interface NeoBrutMapProps {
  children?: React.ReactNode;
}

export default function NeoBrutMap({ children }: NeoBrutMapProps): React.JSX.Element {
  return (
    <MapView
      style={styles.map}
      initialRegion={INITIAL_REGION}
      customMapStyle={CUSTOM_MAP_STYLE}
      showsCompass={false}
      showsTraffic={false}
      showsIndoors={false}
      showsBuildings={false}
      rotateEnabled={false}
      pitchEnabled={false}
    >
      {children}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});
