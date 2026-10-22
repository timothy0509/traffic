import type { EnrichedDetector } from "../lib/types";
import Sparkline from "./Sparkline";

const STATUS_WORD: Record<EnrichedDetector["status"], string> = {
  smooth: "Smooth",
  slow: "Slow",
  congested: "Congested",
  nodata: "Offline",
};

const STATUS_INK: Record<EnrichedDetector["status"], string> = {
  smooth: "text-go",
  slow: "text-amber",
  congested: "text-signal",
  nodata: "text-muted",
};

export default function DetectorPanel({ d, history, periodLabel }: { d: EnrichedDetector | null; history: number[]; periodLabel: string }) {
  if (!d) {
    return (
      <div className="flex h-full min-h-[280px] flex-col justify-center border-2 border-dashed border-muted p-6">
        <p className="font-display text-xl font-semibold uppercase tracking-wide">No detector selected</p>
        <p className="mt-1 font-readout text-xs text-ink-soft">Pick a plate on the map or a row in the ledger.</p>
      </div>
    );
  }
  return (
    <article className="border-2 border-ink bg-paper">
      <header className="border-b-2 border-ink px-4 pb-3 pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-readout text-xs font-bold tracking-widest">{d.id}</span>
          <span className={`font-display text-lg font-bold uppercase tracking-wide ${STATUS_INK[d.status]}`}>{STATUS_WORD[d.status]}</span>
        </div>
        <h2 className="mt-1 font-display text-2xl font-semibold leading-none">{d.road_en.replace(/\s*\[AID\d+\]\s*$/, "")}</h2>
        <p className="mt-1 text-base text-ink-soft">{d.road_tc}</p>
        <p className="mt-1 font-readout text-[11px] uppercase tracking-widest text-muted">{d.district} · {d.direction}bound</p>
      </header>

      <div className="flex items-end justify-between px-4 pt-3">
        <div>
          <div className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-muted">Avg speed</div>
          <div className="font-readout text-6xl font-bold leading-none tabular-nums">
            {d.avgSpeed === null ? "--" : Math.round(d.avgSpeed)}
            <span className="text-lg font-medium text-ink-soft"> km/h</span>
          </div>
        </div>
        <div className="pb-1 text-right font-readout text-sm tabular-nums">
          <div><span className="text-2xl font-bold">{d.totalVolume}</span> <span className="text-[11px] uppercase text-muted">veh</span></div>
          <div><span className="text-2xl font-bold">{d.maxOccupancy}</span><span className="text-[11px] uppercase text-muted"> % occ</span></div>
        </div>
      </div>

      <div className="px-4 pt-3">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-muted">Speed trace · session</span>
          <span className="font-readout text-[11px] tabular-nums text-muted">{periodLabel}</span>
        </div>
        <Sparkline values={history} width={280} height={52} />
      </div>

      <table className="mt-3 w-full">
        <thead>
          <tr className="border-y-2 border-ink font-display text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft">
            <th className="px-4 py-1 text-left">Lane</th>
            <th className="px-2 py-1 text-right">km/h</th>
            <th className="px-2 py-1 text-right">Occ</th>
            <th className="px-4 py-1 text-right">Vol</th>
          </tr>
        </thead>
        <tbody className="font-readout text-sm tabular-nums">
          {d.reading?.lanes.map((l) => (
            <tr key={l.lane_id} className="border-b border-line last:border-b-2 last:border-ink">
              <td className="px-4 py-1.5">{l.lane_id}{l.valid ? "" : " *"}</td>
              <td className="px-2 py-1.5 text-right font-bold">{l.speed}</td>
              <td className="px-2 py-1.5 text-right">
                <span className="mr-2 inline-block h-2 w-16 border border-ink align-middle">
                  <span className="block h-full bg-ink" style={{ width: `${Math.min(100, l.occupancy)}%` }} />
                </span>
                {l.occupancy}%
              </td>
              <td className="px-4 py-1.5 text-right">{l.volume}</td>
            </tr>
          )) ?? (
            <tr><td className="px-4 py-3 text-muted">No reading this period.</td></tr>
          )}
        </tbody>
      </table>
      <p className="px-4 py-2 font-readout text-[11px] text-muted">* stale lane · excluded from average</p>
    </article>
  );
}
