import type { EnrichedDetector } from "../lib/types";
import Sparkline from "./Sparkline";

const STATUS_LABEL: Record<string, string> = {
  smooth: "Smooth",
  slow: "Slow",
  congested: "Congested",
  nodata: "No data",
};

const STATUS_COLOR: Record<string, string> = {
  smooth: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  slow: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  congested: "bg-red-500/15 text-red-300 border-red-500/30",
  nodata: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

export default function DetectorPanel({ d, history, periodLabel }: { d: EnrichedDetector | null; history: number[]; periodLabel: string }) {
  if (!d) {
    return (
      <div className="flex h-full min-h-[280px] flex-col justify-center rounded-xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
        Select a detector on the map or in the table to see lane detail.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400">{d.id} · {d.district} · {d.direction}</div>
          <h2 className="mt-1 text-lg font-bold leading-snug">{d.road_en}</h2>
          <div className="text-sm text-slate-400">{d.road_tc}</div>
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_COLOR[d.status]}`}>{STATUS_LABEL[d.status]}</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-white/[0.04] p-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Avg speed</div>
          <div className="text-xl font-bold tabular-nums">{d.avgSpeed === null ? "—" : `${Math.round(d.avgSpeed)}`}<span className="text-xs font-normal text-slate-400"> km/h</span></div>
        </div>
        <div className="rounded-lg bg-white/[0.04] p-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Volume</div>
          <div className="text-xl font-bold tabular-nums">{d.totalVolume}<span className="text-xs font-normal text-slate-400"> veh</span></div>
        </div>
        <div className="rounded-lg bg-white/[0.04] p-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Max occ</div>
          <div className="text-xl font-bold tabular-nums">{d.maxOccupancy}<span className="text-xs font-normal text-slate-400"> %</span></div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
          <span>Speed trend (this session)</span>
          <span className="tabular-nums">{periodLabel}</span>
        </div>
        <Sparkline values={history} width={260} height={40} />
      </div>

      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-1">Lane</th>
            <th className="py-1 text-right">Speed</th>
            <th className="py-1 text-right">Occ</th>
            <th className="py-1 text-right">Vol</th>
          </tr>
        </thead>
        <tbody>
          {d.reading?.lanes.map((l) => (
            <tr key={l.lane_id} className="border-t border-white/5 tabular-nums">
              <td className="py-1.5">{l.lane_id}{l.valid ? "" : " (stale)"}</td>
              <td className="py-1.5 text-right">{l.speed} km/h</td>
              <td className="py-1.5 text-right">{l.occupancy}%</td>
              <td className="py-1.5 text-right">{l.volume}</td>
            </tr>
          )) ?? (
            <tr><td className="py-2 text-slate-500">No live reading for this period.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
