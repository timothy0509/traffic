import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RadioTower, RefreshCw } from "lucide-react";
import { fetchLive, fetchMetas } from "./lib/api";
import { classify, type DetectorMeta, type EnrichedDetector, type LiveResponse } from "./lib/types";
import TrafficMap from "./components/TrafficMap";
import StatsBar from "./components/StatsBar";
import DetectorPanel from "./components/DetectorPanel";
import DetectorTable from "./components/DetectorTable";

const POLL_MS = 30_000;

export default function App() {
  const [metas, setMetas] = useState<DetectorMeta[]>([]);
  const [live, setLive] = useState<LiveResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const historyRef = useRef<Record<string, number[]>>({});

  const load = useCallback(async (first = false) => {
    try {
      const [m, l] = await Promise.all([metas.length ? null : fetchMetas(), fetchLive()]);
      if (m) setMetas(m);
      setLive(l);
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      if (first) setLoading(false);
    }
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
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
            <RadioTower size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">HK Smart Lamppost Traffic</h1>
            <p className="text-xs text-slate-400">Live speed, volume and occupancy from Transport Department detectors · updates every minute</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${error ? "border-red-500/40 text-red-300" : "border-emerald-500/30 text-emerald-300"}`}>
            <span className={`h-2 w-2 rounded-full ${error ? "bg-red-400" : "bg-emerald-400 animate-pulse"}`} />
            {error ? "feed error" : "live"}
          </span>
          <button onClick={() => load(false)} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-slate-200 hover:bg-white/[0.08]">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </header>

      {loading ? (
        <div className="mt-8 text-sm text-slate-400">Loading live feed…</div>
      ) : (
        <>
          <div className="mt-4"><StatsBar online={online} total={enriched.length} avgSpeed={avgSpeed} totalVol={totalVol} congested={congested} /></div>
          {error && <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">Could not reach live feed: {error}. Showing last known positions.</div>}

          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TrafficMap detectors={enriched} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> smooth ≥30</span>
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> slow 15–30</span>
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /> congested &lt;15</span>
                <span className="ml-auto tabular-nums">{periodLabel}{lastUpdated ? ` · checked ${lastUpdated.toLocaleTimeString()}` : ""}</span>
              </div>
            </div>
            <DetectorPanel d={selected} history={selected ? historyRef.current[selected.id] ?? [] : []} periodLabel={periodLabel} />
          </div>

          <div className="mt-3"><DetectorTable detectors={enriched} selectedId={selected?.id ?? null} onSelect={setSelectedId} /></div>

          <footer className="mt-6 border-t border-white/10 pt-3 text-xs text-slate-500">
            Source: DATA.GOV.HK — Traffic data collected by traffic detectors installed at smart lampposts (Transport Department).
            Live XML refreshes every minute; this app polls every 30s through a Bun proxy with caching.{" "}
            <a className="underline" href="https://data.gov.hk/en-data/dataset/hk-td-tis_33-traffic-data-traffic-detectors-installed-at-smart-lampposts">Dataset page</a>
          </footer>
        </>
      )}
    </div>
  );
}
