"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";
import type { Icon, Map as LeafletMap } from "leaflet";
import { useRouter } from "next/navigation";
import { devLog } from "@/app/utils/devLogger";

// Define types for the props and store data
type MapComponentProps = {
  stores?: Store[];
  onStoreSelect?: (storeId: number) => void;
  className?: string;
  setStoreSearch?: (storeName: string) => void; // Add new prop for direct search update
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

// Default center (can be set to a default location like Taipei city center)
const defaultCenter = {
  lat: 25.033,
  lng: 121.5654,
};

const containerStyle = {
  width: "100%",
  height: "100%",
  borderRadius: "12px",
};

// No Google Maps dependency; using OSM via Leaflet

const MapComponent: React.FC<MapComponentProps> = ({
  stores = [],
  onStoreSelect,
  className = "",
  setStoreSearch,
}) => {
  const router = useRouter();
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const mapRef = useRef<LeafletMap | null>(null);

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          setUserLocation(userPos);
          setMapCenter(userPos); // Center map on user location
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("無法獲取位置，請手動選擇商店或重新開啟定位服務");
        },
      );
    } else {
      devLog("Geolocation is not supported by this browser.");
    }
  }, []);

  // Clicking on map closes popup (handled via MapContainer onClick)

  const onMarkerClick = (store: Store) => {
    setSelectedStore(store);
  };

  const navigateToCoupons = (storeId: number, storeName: string) => {
    // Use direct setter function if provided, otherwise use URL navigation as fallback
    if (setStoreSearch) {
      setStoreSearch(storeName);
      // We don't need to change the URL in this case - just update the search text
    } else {
      // Fallback to the old method
      router.push(`/EasyUse?search=${encodeURIComponent(storeName)}`);
    }
  };

  const handleMapReady = (map: LeafletMap) => {
    mapRef.current = map;
  };

  // Define marker icons
  const markerIconActive: Icon | undefined = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    // Dynamic import to avoid SSR window reference
    const L = require("leaflet") as typeof import("leaflet");
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
        <path
          d="M172.268 501.67C26.97 291.031 0 269.413 0 192 
            0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 
            99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0z
            M192 272c44.183 0 80-35.817 80-80s-35.817-80-80-80-80 
            35.817-80 80 35.817 80 80 80z"
          fill="black"
        />
        <path
          d="M172.268 501.67C26.97 291.031 0 269.413 0 192 
            0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 
            99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0z
            M192 272c44.183 0 80-35.817 80-80s-35.817-80-80-80-80 
            35.817-80 80 35.817 80 80 80z"
          fill="#FFAD31"
          transform="scale(0.92) translate(16, 20)"
          stroke="black"
          stroke-width="30" 
        />
      </svg>`;
    return L.icon({
      iconUrl: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      iconSize: [30, 40],
      iconAnchor: [15, 40],
      className: "store-marker-icon",
    });
  }, []);

  const userIcon: Icon | undefined = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const L = require("leaflet") as typeof import("leaflet");
    return L.icon({
      iconUrl: "/user-location.svg",
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      className: "user-marker-icon",
    });
  }, []);

  // Redesigned Popup content
  const PopupContent: React.FC<{ store: Store }> = ({ store }) => (
    <div className="bg-white rounded-xl shadow-lg font-sans w-52">
      {/* Header with store name and coupon count */}
      <div className="p-3 border-b border-gray-200">
        <h3 className="font-bold text-lg text-gray-800 truncate">
          {store.name}
        </h3>
        {store.address && (
          <p className="text-xs text-gray-500 mt-1 truncate">{store.address}</p>
        )}
      </div>

      {/* Body with coupon info */}
      <div className="p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">可使用優惠</span>
          <span className="font-bold text-act-yellow bg-sec-black rounded-full px-2.5 py-0.5 text-xs">
            {store.active_coupon_count || 0}
          </span>
        </div>
      </div>

      {/* Footer with CTA button */}
      <div className="p-3 bg-gray-50 rounded-b-xl">
        <button
          className="w-full bg-act-yellow text-sec-black py-2 px-4 rounded-lg font-semibold text-sm text-center transition-transform transform hover:scale-105 active:scale-95"
          onClick={(e) => {
            e.stopPropagation();
            navigateToCoupons(store.id, store.name);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            navigateToCoupons(store.id, store.name);
          }}
          role="button"
          aria-label={`查看 ${store.name} 的優惠`}
        >
          查看店家優惠
        </button>
      </div>
    </div>
  );

  // Close popup on map clicks
  const MapClickHandler: React.FC = () => {
    useMapEvents({
      click: () => setSelectedStore(null),
    });
    return null;
  };

  return (
    <div
      className={`w-full h-full relative rounded-xl overflow-hidden ${className}`}
    >
      <style>{`
        .custom-popup .leaflet-popup-content-wrapper {
          background: transparent;
          padding: 0;
          box-shadow: none;
        }
        .custom-popup .leaflet-popup-content {
          margin: 0;
        }
        .custom-popup .leaflet-popup-tip-container {
          display: none;
        }
        .leaflet-rounded {
          border-radius: 12px;
        }
      `}</style>
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={15}
        style={containerStyle}
        ref={mapRef as React.RefObject<LeafletMap>}
        zoomControl={true}
        scrollWheelZoom={true}
        attributionControl={true}
        className="leaflet-rounded"
      >
        <MapClickHandler />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* User location marker */}
        {userLocation && userIcon && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={userIcon}
            zIndexOffset={1000}
          />
        )}

        {/* Custom locate user button */}
        <div className="absolute top-5 right-5 z-[1000] pointer-events-auto">
          <button
            className="bg-act-yellow rounded-full p-3 shadow-md hover:scale-[1.05] transition-colors"
            onClick={() => {
              if (userLocation && mapRef.current) {
                mapRef.current.setView(
                  [userLocation.lat, userLocation.lng],
                  16,
                );
              } else if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    const userPos = {
                      lat: position.coords.latitude, // Small offset to avoid marker overlap
                      lng: position.coords.longitude,
                    };
                    setUserLocation(userPos);
                    if (mapRef.current) {
                      mapRef.current.setView([userPos.lat, userPos.lng], 16);
                    }
                  },
                  (error) => {
                    console.error("Error getting location:", error);
                  },
                );
              }
            }}
            aria-label="Locate me"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-sec-black"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>

        {/* Store markers */}
        {stores.map((store) => (
          <Marker
            key={store.id}
            position={[store.location.lat, store.location.lng]}
            icon={markerIconActive}
            eventHandlers={{ click: () => onMarkerClick(store) }}
          >
            {selectedStore?.id === store.id && (
              <Popup
                offset={[0, -10]}
                closeButton={false}
                autoPan={false}
                className="custom-popup"
              >
                <PopupContent store={store} />
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default MapComponent;
