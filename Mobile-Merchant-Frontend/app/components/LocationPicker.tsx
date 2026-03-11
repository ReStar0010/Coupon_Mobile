import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
// import * as Sentry from '@sentry/react-native';
import WidgetErrorFallback from './WidgetErrorFallback';
import { View, Text, TouchableOpacity, Alert, StyleSheet, Platform, Linking } from 'react-native';
import { colors } from '@/constants/colors';

// Conditionally import react-native-maps only for native platforms
let MapView: any;
let Marker: any;
let Location: any;

if (Platform.OS !== 'web') {
  MapView = (require('react-native-maps') as typeof import('react-native-maps')).default;
  Marker = (require('react-native-maps') as typeof import('react-native-maps')).Marker;
  Location = require('expo-location');
}

// Default center (Taipei city center)
const defaultRegion = {
  latitude: 25.033,
  longitude: 121.5654,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

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
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(
    initialLatitude && initialLongitude
      ? { latitude: initialLatitude, longitude: initialLongitude }
      : null,
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
      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            ...newLocation,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          },
          500,
        );
      }
    }
  }, [initialLatitude, initialLongitude]);

  // Return a placeholder for web platform
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.webPlaceholder, { height }]}>
        <Text style={styles.webPlaceholderText}>地圖功能僅適用於移動設備</Text>
        <Text style={styles.webPlaceholderSubtext}>請使用手機應用程式選擇位置</Text>
      </View>
    );
  }

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
        const appName = 'CouPro 商家端';
        const locationPermissionMessage =
          Platform.OS === 'ios'
            ? `CouPro 需要存取您的位置資訊，以便自動填入您的店家位置，讓顧客能夠找到您的商店。\n\n請前往「設定」>「${appName}」>「位置」，選擇「使用 App 期間」或「永遠」來開啟位置服務。`
            : `CouPro 需要存取您的位置資訊，以便自動填入您的店家位置，讓顧客能夠找到您的商店。\n\n請前往「設定」>「應用程式」>「${appName}」>「權限」>「位置」，選擇「允許」來開啟位置服務。`;

        Alert.alert('需要位置權限', locationPermissionMessage, [
          { text: '取消', style: 'cancel' },
          {
            text: '前往設定',
            onPress: async () => {
              try {
                await Linking.openSettings();
              } catch (error) {
                console.error('Failed to open settings:', error);
              }
            },
          },
        ]);
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
          1000,
        );
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert(
        '無法獲取位置',
        '無法獲取您目前的位置。請確認您已開啟位置服務，或您也可以直接在地圖上點擊或拖動標記來選擇店家位置。',
        [{ text: '確定', style: 'default' }],
      );
    }
  };

  return (
    // <Sentry.ErrorBoundary
    //   fallback={<WidgetErrorFallback message="位置選擇器暫時無法使用" />}
    //   beforeCapture={(scope) => {
    //     scope.setTag('boundary', 'location-picker-widget');
    //     scope.setTag('boundary_type', 'widget');
    //   }}
    // >
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
    // </Sentry.ErrorBoundary>
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
