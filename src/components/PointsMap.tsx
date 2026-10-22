import { useEffect, useRef } from "react";
import L from "leaflet";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  tip: string;
  color?: string;
}

// Generic dot map for sections (taxis, chargers, cameras, CSDI layers...).
// Plates stay exclusive to the detector boards in TrafficMap.
export default function PointsMap({ points, center, zoom, heightClass = "h-[420px]", onPick }: { points: MapPoint[]; center: [number, number]; zoom: number; heightClass?: string; onPick?: (id: string) => void }) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, { zoomControl: true }).setView(center, zoom);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    map.zoomControl.setPosition("bottomright");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map) map.setView(center, zoom);
  }, [center, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = L.layerGroup();
    // cap pins for sanity on huge layers; sections should pre-filter anyway
    for (const p of points.slice(0, 4000)) {
      const dot = L.circleMarker([p.lat, p.lng], {
        radius: 5,
        color: "#1c1813",
        weight: 1.5,
        fillColor: p.color ?? "#c8102e",
        fillOpacity: 0.9,
      });
      dot.bindTooltip(p.tip, { direction: "top", offset: [0, -6], className: "plate-tip" });
      if (onPick) dot.on("click", () => onPick(p.id));
      layer.addLayer(dot);
    }
    layer.addTo(map);
    return () => {
      layer.remove();
    };
  }, [points, onPick]);

  return <div ref={divRef} className={`w-full border-2 border-ink ${heightClass}`} />;
}

export const HK_CENTER: [number, number] = [22.335, 114.14];
