// import React, { useState, useEffect, useCallback, useRef } from 'react';
// import { View, Text, TouchableOpacity, Alert, StyleSheet, Dimensions } from 'react-native';
// import MapView, { Marker, Callout, Region } from 'react-native-maps';
// import * as Location from 'expo-location';
// import { useRouter } from 'expo-router';
// import { devLog } from '../utils/devLogger';

// // Define types for the props and store data
// type MapComponentProps = {
//   stores?: Store[];
//   onStoreSelect?: (storeId: number) => void;
//   className?: string;
//   setStoreSearch?: (storeName: string) => void;
// };

// export type Store = {
//   id: number;
//   name: string;
//   location: {
//     lat: number;
//     lng: number;
//   };
//   address?: string;
//   active_coupon_count?: number;
//   has_active_coupons?: boolean;
// };

// // Default center (Taipei city center)
// const defaultRegion: Region = {
//   latitude: 25.033,
//   longitude: 121.5654,
//   latitudeDelta: 0.0922,
//   longitudeDelta: 0.0421,
// };

// const { width, height } = Dimensions.get('window');

// const MapComponent: React.FC<MapComponentProps> = ({
//   stores = [],
//   onStoreSelect,
//   className = '',
//   setStoreSearch,
// }) => {
//   const router = useRouter();
//   const [selectedStore, setSelectedStore] = useState<Store | null>(null);
//   const [userLocation, setUserLocation] = useState<{
//     latitude: number;
//     longitude: number;
//   } | null>(null);
//   const [mapRegion, setMapRegion] = useState<Region>(defaultRegion);
//   const [isMapReady, setIsMapReady] = useState(false);
//   const mapRef = useRef<MapView>(null);

//   // Get user's current location
//   useEffect(() => {
//     (async () => {
//       try {
//         let { status } = await Location.requestForegroundPermissionsAsync();
//         if (status !== 'granted') {
//           Alert.alert('位置權限', '無法獲取位置權限，請在設定中開啟位置服務', [{ text: '確定' }]);
//           return;
//         }

//         let location = await Location.getCurrentPositionAsync({});
//         const userPos = {
//           latitude: location.coords.latitude,
//           longitude: location.coords.longitude,
//         };

//         setUserLocation(userPos);
//         setMapRegion({
//           ...userPos,
//           latitudeDelta: 0.0922,
//           longitudeDelta: 0.0421,
//         });
//       } catch (error) {
//         console.error('Error getting location:', error);
//         Alert.alert('定位錯誤', '無法獲取當前位置，請手動選擇商店', [{ text: '確定' }]);
//       }
//     })();
//   }, []);

//   const onMarkerPress = (store: Store) => {
//     setSelectedStore(store);
//   };

//   const onMapPress = () => {
//     setSelectedStore(null);
//   };

//   const navigateToCoupons = (storeId: number, storeName: string) => {
//     if (setStoreSearch) {
//       setStoreSearch(storeName);
//     } else {
//       router.push(`/EasyUse?search=${encodeURIComponent(storeName)}`);
//     }
//   };

//   const onMapReady = useCallback(() => {
//     setIsMapReady(true);
//   }, []);

//   const goToUserLocation = async () => {
//     if (userLocation && mapRef.current) {
//       mapRef.current.animateToRegion(
//         {
//           latitude: userLocation.latitude,
//           longitude: userLocation.longitude,
//           latitudeDelta: 0.0922,
//           longitudeDelta: 0.0421,
//         },
//         1000
//       );
//     } else {
//       try {
//         let { status } = await Location.requestForegroundPermissionsAsync();
//         if (status !== 'granted') {
//           Alert.alert('需要位置權限', '請在設定中開啟位置服務');
//           return;
//         }

//         let location = await Location.getCurrentPositionAsync({});
//         const userPos = {
//           latitude: location.coords.latitude,
//           longitude: location.coords.longitude,
//         };

//         setUserLocation(userPos);

//         if (mapRef.current) {
//           mapRef.current.animateToRegion(
//             {
//               ...userPos,
//               latitudeDelta: 0.0922,
//               longitudeDelta: 0.0421,
//             },
//             1000
//           );
//         }
//       } catch (error) {
//         console.error('Error getting location:', error);
//         Alert.alert('定位錯誤', '無法獲取當前位置');
//       }
//     }
//   };

//   const CustomCallout = ({ store }: { store: Store }) => (
//     <Callout tooltip={true} onPress={() => navigateToCoupons(store.id, store.name)}>
//       <View style={styles.calloutContainer}>
//         {/* Coupon count badge */}
//         <View style={styles.couponBadge}>
//           <Text style={styles.couponBadgeText}>{store.active_coupon_count || 0}</Text>
//         </View>

