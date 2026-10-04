/**
 * GOOGLE MAPS FRONTEND INTEGRATION - ESSENTIAL GUIDE
 *
 * USAGE FROM PARENT COMPONENT:
 * ======
 *
 * const mapRef = useRef<google.maps.Map | null>(null);
 *
 * <MapView
 *   initialCenter={{ lat: 40.7128, lng: -74.0060 }}
 *   initialZoom={15}
 *   onMapReady={(map) => {
 *     mapRef.current = map; // Store to control map from parent anytime, google map itself is in charge of the re-rendering, not react state.
 * </MapView>
 *
 * ======
 * Available Libraries and Core Features:
 * -------------------------------
 * 📍 MARKER (from `marker` library)
 * - Attaches to map using { map, position }
 * new google.maps.marker.AdvancedMarkerElement({
 *   map,
 *   position: { lat: 37.7749, lng: -122.4194 },
 *   title: "San Francisco",
 * });
 *
 * -------------------------------
 * 🏢 PLACES (from `places` library)
 * - Does not attach directly to map; use data with your map manually.
 * const place = new google.maps.places.Place({ id: PLACE_ID });
 * await place.fetchFields({ fields: ["displayName", "location"] });
 * map.setCenter(place.location);
 * new google.maps.marker.AdvancedMarkerElement({ map, position: place.location });
 *
 * -------------------------------
 * 🧭 GEOCODER (from `geocoding` library)
 * - Standalone service; manually apply results to map.
 * const geocoder = new google.maps.Geocoder();
 * geocoder.geocode({ address: "New York" }, (results, status) => {
 *   if (status === "OK" && results[0]) {
 *     map.setCenter(results[0].geometry.location);
 *     new google.maps.marker.AdvancedMarkerElement({
 *       map,
 *       position: results[0].geometry.location,
 *     });
 *   }
 * });
 *
 * -------------------------------
 * 📐 GEOMETRY (from `geometry` library)
 * - Pure utility functions; not attached to map.
 * const dist = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
 *
 * -------------------------------
 * 🛣️ ROUTES (from `routes` library)
 * - Combines DirectionsService (standalone) + DirectionsRenderer (map-attached)
 * const directionsService = new google.maps.DirectionsService();
 * const directionsRenderer = new google.maps.DirectionsRenderer({ map });
 * directionsService.route(
 *   { origin, destination, travelMode: "DRIVING" },
 *   (res, status) => status === "OK" && directionsRenderer.setDirections(res)
 * );
 *
 * -------------------------------
 * 🌦️ MAP LAYERS (attach directly to map)
 * - new google.maps.TrafficLayer().setMap(map);
 * - new google.maps.TransitLayer().setMap(map);
 * - new google.maps.BicyclingLayer().setMap(map);
 *
 * -------------------------------
 * ✅ SUMMARY
 * - “map-attached” → AdvancedMarkerElement, DirectionsRenderer, Layers.
 * - “standalone” → Geocoder, DirectionsService, DistanceMatrixService, ElevationService.
 * - “data-only” → Place, Geometry utilities.
 */

/// <reference types="@types/google.maps" />

import { useEffect, useRef, useState } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: typeof google;
    gm_authFailure?: () => void;
  }
}

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
let mapScriptPromise: Promise<boolean> | null = null;
let mapUnavailableForSession = false;

function loadMapScript() {
  if (window.google?.maps) return Promise.resolve(true);
  if (!API_KEY) return Promise.resolve(false);
  if (mapUnavailableForSession) return Promise.resolve(false);
  if (mapScriptPromise) return mapScriptPromise;
  mapScriptPromise = new Promise<boolean>(resolve => {
    window.gm_authFailure = () => {
      mapUnavailableForSession = true;
      window.dispatchEvent(new Event("civicfix:maps-error"));
      resolve(false);
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(API_KEY)}&v=weekly&libraries=marker,places,geocoding,geometry`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      resolve(Boolean(window.google?.maps));
      script.remove(); // Clean up immediately
    };
    script.onerror = () => {
      console.warn(
        "Google Maps is temporarily unavailable; showing the location fallback."
      );
      mapUnavailableForSession = true;
      mapScriptPromise = null;
      resolve(false);
      script.remove();
    };
    setTimeout(() => {
      if (!window.google?.maps) {
        mapUnavailableForSession = true;
        resolve(false);
        script.remove();
      }
    }, 15000);
    document.head.appendChild(script);
  });
  return mapScriptPromise;
}

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
}

export function MapView({
  className,
  initialCenter = { lat: 37.7749, lng: -122.4194 },
  initialZoom = 12,
  onMapReady,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [loadError, setLoadError] = useState(false);

  const init = usePersistFn(async () => {
    const loaded = await loadMapScript();
    if (!loaded || !window.google?.maps) {
      setLoadError(true);
      return;
    }
    if (!mapContainer.current) {
      console.error("Map container not found");
      return;
    }
    try {
      map.current = new window.google.maps.Map(mapContainer.current, {
        zoom: initialZoom,
        center: initialCenter,
        mapTypeControl: true,
        fullscreenControl: true,
        zoomControl: true,
        streetViewControl: true,
        mapId: "DEMO_MAP_ID",
      });
      if (onMapReady) {
        onMapReady(map.current);
      }
    } catch {
      setLoadError(true);
    }
  });

  useEffect(() => {
    const failed = () => setLoadError(true);
    window.addEventListener("civicfix:maps-error", failed);
    init();
    return () => {
      window.removeEventListener("civicfix:maps-error", failed);
      if (map.current) google.maps.event.clearInstanceListeners(map.current);
    };
  }, [init]);

  if (loadError) {
    return (
      <div
        className={cn(
          "grid h-[500px] w-full place-items-center overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_45%,#d8ff76_0_4px,transparent_5px),linear-gradient(135deg,#dfeee2_25%,#edf5ee_25%,#edf5ee_50%,#dfeee2_50%,#dfeee2_75%,#edf5ee_75%)] bg-[length:34px_34px] p-5",
          className
        )}
      >
        <div className="max-w-xs rounded-2xl border border-white/70 bg-white/90 p-4 text-center shadow-sm">
          <p className="font-semibold text-[#153e35]">Location preview</p>
          <p className="mt-1 text-xs leading-5 text-[#5f756a]">
            Google Maps is temporarily unavailable. Your entered address and
            coordinates will still be saved with the report.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div ref={mapContainer} className={cn("w-full h-[500px]", className)} />
  );
}
