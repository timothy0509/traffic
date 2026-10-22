import type { EnrichedDetector } from "../lib/types";
import { useLocale } from "../lib/locale";
import Sparkline from "./Sparkline";

const STR = {
  en: {
    none: "No detector selected",
    noneSub: "Pick a plate on the map or a row in the ledger.",
    status: { smooth: "Smooth", slow: "Slow", congested: "Congested", nodata: "Offline" } as Record<EnrichedDetector["status"], string>,
    avg: "Avg speed",
    vol: "Volume",
    occ: "Max occ",
    veh: "veh",
    trend: "Speed trace · session",
    lane: "Lane",
    speed: "km/h",
    occCol: "Occ",
    volCol: "Vol",
    stale: "stale",
    noReading: "No reading this period.",
    staleNote: "* stale lane · excluded from average",
    bound: (d: string) => `${d}bound`,
  },
  tc: {
    none: "未選擇檢測器",
    noneSub: "請在地圖或列表中選擇一個檢測器。",
    status: { smooth: "暢順", slow: "緩慢", congested: "擠塞", nodata: "離線" } as Record<EnrichedDetector["status"], string>,
    avg: "平均車速",
    vol: "車流量",
    occ: "最高佔用率",
    veh: "架次",
    trend: "速度走勢 · 本節",
    lane: "行車線",
    speed: "公里/時",
    occCol: "佔用率",
    volCol: "流量",
    stale: "舊數據",
    noReading: "本時段沒有讀數。",
    staleNote: "* 舊行車線數據 · 不計入平均值",
    bound: (d: string) => `${d === "North" ? "北" : d === "South" ? "南" : d === "East" ? "東" : d === "West" ? "西" : d}行`,
  },
};

const STATUS_INK: Record<EnrichedDetector["status"], string> = {
  smooth: "text-go",
  slow: "text-amber",
  congested: "text-signal",
  nodata: "text-muted",
};

export default function DetectorPanel({ d, history, periodLabel }: { d: EnrichedDetector | null; history: number[]; periodLabel: string }) {
  const { lang } = useLocale();
  const t = STR[lang];
  if (!d) {
    return (
      <div className="flex h-full min-h-[280px] flex-col justify-center border-2 border-dashed border-muted p-6">
        <p className="font-display text-xl font-semibold uppercase tracking-wide">{t.none}</p>
        <p className="mt-1 font-readout text-xs text-ink-soft">{t.noneSub}</p>
      </div>
    );
  }
  return (
    <article className="border-2 border-ink bg-paper">
      <header className="border-b-2 border-ink px-4 pb-3 pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-readout text-xs font-bold tracking-widest">{d.id}</span>
          <span className={`font-display text-lg font-bold uppercase tracking-wide ${STATUS_INK[d.status]}`}>{t.status[d.status]}</span>
        </div>
        <h2 className="mt-1 font-display text-2xl font-semibold leading-none">{lang === "tc" ? d.road_tc : d.road_en.replace(/\s*\[AID\d+\]\s*$/, "")}</h2>
        {lang === "en" && <p className="mt-1 text-sm text-ink-soft">{d.road_tc}</p>}
        <p className="mt-1 font-readout text-[11px] uppercase tracking-widest text-muted">{d.district} · {t.bound(d.direction)}</p>
      </header>

      <div className="flex items-end justify-between px-4 pt-3">
        <div>
          <div className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t.avg}</div>
          <div className="font-readout text-6xl font-bold leading-none tabular-nums">
            {d.avgSpeed === null ? "--" : Math.round(d.avgSpeed)}
            <span className="text-lg font-medium text-ink-soft"> {lang === "tc" ? "公里/時" : "km/h"}</span>
          </div>
        </div>
        <div className="pb-1 text-right font-readout text-sm tabular-nums">
          <div><span className="text-2xl font-bold">{d.totalVolume}</span> <span className="text-[11px] uppercase text-muted">{t.veh}</span></div>
          <div><span className="text-2xl font-bold">{d.maxOccupancy}</span><span className="text-[11px] uppercase text-muted"> % {t.occ}</span></div>
        </div>
      </div>

      <div className="px-4 pt-3">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t.trend}</span>
          <span className="font-readout text-[11px] tabular-nums text-muted">{periodLabel}</span>
        </div>
        <Sparkline values={history} width={280} height={52} />
      </div>

      <table className="mt-3 w-full">
        <thead>
          <tr className="border-y-2 border-ink font-display text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft">
            <th className="px-4 py-1 text-left">{t.lane}</th>
            <th className="px-2 py-1 text-right">{t.speed}</th>
            <th className="px-2 py-1 text-right">{t.occCol}</th>
            <th className="px-4 py-1 text-right">{t.volCol}</th>
          </tr>
        </thead>
        <tbody className="font-readout text-sm tabular-nums">
          {d.reading?.lanes.map((l) => (
            <tr key={l.lane_id} className="border-b border-line last:border-b-2 last:border-ink">
              <td className="px-4 py-1.5">{l.lane_id}{l.valid ? "" : ` (${t.stale})`}</td>
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
            <tr><td className="px-4 py-3 text-muted">{t.noReading}</td></tr>
          )}
        </tbody>
      </table>
      <p className="px-4 py-2 font-readout text-[11px] text-muted">{t.staleNote}</p>
    </article>
  );
}
