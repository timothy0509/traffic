import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { fetchLive, fetchMetas, getStoredLive } from "./lib/api";
import { classify, type DetectorMeta, type EnrichedDetector, type LiveResponse } from "./lib/types";
import TrafficMap from "./components/TrafficMap";
import StatsBar from "./components/StatsBar";
import DetectorPanel from "./components/DetectorPanel";
import DetectorTable from "./components/DetectorTable";

const POLL_MS = 60_000;

export default function App() {
  const [metas, setMetas] = useState<DetectorMeta[]>([]);
  // Show last stored reading instantly while the fresh fetch runs.
  const [live, setLive] = useState<LiveResponse | null>(() => getStoredLive());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const historyRef = useRef<Record<string, number[]>>({});
  const liveRef = useRef<LiveResponse | null>(null);
  liveRef.current = live;

  const load = useCallback(async (first = false) => {
    // Detector locations and live readings fetch independently, both with
    // local fallbacks, so one failing feed never blanks the whole page.
    const [mRes, lRes] = await Promise.allSettled([
      metas.length ? null : fetchMetas(),
      fetchLive(),
    ]);
    if (mRes.status === "fulfilled" && mRes.value) setMetas(mRes.value);
    if (lRes.status === "fulfilled") {
      setLive(lRes.value);
      setLastUpdated(new Date());
      setError(null);
    } else if (!liveRef.current) {
      setError(`Live feed unreachable (${String(lRes.reason)}). Retrying every minute.`);
    }
    if (first) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metas.length]);

  useEffect(() => {
    load(true);
    const t = setInterval(() => load(false), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const enriched: EnrichedDetector[] = useMemo(() => {
    const latest = live?.periods[live.periods.length - 1];
    const byId = new Map((latest?.detectors ?? []).map((d) => [d.id, d]));
    return metas.map((m) => {
      const reading = (byId.get(m.id) as EnrichedDetector["reading"]) ?? null;
      const valid = (reading?.lanes ?? []).filter((l) => l.valid && l.speed > 0);
      const avgSpeed = valid.length ? valid.reduce((s, l) => s + l.speed, 0) / valid.length : valid.length === 0 && (reading?.lanes.length ?? 0) > 0 ? 0 : null;
      const totalVolume = (reading?.lanes ?? []).reduce((s, l) => s + l.volume, 0);
      const maxOccupancy = (reading?.lanes ?? []).reduce((s, l) => Math.max(s, l.occupancy), 0);
      const hasReading = reading !== null;
      return { ...m, reading, avgSpeed: hasReading ? (valid.length ? avgSpeed : (totalVolume === 0 ? null : 0)) : null, totalVolume, maxOccupancy, status: classify(hasReading ? avgSpeed : null, maxOccupancy, totalVolume) };
    });
  }, [metas, live]);

  // accumulate speed history for sparkline
  const [, force] = useState(0);
  useEffect(() => {
    let changed = false;
    for (const d of enriched) {
      if (d.avgSpeed !== null) {
        const arr = historyRef.current[d.id] ?? [];
        const last = arr[arr.length - 1];
        if (last !== d.avgSpeed) {
          historyRef.current[d.id] = [...arr, d.avgSpeed].slice(-40);
          changed = true;
        }
      }
    }
    if (changed) force((x) => x + 1);
  }, [enriched]);

  const selected = enriched.find((d) => d.id === selectedId) ?? enriched[0] ?? null;
  const online = enriched.filter((d) => d.status !== "nodata").length;
  const speeds = enriched.map((d) => d.avgSpeed).filter((v): v is number => v !== null);
  const avgSpeed = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null;
  const totalVol = enriched.reduce((s, d) => s + d.totalVolume, 0);
  const congested = enriched.filter((d) => d.status === "congested").length;
  const latestPeriod = live?.periods[live.periods.length - 1];
  const periodLabel = latestPeriod ? `${live?.date} ${latestPeriod.from}–${latestPeriod.to}` : "";

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-3 py-5 sm:px-5">
      <header>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-readout text-[11px] font-bold uppercase tracking-[0.28em] text-signal">Transport Department · Smart lamppost network</p>
            <h1 className="font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl">Traffic Bulletin</h1>
            <p className="mt-1 font-display text-xl font-medium text-ink-soft">智慧燈柱交通快訊 · speed / volume / occupancy, every minute</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`border-2 border-ink px-3 py-1.5 font-readout text-xs font-bold uppercase tracking-widest ${error ? "bg-signal text-paper" : "bg-ink text-paper"}`}>
              {error ? "Feed down" : "● Live"}
            </span>
            <button onClick={() => load(false)} className="border-2 border-ink bg-paper px-3 py-1.5 font-readout text-xs font-bold uppercase tracking-widest shadow-[3px_3px_0_var(--color-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
              <RefreshCw size={13} className="mr-1 inline" /> Re-poll
            </button>
          </div>
        </div>
        <div className="hazard mt-3 h-2.5 w-full border-y-2 border-ink" />
      </header>

      {loading ? (
        <div className="mt-8 font-readout text-sm text-ink-soft">Tuning in to feed…</div>
      ) : (
        <>
          <div className="vms mt-4 border-2 border-ink px-4 py-3">
            <p className="vms-text font-readout text-sm font-bold uppercase tracking-[0.14em] sm:text-base">
              {congested > 0
                ? `Caution: ${congested} congested detector${congested > 1 ? "s" : ""} · network avg ${avgSpeed === null ? "--" : Math.round(avgSpeed)} km/h`
                : `Network moving · avg ${avgSpeed === null ? "--" : Math.round(avgSpeed)} km/h · ${totalVol} veh per 30 s`}
              <span className="vms-cursor"> ▮</span>
            </p>
            <p className="vms-text mt-1 font-readout text-[11px] uppercase tracking-[0.2em] opacity-80">{periodLabel}{lastUpdated ? ` · polled ${lastUpdated.toLocaleTimeString("en-HK", { hour12: false })} HKT` : ""}</p>
          </div>

          <div className="mt-4"><StatsBar online={online} total={enriched.length} avgSpeed={avgSpeed} totalVol={totalVol} congested={congested} /></div>
          {error && <div className="mt-3 border-2 border-signal bg-paper px-3 py-2 font-readout text-xs text-signal">{error} Showing last good readings.</div>}

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TrafficMap detectors={enriched} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-readout text-[11px] uppercase tracking-widest text-ink-soft">
                <span><span className="mr-1 inline-block h-2.5 w-2.5 border border-ink bg-go" /> smooth ≥30</span>
                <span><span className="mr-1 inline-block h-2.5 w-2.5 border border-ink bg-vms" /> slow 15–30</span>
                <span><span className="mr-1 inline-block h-2.5 w-2.5 border border-ink bg-signal" /> congested &lt;15</span>
                <span className="ml-auto tabular-nums">{periodLabel}</span>
              </div>
            </div>
            <DetectorPanel d={selected} history={selected ? historyRef.current[selected.id] ?? [] : []} periodLabel={periodLabel} />
          </div>

          <div className="lane-rule my-4" />
          <div><DetectorTable detectors={enriched} selectedId={selected?.id ?? null} onSelect={setSelectedId} /></div>

          <footer className="mt-6 border-t-2 border-ink pt-3 font-readout text-[11px] leading-relaxed text-ink-soft">
            Source: DATA.GOV.HK — traffic data collected by detectors at smart lampposts (Transport Department).
            Browser polls the live feed directly each minute; locations fall back to a bundled copy if the CSV is unreachable.{" "}
            <a className="underline" href="https://data.gov.hk/en-data/dataset/hk-td-tis_33-traffic-data-traffic-detectors-installed-at-smart-lampposts">Dataset page</a>
          </footer>
        </>
      )}
    </div>
  );
}
