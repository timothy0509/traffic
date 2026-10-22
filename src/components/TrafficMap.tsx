import { useEffect, useRef } from "react";
import L from "leaflet";
import type { EnrichedDetector } from "../lib/types";

export default function TrafficMap({ detectors, selectedId, onSelect }: { detectors: EnrichedDetector[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, { zoomControl: true }).setView([22.296, 114.19], 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    map.zoomControl.setPosition("bottomright");
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
      const label = d.avgSpeed === null ? "--" : String(Math.round(d.avgSpeed));
      const icon = L.divIcon({
        className: "",
        html: `<div class="marker-plate st-${d.status}${d.id === selectedId ? " selected" : ""}">${label}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      const m = L.marker([d.lat, d.lng], { icon, title: d.id });
      m.on("click", () => onSelect(d.id));
      m.bindTooltip(`<b>${d.id}</b> ${d.avgSpeed === null ? "OFFLINE" : `${Math.round(d.avgSpeed)} KM/H · VOL ${d.totalVolume}`}<br/>${d.road_en}`, {
        direction: "top",
        offset: [0, -22],
        className: "plate-tip",
      });
      layer.addLayer(m);
    }
  }, [detectors, selectedId, onSelect]);

  useEffect(() => {
    const map = mapRef.current;
    const sel = detectors.find((d) => d.id === selectedId);
    if (map && sel) map.panTo([sel.lat, sel.lng], { animate: true });
  }, [selectedId, detectors]);

  return <div ref={divRef} className="h-[420px] w-full border-2 border-ink lg:h-[540px]" />;
}
