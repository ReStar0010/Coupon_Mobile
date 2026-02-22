import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { devLog } from '@/app/utils/devLogger';

// Conditionally import react-native-maps only for native platforms
let MapView: any;
let Marker: any;
let Callout: any;
let Region: any;
let Location: any;

if (Platform.OS !== 'web') {
  MapView = require('react-native-maps').default;
  Marker = require('react-native-maps').Marker;
  Callout = require('react-native-maps').Callout;
  Region = require('react-native-maps').Region;
  Location = require('expo-location');
}

// Define types for the props and store data
type MapComponentProps = {
  stores?: Store[];
  onStoreSelect?: (storeId: number) => void;
  onStorePress?: (store: Store | null) => void;
  className?: string;
  setStoreSearch?: (storeName: string) => void;
  searchQuery?: string; // Add search query prop
  mapRef?: React.MutableRefObject<any>; // Expose map ref for external control
};

export type Store = {
  id: number;
  name: string;
  location: {
    lat: number;
    lng: number;
  };
  address?: string;
  active_coupon_count?: number;
  has_active_coupons?: boolean;
};

// Default center (Taipei city center)
const defaultRegion = {
  latitude: 25.033,
  longitude: 121.5654,
  latitudeDelta: 0.02, // More zoomed in (smaller value = closer zoom)
  longitudeDelta: 0.02, // More zoomed in (smaller value = closer zoom)
};

const { width, height } = Dimensions.get('window');

const LOCATION_USAGE_MESSAGE =
  'CouPro 需要存取您的位置，以在地圖上顯示您的位置、計算與店家的距離與步行時間，讓您更快找到附近的優惠券。';
const LOCATION_DENIED_MESSAGE =
  Platform.OS === 'ios'
    ? `${LOCATION_USAGE_MESSAGE}\n\n請前往「設定」>「CouPro」>「位置」，選擇「使用 App 期間」或「永遠」來開啟位置服務。`
    : `${LOCATION_USAGE_MESSAGE}\n\n請前往「設定」>「應用程式」>「CouPro」>「權限」>「位置」，選擇「允許」來開啟位置服務。`;

