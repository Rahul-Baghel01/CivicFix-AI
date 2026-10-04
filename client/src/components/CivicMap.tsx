/// <reference types="@types/google.maps" />

import { MapView } from "@/components/Map";
import { useCallback } from "react";

export type CivicMarker = {
  latitude: number;
  longitude: number;
  label: string;
  severity?: string;
};

const markerColors: Record<string, string> = {
  LOW: "#16a34a",
  MEDIUM: "#d97706",
  HIGH: "#ea580c",
  CRITICAL: "#dc2626",
};

export function CivicMap({
  markers,
  onPick,
  onReady,
  className,
}: {
  markers: CivicMarker[];
  onPick?: (point: { latitude: number; longitude: number }) => void;
  onReady?: (map: google.maps.Map) => void;
  className?: string;
}) {
  const handleReady = useCallback((map: google.maps.Map) => {
    markers.forEach(marker => {
      const pin = new google.maps.Marker({
        map,
        position: { lat: marker.latitude, lng: marker.longitude },
        title: marker.label,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: markerColors[marker.severity ?? "LOW"] ?? markerColors.LOW,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 8,
        },
      });
      const info = new google.maps.InfoWindow({ content: `<div style="font: 600 13px Inter, sans-serif; color:#152824">${marker.label}</div>` });
      pin.addListener("click", () => info.open({ map, anchor: pin }));
    });
    if (onPick) {
      map.addListener("click", (event: google.maps.MapMouseEvent) => {
        if (event.latLng) onPick({ latitude: event.latLng.lat(), longitude: event.latLng.lng() });
      });
    }
    onReady?.(map);
  }, [markers, onPick, onReady]);

  const center = markers[0]
    ? { lat: markers[0].latitude, lng: markers[0].longitude }
    : { lat: 26.4817, lng: 80.3154 };

  return <MapView initialCenter={center} initialZoom={markers.length > 1 ? 5 : 14} onMapReady={handleReady} className={className} />;
}
