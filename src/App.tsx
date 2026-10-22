import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { fetchLive, fetchMetas, getStoredLive, type SourceConfig } from "./lib/feed";
import { SLP_SOURCE, STRATEGIC_SOURCE } from "./lib/sources";
import { classify, type DetectorMeta, type EnrichedDetector, type LiveResponse } from "./lib/types";
import { useLocale } from "./lib/locale";
import TrafficMap from "./components/TrafficMap";
import StatsBar from "./components/StatsBar";
import DetectorPanel from "./components/DetectorPanel";
import DetectorTable from "./components/DetectorTable";
import JourneyPlanner from "./components/JourneyPlanner";

const BusesSection = lazy(() => import("./components/sections/BusesSection"));
const RailSeaSection = lazy(() => import("./components/sections/RailSeaSection"));
const ParkingSection = lazy(() => import("./components/sections/ParkingSection"));
const TaxiSection = lazy(() => import("./components/sections/TaxiSection"));
const RoadsExtraSection = lazy(() => import("./components/sections/RoadsExtraSection"));
const PlacesSection = lazy(() => import("./components/sections/PlacesSection"));
const StatsSection = lazy(() => import("./components/sections/StatsSection"));

function SectionFallback() {
  return <div className="mt-4 border-2 border-ink bg-paper px-4 py-6 font-readout text-sm text-ink-soft">Unfolding section…</div>;
}

const POLL_MS = 60_000;

type View = "slp" | "strategic";
type Section = "boards" | "journey" | "buses" | "railsea" | "parking" | "taxi" | "roads" | "places" | "stats";

const SOURCE_OF: Record<View, SourceConfig> = {
  slp: SLP_SOURCE,
  strategic: STRATEGIC_SOURCE,
};

const MAP_VIEW: Record<View, { center: [number, number]; zoom: number }> = {
  slp: { center: [22.296, 114.19], zoom: 13 },
  strategic: { center: [22.335, 114.14], zoom: 11 },
};

interface SourceState {
  metas: DetectorMeta[];
  live: LiveResponse | null;
  lastUpdated: Date | null;
}

function enrich(metas: DetectorMeta[], live: LiveResponse | null): EnrichedDetector[] {
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
}

