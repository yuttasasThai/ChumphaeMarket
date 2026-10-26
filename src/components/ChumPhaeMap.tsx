import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Store, Navigation, MapPin } from 'lucide-react';

interface ChumPhaeMapProps {
  storeLat: number;
  storeLng: number;
  customerLat?: number;
  customerLng?: number;
  routeGeometry?: [number, number][];
  onLocationSelect: (lat: number, lng: number) => void;
  readOnly?: boolean;
}

// Custom icons using clean SVG divIcons to avoid missing png assets
const createStoreIcon = () =>
  L.divIcon({
    className: 'custom-map-icon',
    html: `
      <div style="background-color: #dc2626; color: white; border: 3px solid #fef08a; border-radius: 9999px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3); transform: translate(-50%, -50%); cursor: pointer;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
          <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
          <path d="M2 7h20"/>
        </svg>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

const createCustomerIcon = () =>
  L.divIcon({
    className: 'custom-map-icon',
    html: `
      <div style="background-color: #2563eb; color: white; border: 3px solid white; border-radius: 9999px; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.35); transform: translate(-50%, -50%); cursor: grab;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });

export const ChumPhaeMap: React.FC<ChumPhaeMapProps> = ({
  storeLat,
  storeLng,
  customerLat,
  customerLng,
  routeGeometry,
  onLocationSelect,
  readOnly = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const customerMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = customerLat || storeLat;
    const initialLng = customerLng || storeLng;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 14,
      zoomControl: true,
    });

    // High quality OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors | ขายถูกที่นี่ชุมแพ',
      maxZoom: 19,
    }).addTo(map);

    // Store marker with popup
    const storeMarker = L.marker([storeLat, storeLng], {
      icon: createStoreIcon(),
      zIndexOffset: 1000,
    }).addTo(map);

    storeMarker.bindPopup(`
      <div style="font-family: 'Prompt', sans-serif; padding: 4px; text-align: center;">
        <strong style="color: #dc2626; font-size: 14px;">🏪 ร้านขายถูกที่นี่ชุมแพ</strong><br/>
        <span style="font-size: 12px; color: #4b5563;">พิกัด: ${storeLat.toFixed(6)}, ${storeLng.toFixed(6)}</span><br/>
        <span style="font-size: 11px; color: #16a34a; font-weight: 600;">จุดเริ่มต้นจัดส่งสินค้าเดลิเวอรี่</span>
      </div>
    `);

    // Radius circle for local Chum Phae delivery zone (8 km)
    L.circle([storeLat, storeLng], {
      radius: 8000,
      color: '#ef4444',
      weight: 1,
      fillColor: '#fecaca',
      fillOpacity: 0.1,
      dashArray: '4, 4',
    }).addTo(map);

    // Map click handler for selecting delivery pin
    if (!readOnly) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      });
    }

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update customer marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (customerLat && customerLng) {
      if (customerMarkerRef.current) {
        customerMarkerRef.current.setLatLng([customerLat, customerLng]);
      } else {
        const marker = L.marker([customerLat, customerLng], {
          icon: createCustomerIcon(),
          draggable: !readOnly,
        }).addTo(map);

        if (!readOnly) {
          marker.on('dragend', () => {
            const pos = marker.getLatLng();
            onLocationSelect(pos.lat, pos.lng);
          });
        }

        marker.bindPopup(`
          <div style="font-family: 'Prompt', sans-serif; padding: 4px; text-align: center;">
            <strong style="color: #2563eb; font-size: 13px;">📍 จุดรับสินค้าของคุณ</strong><br/>
            <span style="font-size: 11px; color: #4b5563;">ลากหมุดเพื่อปรับตำแหน่งได้</span>
          </div>
        `);

        customerMarkerRef.current = marker;
      }
    } else if (customerMarkerRef.current) {
      customerMarkerRef.current.remove();
      customerMarkerRef.current = null;
    }
  }, [customerLat, customerLng, readOnly, onLocationSelect]);

  // Update route geometry polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }

    if (routeGeometry && routeGeometry.length > 1) {
      const polyline = L.polyline(routeGeometry, {
        color: '#2563eb',
        weight: 5,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: undefined,
      }).addTo(map);

      routePolylineRef.current = polyline;

      // Fit bounds to show both store and customer destination
      const bounds = L.latLngBounds([
        [storeLat, storeLng],
        [customerLat || storeLat, customerLng || storeLng],
        ...routeGeometry,
      ]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [routeGeometry, storeLat, storeLng, customerLat, customerLng]);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('อุปกรณ์ของคุณไม่รองรับการระบุพิกัด GPS');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onLocationSelect(latitude, longitude);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 15);
        }
      },
      (error) => {
        console.warn('Geolocation error:', error);
        alert('ไม่สามารถดึงพิกัดปัจจุบันได้ กรุณากดเลือกจุดบนแผนที่โดยตรง');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleResetToStore = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([storeLat, storeLng], 14);
    }
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-amber-200 shadow-inner bg-amber-50/50">
      <div ref={mapContainerRef} className="w-full h-72 sm:h-80 z-0" />

      {/* Control Buttons Overlay */}
      {!readOnly && (
        <div className="absolute top-3 right-3 z-400 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleGetCurrentLocation}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/95 text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg shadow-md backdrop-blur-sm transition-all active:scale-95 cursor-pointer"
            title="ใช้พิกัดตำแหน่งปัจจุบัน"
          >
            <Navigation className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
            พิกัดฉันตอนนี้
          </button>
          <button
            type="button"
            onClick={handleResetToStore}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/95 text-stone-700 hover:bg-stone-50 border border-stone-200 rounded-lg shadow-md backdrop-blur-sm transition-all active:scale-95 cursor-pointer"
            title="ซูมกลับไปที่พิกัดร้านค้าชุมแพ"
          >
            <Store className="w-3.5 h-3.5 text-red-600" />
            ดูหน้าร้าน
          </button>
        </div>
      )}

      {/* Tip Banner */}
      {!readOnly && (
        <div className="absolute bottom-2 left-2 right-2 z-400 pointer-events-none">
          <div className="bg-stone-900/80 backdrop-blur-md text-amber-200 text-xs px-3 py-1.5 rounded-xl shadow-lg flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
              คลิกหรือลากหมุดบนแผนที่เพื่อระบุจุดส่งของในเขตชุมแพ
            </span>
            <span className="text-[10px] text-stone-300 hidden sm:inline">
              ร้าน: {storeLat.toFixed(4)}, {storeLng.toFixed(4)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