//         <Text style={styles.calloutTitle}>{store.name}</Text>

//         <TouchableOpacity
//           style={styles.calloutButton}
//           onPress={() => navigateToCoupons(store.id, store.name)}
//           activeOpacity={0.8}>
//           <Text style={styles.calloutButtonText}>查看優惠券</Text>
//         </TouchableOpacity>
//       </View>
//     </Callout>
//   );

//   return (
//     <View className={`relative h-full w-full overflow-hidden rounded-xl ${className}`}>
//       <MapView
//         ref={mapRef}
//         style={styles.map}
//         initialRegion={mapRegion}
//         region={mapRegion}
//         onRegionChangeComplete={setMapRegion}
//         onMapReady={onMapReady}
//         onPress={onMapPress}
//         showsUserLocation={true}
//         showsMyLocationButton={false}
//         showsCompass={false}
//         showsScale={false}
//         showsBuildings={true}
//         showsTraffic={false}
//         showsIndoors={true}
//         loadingEnabled={true}
//         mapType="standard">
//         {/* User location marker (custom) */}
//         {userLocation && (
//           <Marker coordinate={userLocation} title="您的位置" pinColor="blue" zIndex={1000} />
//         )}

//         {/* Store markers */}
//         {stores.map((store) => (
//           <Marker
//             key={store.id}
//             coordinate={{
//               latitude: store.location.lat,
//               longitude: store.location.lng,
//             }}
//             title={store.name}
//             description={store.address}
//             pinColor="#FFAD31"
//             onPress={() => onMarkerPress(store)}>
//             {selectedStore?.id === store.id && <CustomCallout store={store} />}
//           </Marker>
//         ))}
//       </MapView>

//       {/* Custom locate user button */}
//       <View style={styles.locationButtonContainer}>
//         <TouchableOpacity
//           style={styles.locationButton}
//           onPress={goToUserLocation}
//           activeOpacity={0.8}>
//           <Text style={styles.locationButtonText}>📍</Text>
//         </TouchableOpacity>
//       </View>

//       {!isMapReady && (
//         <View style={styles.loadingContainer}>
//           <Text style={styles.loadingText}>Loading map...</Text>
//         </View>
//       )}
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   map: {
//     width: '100%',
//     height: '100%',
//   },
//   calloutContainer: {
//     backgroundColor: 'white',
//     borderRadius: 10,
//     padding: 16,
//     minWidth: 180,
//     shadowColor: '#000',
//     shadowOffset: {
//       width: 0,
//       height: 2,
//     },
//     shadowOpacity: 0.25,
//     shadowRadius: 3.84,
//     elevation: 5,
//     position: 'relative',
//   },
//   couponBadge: {
//     position: 'absolute',
//     top: -12,
//     right: -12,
//     width: 32,
//     height: 32,
//     borderRadius: 16,
//     backgroundColor: '#FFAD31',
//     justifyContent: 'center',
//     alignItems: 'center',
//     shadowColor: '#000',
//     shadowOffset: {
//       width: 0,
//       height: 1,
//     },
//     shadowOpacity: 0.22,
//     shadowRadius: 2.22,
//     elevation: 3,
//   },
//   couponBadgeText: {
//     color: '#000',
//     fontSize: 14,
//     fontWeight: 'bold',
//   },
//   calloutTitle: {
//     fontSize: 20,
//     fontWeight: 'bold',
//     textAlign: 'center',
//     marginBottom: 12,
//     color: '#000',
//     paddingRight: 12,
//   },
//   calloutButton: {
//     backgroundColor: '#FFAD31',
//     paddingVertical: 10,
//     paddingHorizontal: 16,
//     borderRadius: 8,
//     alignItems: 'center',
//   },
//   calloutButtonText: {
//     color: '#000',
//     fontSize: 16,
//     fontWeight: 'bold',
//   },
//   locationButtonContainer: {
//     position: 'absolute',
//     top: 20,
//     right: 20,
//     zIndex: 1000,
//   },
//   locationButton: {
//     backgroundColor: '#FFAD31',
//     borderRadius: 25,
//     width: 50,
//     height: 50,
//     justifyContent: 'center',
//     alignItems: 'center',
//     shadowColor: '#000',
//     shadowOffset: {
//       width: 0,
//       height: 2,
//     },
//     shadowOpacity: 0.25,
//     shadowRadius: 3.84,
//     elevation: 5,
//   },
//   locationButtonText: {
//     fontSize: 24,
//   },
//   loadingContainer: {
//     position: 'absolute',
//     top: 0,
//     left: 0,
//     right: 0,
//     bottom: 0,
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: '#f3f4f6',
//   },
//   loadingText: {
//     fontSize: 16,
//     color: '#6b7280',
//   },
// });

// export default MapComponent;
