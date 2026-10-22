import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { PRESET_PLACES, planRoute, type TdasResult } from "../lib/tdas";
import { useLocale } from "../lib/locale";

const DEPARTS = [0, 15, 30, 45, 60, 75, 90];

const STR = {
  en: {
    kicker: "TDAS · updates every 5 min",
    title: "Journey planner",
    sub: "Predicted average speed and journey time between two points.",
    from: "From", to: "To", swap: "Swap",
    depart: "Depart in", now: "now", min: (d: number) => `+${d}m`,
    tunnel: "Harbour tunnel", auto: "auto",
    go: "Get journey time", busy: "Routing…", same: "Origin and destination differ, please.",
    avg: "Avg speed", journey: "Journey", dist: "Distance", via: "Via ", noCross: "no harbour crossing",
    alt: "Alternate crossing",
  },
  tc: {
    kicker: "TDAS · 每 5 分鐘更新",
    title: "行程規劃",
    sub: "預測兩點之間的平均車速及行程時間。",
    from: "起點", to: "終點", swap: "對調",
    depart: "出發時間", now: "即時", min: (d: number) => `+${d}分鐘`,
    tunnel: "海底隧道", auto: "自動",
    go: "查詢行程時間", busy: "規劃中…", same: "起點與終點不能相同。",
    avg: "平均車速", journey: "行程", dist: "距離", via: "經由 ", noCross: "不經海底隧道",
    alt: "替代隧道",
  },
};

export default function JourneyPlanner() {
  const { lang } = useLocale();
  const t = STR[lang];
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(2);
  const [departIn, setDepartIn] = useState(0);
  const [tunnel, setTunnel] = useState<"" | "cht" | "eht" | "wht">("");
  const [result, setResult] = useState<TdasResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await planRoute({
        from: PRESET_PLACES[fromIdx],
        to: PRESET_PLACES[toIdx],
        departIn,
        tunnel: tunnel || undefined,
        lang,
      });
      setResult(r);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const swap = () => {
    setFromIdx(toIdx);
    setToIdx(fromIdx);
  };

  return (
    <section className="border-2 border-ink bg-paper">
      <header className="border-b-2 border-ink px-4 py-3">
        <p className="font-readout text-[11px] font-bold uppercase tracking-[0.28em] text-signal">{t.kicker}</p>
        <h2 className="font-display text-3xl font-bold uppercase leading-none">{t.title}</h2>
        <p className="mt-1 font-display text-lg text-ink-soft">{t.sub}</p>
      </header>

      <div className="grid gap-4 p-4 md:grid-cols-[1fr_auto_1fr]">
        <label className="block">
          <span className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">{t.from}</span>
          <select value={fromIdx} onChange={(e) => setFromIdx(Number(e.target.value))} className="mt-1 w-full border-2 border-ink bg-paper px-2 py-2 font-readout text-sm">
            {PRESET_PLACES.map((p, i) => <option key={p.name} value={i}>{lang === "tc" ? p.name_tc : p.name}</option>)}
          </select>
        </label>
        <div className="flex items-end justify-center pb-1">
          <button onClick={swap} title={t.swap} className="border-2 border-ink bg-paper p-2 shadow-[3px_3px_0_var(--color-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
            <ArrowLeftRight size={16} />
          </button>
        </div>
        <label className="block">
          <span className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">{t.to}</span>
          <select value={toIdx} onChange={(e) => setToIdx(Number(e.target.value))} className="mt-1 w-full border-2 border-ink bg-paper px-2 py-2 font-readout text-sm">
            {PRESET_PLACES.map((p, i) => <option key={p.name} value={i}>{lang === "tc" ? p.name_tc : p.name}</option>)}
          </select>
        </label>
      </div>

      <div className="grid gap-4 border-t border-line px-4 py-3 md:grid-cols-2">
        <div>
          <span className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">{t.depart}</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {DEPARTS.map((d) => (
              <button key={d} onClick={() => setDepartIn(d)} className={`border-2 border-ink px-2 py-1 font-readout text-xs font-bold ${departIn === d ? "bg-ink text-paper" : "bg-paper"}`}>
                {d === 0 ? t.now : t.min(d)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">{t.tunnel}</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {([["", t.auto], ["cht", "CHT"], ["eht", "EHC"], ["wht", "WHC"]] as const).map(([v, label]) => (
              <button key={v} onClick={() => setTunnel(v)} className={`border-2 border-ink px-2 py-1 font-readout text-xs font-bold ${tunnel === v ? "bg-ink text-paper" : "bg-paper"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t-2 border-ink px-4 py-3">
        <button onClick={go} disabled={busy || fromIdx === toIdx} className="border-2 border-ink bg-signal px-6 py-2 font-display text-xl font-bold uppercase tracking-wide text-paper shadow-[3px_3px_0_var(--color-ink)] disabled:opacity-40 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
          {busy ? t.busy : t.go}
        </button>
        {fromIdx === toIdx && <span className="ml-3 font-readout text-xs text-signal">{t.same}</span>}
      </div>

      {error && <p className="border-t-2 border-signal px-4 py-2 font-readout text-xs text-signal">{error}</p>}

      {result && (
        <div className="border-t-2 border-ink">
          <div className="grid grid-cols-3 divide-x-2 divide-ink">
            <div className="px-4 py-3">
              <div className="font-display text-xs font-bold uppercase tracking-[0.18em] text-muted">{t.avg}</div>
              <div className="font-readout text-4xl font-bold tabular-nums">{result.speed}</div>
            </div>
            <div className="px-4 py-3">
              <div className="font-display text-xs font-bold uppercase tracking-[0.18em] text-muted">{t.journey}</div>
              <div className="font-readout text-4xl font-bold tabular-nums">{result.eta}</div>
            </div>
            <div className="px-4 py-3">
              <div className="font-display text-xs font-bold uppercase tracking-[0.18em] text-muted">{t.dist}</div>
              <div className="font-readout text-4xl font-bold tabular-nums">{result.distU}</div>
            </div>
          </div>
          <div className="border-t border-line px-4 py-2 font-readout text-xs">
            <span className="uppercase tracking-widest text-muted">{t.via}</span>
            {result.tunnels.length ? result.tunnels.join(" · ") : t.noCross}
          </div>
          {result.alternates.length > 0 && (
            <table className="w-full border-t-2 border-ink">
              <thead>
                <tr className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">
                  <th className="px-4 py-1 text-left">{t.alt}</th>
                  <th className="px-4 py-1 text-right">{t.dist}</th>
                  <th className="px-4 py-1 text-right">{t.journey}</th>
                </tr>
              </thead>
              <tbody className="font-readout text-sm tabular-nums">
                {result.alternates.map((a) => (
                  <tr key={a.name} className="border-t border-line">
                    <td className="px-4 py-1.5">{a.name}</td>
                    <td className="px-4 py-1.5 text-right">{a.distU}</td>
                    <td className="px-4 py-1.5 text-right font-bold">{a.eta}</td>
                  </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
