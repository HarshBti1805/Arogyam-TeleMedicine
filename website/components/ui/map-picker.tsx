"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Search, MapPin, Loader2, LocateFixed } from "lucide-react";
import "leaflet/dist/leaflet.css";

/**
 * MapPicker - lets a doctor pick their clinic / workplace location on a
 * Leaflet + OpenStreetMap map. Address geocoding uses Nominatim (free, no key).
 *
 * Calls onChange whenever the user picks a new spot.
 */

export interface MapPickerValue {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  country?: string;
}

interface Props {
  value?: MapPickerValue | null;
  onChange: (v: MapPickerValue) => void;
  defaultCenter?: { lat: number; lng: number };
  height?: number;
}

// Lazy-load react-leaflet only on the client (SSR-incompatible).
const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), {
  ssr: false,
});

// Inner component that hooks into the map (must be inside MapContainer).
const MapEvents = dynamic(
  async () => {
    const { useMapEvents, useMap } = await import("react-leaflet");
    const Comp = ({
      onPick,
      flyTo,
    }: {
      onPick: (lat: number, lng: number) => void;
      flyTo: { lat: number; lng: number } | null;
    }) => {
      const map = useMap();
      useMapEvents({
        click(e) {
          onPick(e.latlng.lat, e.latlng.lng);
        },
      });
      // pan whenever flyTo changes
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useEffect(() => {
        if (flyTo) map.flyTo([flyTo.lat, flyTo.lng], 14, { duration: 0.6 });
      }, [flyTo, map]);
      return null;
    };
    return Comp;
  },
  { ssr: false }
);

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
}

async function geocodeSearch(q: string): Promise<NominatimResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(
    q
  )}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return [];
  return res.json();
}

async function reverseGeocode(
  lat: number,
  lng: number
): Promise<NominatimResult | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  return res.json();
}

export function MapPicker({
  value,
  onChange,
  defaultCenter = { lat: 28.6139, lng: 77.209 }, // New Delhi as friendly default
  height = 320,
}: Props) {
  const [icon, setIcon] = useState<any>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const debounceRef = useRef<number | null>(null);

  // Build a Leaflet icon on the client (avoids SSR issues with default icon URLs).
  useEffect(() => {
    (async () => {
      const L = (await import("leaflet")).default;
      const icn = L.icon({
        iconUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });
      setIcon(icn);
    })();
  }, []);

  const center = useMemo(() => {
    if (value)
      return { lat: value.latitude, lng: value.longitude } as const;
    return defaultCenter;
  }, [value, defaultCenter]);

  const handlePick = async (lat: number, lng: number) => {
    onChange({
      latitude: lat,
      longitude: lng,
      address: value?.address,
      city: value?.city,
      country: value?.country,
    });
    const r = await reverseGeocode(lat, lng);
    if (r) {
      onChange({
        latitude: lat,
        longitude: lng,
        address: r.display_name,
        city: r.address?.city || r.address?.town || r.address?.village,
        country: r.address?.country,
      });
    }
  };

  const handleSearchChange = (q: string) => {
    setQuery(q);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (q.trim().length < 3) {
      setResults([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const r = await geocodeSearch(q);
        setResults(r);
      } finally {
        setSearching(false);
      }
    }, 350);
  };

  const handleSelectResult = (r: NominatimResult) => {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    setFlyTo({ lat, lng });
    setResults([]);
    setQuery(r.display_name);
    onChange({
      latitude: lat,
      longitude: lng,
      address: r.display_name,
      city: r.address?.city || r.address?.town || r.address?.village,
      country: r.address?.country,
    });
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setFlyTo({ lat, lng });
        handlePick(lat, lng);
      },
      () => {
        /* ignore */
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search clinic / hospital / address"
          className="w-full pl-12 pr-12 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-neutral-400 focus:border-neutral-500 outline-none bg-white text-neutral-900 placeholder:text-neutral-400"
        />
        <button
          type="button"
          onClick={handleUseMyLocation}
          title="Use my current location"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg text-neutral-500 hover:bg-neutral-100"
        >
          {searching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LocateFixed className="w-4 h-4" />
          )}
        </button>

        {results.length > 0 && (
          <div className="absolute left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden" style={{ zIndex: 2000 }}>
            {results.map((r, i) => (
              <button
                key={`${r.lat}-${r.lon}-${i}`}
                type="button"
                onClick={() => handleSelectResult(r)}
                className="w-full text-left px-4 py-2 hover:bg-neutral-100 text-sm text-neutral-700 flex items-start gap-2"
              >
                <MapPin className="w-4 h-4 mt-0.5 text-neutral-400 shrink-0" />
                <span className="line-clamp-2">{r.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className="rounded-xl overflow-hidden border border-neutral-300"
        style={{ height }}
      >
        <MapContainer
          // @ts-expect-error - react-leaflet typings
          center={[center.lat, center.lng]}
          zoom={value ? 14 : 12}
          style={{ width: "100%", height: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            // @ts-expect-error - leaflet typing
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {value && icon && (
            <Marker
              // @ts-expect-error - leaflet typing
              position={[value.latitude, value.longitude]}
              icon={icon}
            />
          )}
          <MapEvents onPick={handlePick} flyTo={flyTo} />
        </MapContainer>
      </div>

      {value && (
        <div className="text-xs text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-lg p-2">
          <div className="font-medium text-neutral-800">Selected location</div>
          {value.address && <div className="mt-1">{value.address}</div>}
          <div className="mt-1 text-neutral-500">
            {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
          </div>
        </div>
      )}
      <p className="text-xs text-neutral-500">
        Click anywhere on the map to drop a pin, or search for an address above.
      </p>
    </div>
  );
}

export default MapPicker;
