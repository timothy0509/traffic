import { useMemo, useState } from "react";
import type { EnrichedDetector } from "../lib/types";

type SortKey = "avgSpeed" | "totalVolume" | "maxOccupancy" | "id";

const DOT: Record<EnrichedDetector["status"], string> = {
  smooth: "bg-go",
  slow: "bg-vms",
  congested: "bg-signal",
  nodata: "bg-muted",
};

export default function DetectorTable({ detectors, selectedId, onSelect }: { detectors: EnrichedDetector[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("avgSpeed");
  const [asc, setAsc] = useState(false);

  const districts = useMemo(() => ["All", ...Array.from(new Set(detectors.map((d) => d.district)))], [detectors]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = detectors.filter((d) => (district === "All" || d.district === district) && (!needle || d.id.toLowerCase().includes(needle) || d.road_en.toLowerCase().includes(needle)));
    return [...out].sort((a, b) => {
      const va = sortKey === "id" ? a.id : (a[sortKey] ?? -1);
      const vb = sortKey === "id" ? b.id : (b[sortKey] ?? -1);
      if (typeof va === "string") return asc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return asc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [detectors, q, district, sortKey, asc]);

  const toggle = (k: SortKey) => {
    if (k === sortKey) setAsc(!asc);
    else { setSortKey(k); setAsc(k === "id"); }
  };

  return (
    <section className="border-2 border-ink bg-paper">
      <div className="flex flex-col gap-2 border-b-2 border-ink p-3 sm:flex-row sm:items-center">
        <label className="flex flex-1 items-center gap-2 sm:max-w-xs">
          <span className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">Find</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="id or road…" className="w-full border-2 border-ink bg-paper px-2 py-1 font-readout text-sm outline-none placeholder:text-muted focus:bg-white" />
        </label>
        <label className="flex items-center gap-2">
          <span className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">District</span>
          <select value={district} onChange={(e) => setDistrict(e.target.value)} className="border-2 border-ink bg-paper px-2 py-1 font-readout text-sm">
            {districts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <div className="font-readout text-xs text-muted sm:ml-auto">{rows.length} / {detectors.length} listed</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px]">
          <thead>
            <tr className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">
              <th className="px-3 py-2 text-left"><button onClick={() => toggle("id")}>Detector {sortKey === "id" ? (asc ? "▲" : "▼") : ""}</button></th>
              <th className="px-3 py-2 text-left">Location</th>
              <th className="px-3 py-2 text-right"><button onClick={() => toggle("avgSpeed")}>km/h {sortKey === "avgSpeed" ? (asc ? "▲" : "▼") : ""}</button></th>
              <th className="px-3 py-2 text-right"><button onClick={() => toggle("totalVolume")}>Veh {sortKey === "totalVolume" ? (asc ? "▲" : "▼") : ""}</button></th>
              <th className="px-3 py-2 text-right"><button onClick={() => toggle("maxOccupancy")}>Occ {sortKey === "maxOccupancy" ? (asc ? "▲" : "▼") : ""}</button></th>
              <th className="px-3 py-2 text-left">Flow</th>
            </tr>
          </thead>
          <tbody className="font-readout text-sm tabular-nums">
            {rows.map((d) => (
              <tr key={d.id} onClick={() => onSelect(d.id)} className={`cursor-pointer border-t border-line hover:bg-paper-dim ${d.id === selectedId ? "bg-ink text-paper hover:bg-ink" : ""}`}>
                <td className="px-3 py-1.5 text-xs font-bold">{d.id}</td>
                <td className="max-w-[340px] truncate px-3 py-1.5 font-display text-[15px] font-medium">{d.road_en.replace(/\s*\[AID\d+\]\s*$/, "")}</td>
                <td className="px-3 py-1.5 text-right font-bold">{d.avgSpeed === null ? "--" : Math.round(d.avgSpeed)}</td>
                <td className="px-3 py-1.5 text-right">{d.totalVolume}</td>
                <td className="px-3 py-1.5 text-right">{d.maxOccupancy}%</td>
                <td className="px-3 py-1.5"><span className={`inline-block h-3 w-3 border ${d.id === selectedId ? "border-paper" : "border-ink"} ${DOT[d.status]}`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
