import { useEffect, useRef } from "react";
import L from "leaflet";
import type { EnrichedDetector } from "../lib/types";

const COLORS: Record<string, string> = {
  smooth: "#22c55e",
  slow: "#f59e0b",
  congested: "#ef4444",
  nodata: "#64748b",
};

export default function TrafficMap({ detectors, selectedId, onSelect }: { detectors: EnrichedDetector[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, { zoomControl: true }).setView([22.296, 114.19], 13);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap &copy; CARTO",
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const d of detectors) {
      const color = COLORS[d.status];
      const label = d.avgSpeed === null ? "–" : String(Math.round(d.avgSpeed));
      const size = d.id === selectedId ? 44 : 36;
      const icon = L.divIcon({
        className: "",
        html: `<div class="marker-pill" style="width:${size}px;height:${size}px;background:${color}">${label}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      const m = L.marker([d.lat, d.lng], { icon, title: d.id });
      m.on("click", () => onSelect(d.id));
      m.bindTooltip(`<b>${d.id}</b><br/>${d.road_en}<br/>${d.avgSpeed === null ? "no data" : `${Math.round(d.avgSpeed)} km/h · vol ${d.totalVolume}`} `, { direction: "top", offset: [0, -20] });
      layer.addLayer(m);
    }
  }, [detectors, selectedId, onSelect]);

  useEffect(() => {
    const map = mapRef.current;
    const sel = detectors.find((d) => d.id === selectedId);
    if (map && sel) map.panTo([sel.lat, sel.lng], { animate: true });
  }, [selectedId, detectors]);

  return <div ref={divRef} className="h-[420px] w-full overflow-hidden rounded-xl border border-white/10 lg:h-[520px]" />;
}