export default function App() {
  const { lang, setLang } = useLocale();
  const [section, setSection] = useState<Section>("boards");
  const [view, setView] = useState<View>("slp");
  const [store, setStore] = useState<Record<string, SourceState>>(() => ({
    [SLP_SOURCE.id]: { metas: [], live: getStoredLive(SLP_SOURCE), lastUpdated: null },
    [STRATEGIC_SOURCE.id]: { metas: [], live: getStoredLive(STRATEGIC_SOURCE), lastUpdated: null },
  }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const historyRef = useRef<Record<string, number[]>>({});
  const storeRef = useRef(store);
  storeRef.current = store;

  const cfg = section === "boards" ? SOURCE_OF[view] : null;
  const state = cfg ? store[cfg.id] : null;

  const load = useCallback(async (c: SourceConfig, first = false) => {
    if (first && (storeRef.current[c.id].metas.length || storeRef.current[c.id].live)) {
      setLoading(false);
    }
    const [mRes, lRes] = await Promise.allSettled([
      storeRef.current[c.id].metas.length ? null : fetchMetas(c),
      fetchLive(c),
    ]);
    setStore((prev) => {
      const cur = prev[c.id];
      return {
        ...prev,
        [c.id]: {
          metas: mRes.status === "fulfilled" && mRes.value ? mRes.value : cur.metas,
          live: lRes.status === "fulfilled" ? lRes.value : cur.live,
          lastUpdated: lRes.status === "fulfilled" ? new Date() : cur.lastUpdated,
        },
      };
    });
    if (lRes.status === "fulfilled") setError(null);
    else if (!storeRef.current[c.id].live) setError(`Live feed unreachable (${String(lRes.reason)}). Retrying every minute.`);
    if (first) setLoading(false);
  }, []);

  useEffect(() => {
    if (!cfg || section !== "boards") return;
    setError(null);
    setSelectedId(null);
    if (!storeRef.current[cfg.id].metas.length && !storeRef.current[cfg.id].live) setLoading(true);
    else setLoading(false);
    load(cfg, true);
    const t = setInterval(() => load(cfg, false), POLL_MS);
    return () => clearInterval(t);
  }, [cfg, load, section]);

  const enriched = useMemo(() => (state ? enrich(state.metas, state.live) : []), [state]);

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
  const latestPeriod = state?.live?.periods[state.live.periods.length - 1];
  const periodLabel = latestPeriod ? `${state?.live?.date} ${latestPeriod.from}–${latestPeriod.to}` : "";

  const boardTabs: [View, string, string][] = [
    ["slp", `Lampposts · ${store.slp.metas.length || 20}`, `智慧燈柱 · ${store.slp.metas.length || 20}`],
    ["strategic", `Strategic · ${store.strategic.metas.length || "800+"}`, `策略性道路 · ${store.strategic.metas.length || "800+"}`],
  ];

  const sections: [Section, string, string][] = [
    ["boards", "Boards", "看板"],
    ["journey", "Journey", "行程"],
    ["buses", "Buses", "巴士"],
    ["railsea", "Rail·Sea", "鐵路·渡輪"],
    ["parking", "Parking", "泊車"],
    ["taxi", "Taxis", "的士"],
    ["roads", "CCTV·Works", "閉路電視·工程"],
    ["places", "Places", "地方設施"],
    ["stats", "Stats", "統計"],
  ];
  const L = (en: string, tc: string) => (lang === "tc" ? tc : en);

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-3 py-5 sm:px-5">
      <header>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-readout text-[11px] font-bold uppercase tracking-[0.28em] text-signal">{L("Transport Department · live traffic", "運輸署 · 即時交通")}</p>
            <h1 className="font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl">{L("Traffic Bulletin", "交通快訊")}</h1>
            <p className="mt-1 font-display text-xl font-medium text-ink-soft">{L("Every API-available transport feed, live", "所有設有 API 的運輸數據，實時更新")}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border-2 border-ink" role="group" aria-label="Language">
              {(["en", "tc"] as const).map((l) => (
                <button key={l} onClick={() => setLang(l)} className={`px-3 py-1.5 font-readout text-xs font-bold ${lang === l ? "bg-ink text-paper" : "bg-paper"}`}>
                  {l === "en" ? "EN" : "繁"}
                </button>
              ))}
            </div>
            {section === "boards" && cfg && (
              <button onClick={() => load(cfg, false)} className="border-2 border-ink bg-paper px-3 py-1.5 font-readout text-xs font-bold uppercase tracking-widest shadow-[3px_3px_0_var(--color-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
                <RefreshCw size={13} className="mr-1 inline" /> {L("Re-poll", "重新整理")}
              </button>
            )}
          </div>
        </div>
        <div className="hazard mt-3 h-2.5 w-full border-y-2 border-ink" />
        <nav className="mt-3 flex flex-wrap gap-2">
          {sections.map(([s, en, tc]) => (
            <button key={s} onClick={() => setSection(s)} className={`border-2 border-ink px-4 py-1.5 font-display text-lg font-bold uppercase tracking-wide ${section === s ? "bg-ink text-paper" : "bg-paper hover:bg-paper-dim"}`}>
              {lang === "tc" ? tc : en}
            </button>
          ))}
        </nav>
        {section === "boards" && (
          <nav className="mt-2 flex flex-wrap gap-2">
            {boardTabs.map(([v, en, tc]) => (
              <button key={v} onClick={() => setView(v)} className={`border border-ink px-3 py-1 font-display text-base font-semibold uppercase tracking-wide ${view === v ? "bg-signal text-paper" : "bg-paper"}`}>
                {lang === "tc" ? tc : en}
              </button>
            ))}
          </nav>
        )}
      </header>

      {section === "journey" ? (
        <div className="mt-4"><JourneyPlanner /></div>
      ) : section === "buses" ? (
        <Suspense fallback={<SectionFallback />}><div className="mt-4"><BusesSection /></div></Suspense>
      ) : section === "railsea" ? (
        <Suspense fallback={<SectionFallback />}><div className="mt-4"><RailSeaSection /></div></Suspense>
      ) : section === "parking" ? (
        <Suspense fallback={<SectionFallback />}><div className="mt-4"><ParkingSection /></div></Suspense>
      ) : section === "taxi" ? (
        <Suspense fallback={<SectionFallback />}><div className="mt-4"><TaxiSection /></div></Suspense>
      ) : section === "roads" ? (
        <Suspense fallback={<SectionFallback />}><div className="mt-4"><RoadsExtraSection /></div></Suspense>
      ) : section === "places" ? (
        <Suspense fallback={<SectionFallback />}><div className="mt-4"><PlacesSection /></div></Suspense>
      ) : section === "stats" ? (
        <Suspense fallback={<SectionFallback />}><div className="mt-4"><StatsSection /></div></Suspense>
      ) : loading ? (
        <div className="mt-8 font-readout text-sm text-ink-soft">{L("Tuning in to feed…", "正在接收數據…")}</div>
      ) : (
        <>
          <div className="vms mt-4 border-2 border-ink px-4 py-3">
            <p className="vms-text font-readout text-sm font-bold uppercase tracking-[0.14em] sm:text-base">
              {congested > 0
                ? lang === "tc"
                  ? `注意：${congested} 個檢測器擠塞 · 全網平均 ${avgSpeed === null ? "--" : Math.round(avgSpeed)} 公里/時`
                  : `Caution: ${congested} congested detector${congested > 1 ? "s" : ""} · network avg ${avgSpeed === null ? "--" : Math.round(avgSpeed)} km/h`
                : lang === "tc"
                  ? `路面暢通 · 平均 ${avgSpeed === null ? "--" : Math.round(avgSpeed)} 公里/時 · 每 30 秒 ${totalVol} 架次`
                  : `Network moving · avg ${avgSpeed === null ? "--" : Math.round(avgSpeed)} km/h · ${totalVol} veh per 30 s`}
              <span className="vms-cursor"> ▮</span>
            </p>
            <p className="vms-text mt-1 font-readout text-[11px] uppercase tracking-[0.2em] opacity-80">{periodLabel}{state?.lastUpdated ? ` · polled ${state.lastUpdated.toLocaleTimeString(lang === "tc" ? "zh-HK" : "en-HK", { hour12: false })} HKT` : ""}</p>
          </div>

          <div className="mt-4"><StatsBar online={online} total={enriched.length} avgSpeed={avgSpeed} totalVol={totalVol} congested={congested} /></div>
          {error && <div className="mt-3 border-2 border-signal bg-paper px-3 py-2 font-readout text-xs text-signal">{error} {L("Showing last good readings.", "顯示上次正常讀數。")}</div>}

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TrafficMap detectors={enriched} selectedId={selected?.id ?? null} onSelect={setSelectedId} center={MAP_VIEW[view].center} zoom={MAP_VIEW[view].zoom} dense={enriched.length > 100} />
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-readout text-[11px] uppercase tracking-widest text-ink-soft">
                <span><span className="mr-1 inline-block h-2.5 w-2.5 border border-ink bg-go" /> {L("smooth ≥30", "暢順 ≥30")}</span>
                <span><span className="mr-1 inline-block h-2.5 w-2.5 border border-ink bg-vms" /> {L("slow 15–30", "緩慢 15–30")}</span>
                <span><span className="mr-1 inline-block h-2.5 w-2.5 border border-ink bg-signal" /> {L("congested <15", "擠塞 <15")}</span>
                <span className="ml-auto tabular-nums">{periodLabel}</span>
              </div>
            </div>
            <DetectorPanel d={selected} history={selected ? historyRef.current[selected.id] ?? [] : []} periodLabel={periodLabel} />
          </div>

          <div className="lane-rule my-4" />
          <div><DetectorTable detectors={enriched} selectedId={selected?.id ?? null} onSelect={setSelectedId} /></div>
        </>
      )}

      <footer className="mt-6 border-t-2 border-ink pt-3 font-readout text-[11px] leading-relaxed text-ink-soft">
        {L(
          "Sources: DATA.GOV.HK transport category, every API-available dataset — detectors, TDAS, buses, MTR, ferries, parking, taxis, CCTV, roadworks, CSDI places, census stats. Browser fetches open feeds directly; a same-origin relay serves hosts without CORS headers.",
          "資料來源：DATA.GOV.HK 運輸類別所有設有 API 的數據集 — 檢測器、TDAS、巴士、港鐵、渡輪、泊車、的士、閉路電視、道路工程、CSDI 地方設施、統計數字。瀏覽器直接讀取開放數據；同源中繼處理沒有 CORS 標頭的來源。"
        )}{" "}
        <a className="underline" href="https://data.gov.hk/en-datasets/category/transport">{L("Transport datasets", "運輸數據集")}</a>
      </footer>
    </div>
  );
}