const MapComponent: React.FC<MapComponentProps> = ({
  stores = [],
  onStoreSelect,
  onStorePress,
  className = '',
  setStoreSearch,
  searchQuery = '', // Add searchQuery with default empty string
  mapRef: externalMapRef,
}) => {
  const router = useRouter();

  // Return a placeholder for web platform
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webPlaceholder}>
        <Text style={styles.webPlaceholderText}>地圖功能僅適用於移動設備</Text>
        <Text style={styles.webPlaceholderSubtext}>請使用手機應用程式查看商店地圖</Text>
      </View>
    );
  }

  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [mapRegion, setMapRegion] = useState<typeof defaultRegion>(defaultRegion);
  const [isMapReady, setIsMapReady] = useState(false);
  const internalMapRef = useRef<any>(null);
  const mapRef = externalMapRef || internalMapRef;

  // Get user's current location
  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('需要位置權限', LOCATION_DENIED_MESSAGE, [
            { text: '取消', style: 'cancel' },
            { text: '前往設定', onPress: () => Linking.openSettings().catch(() => {}) },
          ]);
          return;
        }

        let location = await Location.getCurrentPositionAsync({});
        const userPos = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };

        setUserLocation(userPos);
        setMapRegion({
          ...userPos,
          latitudeDelta: 0.004, // More zoomed in for user location
          longitudeDelta: 0.004, // More zoomed in for user location
        });
      } catch (error) {
        console.error('Error getting location:', error);
        Alert.alert('定位錯誤', '無法獲取當前位置，請手動選擇商店', [{ text: '確定' }]);
      }
    })();
  }, []);

  // Search functionality - center map on searched store
  useEffect(() => {
    if (searchQuery && stores.length > 0 && mapRef.current) {
      const foundStore = stores.find((store) =>
        store.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
      );

      if (foundStore) {
        devLog('Found store for search:', foundStore.name);
        const newRegion = {
          latitude: foundStore.location.lat,
          longitude: foundStore.location.lng,
          latitudeDelta: 0.01, // Zoom in closer for search results
          longitudeDelta: 0.01,
        };

        mapRef.current.animateToRegion(newRegion, 1000);
        setMapRegion(newRegion);
        setSelectedStore(foundStore); // Automatically select the found store
      }
    }
  }, [searchQuery, stores]);

  const onMarkerPress = (store: Store) => {
    setSelectedStore(store);
    onStorePress?.(store);
    onStoreSelect?.(store.id);
    // 點擊 marker 時，直接用店名填入搜尋欄，讓父層同步篩選優惠券
    setStoreSearch?.(store.name);
    // Also show an alert with the store name for immediate feedback
    // Alert.alert('店家資訊', store.name);
  };

  const onMapPress = () => {
    setSelectedStore(null);
    onStorePress?.(null);
  };

  const navigateToCoupons = (storeId: number, storeName: string) => {
    if (setStoreSearch) {
      setStoreSearch(storeName);
    } else {
      router.push(`/(tabs)/easyuse?search=${encodeURIComponent(storeName)}`);
    }
  };

  const onMapReady = useCallback(() => {
    setIsMapReady(true);
  }, []);

  const goToUserLocation = async () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.02, // More zoomed in when going to user location
          longitudeDelta: 0.02, // More zoomed in when going to user location
        },
        1000
      );
    } else {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('需要位置權限', LOCATION_DENIED_MESSAGE, [
            { text: '取消', style: 'cancel' },
            { text: '前往設定', onPress: () => Linking.openSettings().catch(() => {}) },
          ]);
          return;
        }

        let location = await Location.getCurrentPositionAsync({});
        const userPos = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };

        setUserLocation(userPos);

        if (mapRef.current) {
          mapRef.current.animateToRegion(
            {
              ...userPos,
              latitudeDelta: 0.02, // More zoomed in when getting new location
              longitudeDelta: 0.02, // More zoomed in when getting new location
            },
            1000
          );
        }
      } catch (error) {
        console.error('Error getting location:', error);
        Alert.alert('定位錯誤', '無法獲取當前位置');
      }
    }
  };

  const CustomCallout = ({ store }: { store: Store }) => (
    <Callout tooltip={true} onPress={() => navigateToCoupons(store.id, store.name)}>
      <View style={styles.calloutContainer}>
        {/* Coupon count badge */}
        <View style={styles.couponBadge}>
          <Text style={styles.couponBadgeText}>{store.active_coupon_count || 0}</Text>
        </View>

        {/* Store name - made more prominent */}
        <Text style={styles.calloutTitle}>{store.name}</Text>

        {/* Store address if available */}
        {store.address && <Text style={styles.calloutAddress}>{store.address}</Text>}

        <TouchableOpacity
          style={styles.calloutButton}
          onPress={() => navigateToCoupons(store.id, store.name)}
          activeOpacity={0.8}>
          <Text style={styles.calloutButtonText}>查看優惠券</Text>
        </TouchableOpacity>
      </View>
    </Callout>
  );

  return (
    <View style={[styles.container, { borderRadius: 12, overflow: 'hidden' }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={mapRegion}
        region={mapRegion}
        onRegionChangeComplete={setMapRegion}
        onMapReady={onMapReady}
        onPress={onMapPress}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        showsBuildings={true}
        showsTraffic={false}
        showsIndoors={true}
        loadingEnabled={true}
        mapType="standard">
        {/* User location marker (custom) */}
        {userLocation && (
          <Marker coordinate={userLocation} title="您的位置" pinColor="blue" zIndex={1000} />
        )}

        {/* Store markers */}
        {stores.map((store) => (
          <Marker
            key={store.id}
            coordinate={{
              latitude: store.location.lat,
              longitude: store.location.lng,
            }}
            title={store.name}
            description={store.address}
            pinColor="#FFAD31"
            onPress={() => onMarkerPress(store)}>
            {selectedStore?.id === store.id && <CustomCallout store={store} />}
          </Marker>
        ))}
      </MapView>

      {/* Custom locate user button - removed, will be added in parent component */}

      {!isMapReady && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
  },
  webPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    padding: 20,
  },
  webPlaceholderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 8,
  },
  webPlaceholderSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  calloutContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    position: 'relative',
  },
  couponBadge: {
    position: 'absolute',
    top: -12,
    right: -12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFAD31',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  couponBadgeText: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  calloutTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#000',
    paddingRight: 12,
  },
  calloutAddress: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
    paddingRight: 12,
  },
  calloutButton: {
    backgroundColor: '#FFAD31',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  calloutButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  locationButtonContainer: {
    position: 'absolute',
    bottom: 20, // Position at bottom right of map
    right: 20,
    zIndex: 1000,
  },
  locationButton: {
    backgroundColor: '#FFAD31',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  locationButtonText: {
    fontSize: 24,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
});

export default MapComponent;
