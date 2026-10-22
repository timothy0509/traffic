import { useEffect, useRef } from "react";
import L from "leaflet";
import type { EnrichedDetector } from "../lib/types";

export default function TrafficMap({ detectors, selectedId, onSelect, center, zoom, dense }: { detectors: EnrichedDetector[]; selectedId: string | null; onSelect: (id: string) => void; center: [number, number]; zoom: number; dense?: boolean }) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, { zoomControl: true }).setView(center, zoom);
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
    const map = mapRef.current;
    if (map) map.setView(center, zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], zoom]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const d of detectors) {
      const label = d.avgSpeed === null ? "--" : String(Math.round(d.avgSpeed));
      const size = dense ? 26 : 36;
      const icon = L.divIcon({
        className: "",
        html: `<div class="marker-plate${dense ? " mini" : ""} st-${d.status}${d.id === selectedId ? " selected" : ""}">${label}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
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
  }, [detectors, selectedId, onSelect, dense]);

  useEffect(() => {
    const map = mapRef.current;
    const sel = detectors.find((d) => d.id === selectedId);
    if (map && sel) map.panTo([sel.lat, sel.lng], { animate: true });
  }, [selectedId, detectors]);

  return <div ref={divRef} className="h-[420px] w-full border-2 border-ink lg:h-[540px]" />;
}
