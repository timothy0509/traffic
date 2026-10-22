import { useMemo, useState } from "react";
import type { EnrichedDetector } from "../lib/types";

type SortKey = "avgSpeed" | "totalVolume" | "maxOccupancy" | "id";

export default function DetectorTable({ detectors, selectedId, onSelect }: { detectors: EnrichedDetector[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("avgSpeed");
  const [asc, setAsc] = useState(true);

  const districts = useMemo(() => ["All", ...Array.from(new Set(detectors.map((d) => d.district)))], [detectors]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = detectors.filter((d) => (district === "All" || d.district === district) && (!needle || d.id.toLowerCase().includes(needle) || d.road_en.toLowerCase().includes(needle)));
    out = [...out].sort((a, b) => {
      const va = sortKey === "id" ? a.id : (a[sortKey] ?? -1);
      const vb = sortKey === "id" ? b.id : (b[sortKey] ?? -1);
      if (typeof va === "string") return asc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return asc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return out;
  }, [detectors, q, district, sortKey, asc]);

  const toggle = (k: SortKey) => {
    if (k === sortKey) setAsc(!asc);
    else { setSortKey(k); setAsc(k === "id" ? true : false); }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02]">
      <div className="flex flex-col gap-2 border-b border-white/10 p-3 sm:flex-row sm:items-center">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search id or road…" className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-sky-500 sm:max-w-xs" />
        <select value={district} onChange={(e) => setDistrict(e.target.value)} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm">
          {districts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <div className="text-xs text-slate-500 sm:ml-auto">{rows.length} detectors</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2"><button onClick={() => toggle("id")}>ID {sortKey === "id" ? (asc ? "↑" : "↓") : ""}</button></th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2 text-right"><button onClick={() => toggle("avgSpeed")}>Speed {sortKey === "avgSpeed" ? (asc ? "↑" : "↓") : ""}</button></th>
              <th className="px-3 py-2 text-right"><button onClick={() => toggle("totalVolume")}>Vol {sortKey === "totalVolume" ? (asc ? "↑" : "↓") : ""}</button></th>
              <th className="px-3 py-2 text-right"><button onClick={() => toggle("maxOccupancy")}>Occ {sortKey === "maxOccupancy" ? (asc ? "↑" : "↓") : ""}</button></th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} onClick={() => onSelect(d.id)} className={`cursor-pointer border-t border-white/5 tabular-nums hover:bg-white/[0.04] ${d.id === selectedId ? "bg-sky-500/10" : ""}`}>
                <td className="px-3 py-2 font-mono text-xs">{d.id}</td>
                <td className="max-w-[320px] truncate px-3 py-2">{d.road_en}</td>
                <td className="px-3 py-2 text-right">{d.avgSpeed === null ? "—" : `${Math.round(d.avgSpeed)} km/h`}</td>
                <td className="px-3 py-2 text-right">{d.totalVolume}</td>
                <td className="px-3 py-2 text-right">{d.maxOccupancy}%</td>
                <td className="px-3 py-2">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${d.status === "smooth" ? "bg-emerald-400" : d.status === "slow" ? "bg-amber-400" : d.status === "congested" ? "bg-red-400" : "bg-slate-500"}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
