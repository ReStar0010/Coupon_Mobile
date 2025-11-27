import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, Dimensions, Platform } from 'react-native';
import { colors } from '@/constants/colors';

// Conditionally import react-native-maps only for native platforms
let MapView: any;
let Marker: any;
let Location: any;

if (Platform.OS !== 'web') {
  MapView = require('react-native-maps').default;
  Marker = require('react-native-maps').Marker;
  Location = require('expo-location');
}

// Default center (Taipei city center)
const defaultRegion = {
  latitude: 25.033,
  longitude: 121.5654,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

const { width } = Dimensions.get('window');

type LocationPickerProps = {
  initialLatitude?: number;
  initialLongitude?: number;
  onLocationSelect: (latitude: number, longitude: number) => void;
  height?: number;
};

const LocationPicker: React.FC<LocationPickerProps> = ({
  initialLatitude,
  initialLongitude,
  onLocationSelect,
  height = 300,
}) => {
  // Return a placeholder for web platform
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.webPlaceholder, { height }]}>
        <Text style={styles.webPlaceholderText}>
          地圖功能僅適用於移動設備
        </Text>
        <Text style={styles.webPlaceholderSubtext}>
          請使用手機應用程式選擇位置
        </Text>
      </View>
    );
  }

  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(
    initialLatitude && initialLongitude
      ? { latitude: initialLatitude, longitude: initialLongitude }
      : null
  );
  const [mapRegion, setMapRegion] = useState(() => {
    if (initialLatitude && initialLongitude) {
      return {
        latitude: initialLatitude,
        longitude: initialLongitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }
    return defaultRegion;
  });
  const mapRef = useRef<any>(null);

  // Update selected location when initial values change
  useEffect(() => {
    if (initialLatitude && initialLongitude) {
      const newLocation = {
        latitude: initialLatitude,
        longitude: initialLongitude,
      };
      setSelectedLocation(newLocation);
      setMapRegion({
        ...newLocation,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
      // Animate map to the location
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          ...newLocation,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }, 500);
      }
    }
  }, [initialLatitude, initialLongitude]);

  // Handle map press to select location
  const handleMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    const location = { latitude, longitude };
    setSelectedLocation(location);
    onLocationSelect(latitude, longitude);
  };

  // Handle marker drag end
  const handleMarkerDragEnd = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    const location = { latitude, longitude };
    setSelectedLocation(location);
    onLocationSelect(latitude, longitude);
  };

  // Get current location
  const getCurrentLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('需要位置權限', '請在設定中開啟位置服務');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      const userPos = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setSelectedLocation(userPos);
      onLocationSelect(userPos.latitude, userPos.longitude);

      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            ...userPos,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          },
          1000
        );
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('定位錯誤', '無法獲取當前位置');
    }
  };

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={mapRegion}
        region={mapRegion}
        onRegionChangeComplete={setMapRegion}
        onPress={handleMapPress}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        mapType="standard"
      >
        {selectedLocation && (
          <Marker
            coordinate={selectedLocation}
            draggable
            onDragEnd={handleMarkerDragEnd}
            pinColor="#FFAD31"
          />
        )}
      </MapView>

      {/* Location info display */}
      {selectedLocation && (
        <View style={styles.locationInfo}>
          <Text style={styles.locationInfoText}>
            經度: {selectedLocation.longitude.toFixed(6)}
          </Text>
          <Text style={styles.locationInfoText}>
            緯度: {selectedLocation.latitude.toFixed(6)}
          </Text>
        </View>
      )}

      {/* Get current location button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.locationButton}
          onPress={getCurrentLocation}
          activeOpacity={0.8}
        >
          <Text style={styles.locationButtonText}>📍</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  webPlaceholder: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 20,
  },
  webPlaceholderText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  webPlaceholderSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  locationInfo: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 8,
    borderRadius: 8,
    minWidth: 150,
  },
  locationInfoText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 10,
    right: 10,
  },
  locationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  locationButtonText: {
    fontSize: 20,
  },
});

export default LocationPicker;

