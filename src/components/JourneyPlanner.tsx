import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { PRESET_PLACES, TUNNEL_LABEL, planRoute, type TdasResult } from "../lib/tdas";

const DEPARTS = [0, 15, 30, 45, 60, 75, 90];

export default function JourneyPlanner() {
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
        <p className="font-readout text-[11px] font-bold uppercase tracking-[0.28em] text-signal">TDAS · updates every 5 min</p>
        <h2 className="font-display text-3xl font-bold uppercase leading-none">Journey planner</h2>
        <p className="mt-1 font-display text-lg text-ink-soft">Predicted average speed and journey time between two points.</p>
      </header>

      <div className="grid gap-4 p-4 md:grid-cols-[1fr_auto_1fr]">
        <label className="block">
          <span className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">From</span>
          <select value={fromIdx} onChange={(e) => setFromIdx(Number(e.target.value))} className="mt-1 w-full border-2 border-ink bg-paper px-2 py-2 font-readout text-sm">
            {PRESET_PLACES.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
          </select>
        </label>
        <div className="flex items-end justify-center pb-1">
          <button onClick={swap} title="Swap" className="border-2 border-ink bg-paper p-2 shadow-[3px_3px_0_var(--color-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
            <ArrowLeftRight size={16} />
          </button>
        </div>
        <label className="block">
          <span className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">To</span>
          <select value={toIdx} onChange={(e) => setToIdx(Number(e.target.value))} className="mt-1 w-full border-2 border-ink bg-paper px-2 py-2 font-readout text-sm">
            {PRESET_PLACES.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
          </select>
        </label>
      </div>

      <div className="grid gap-4 border-t border-line px-4 py-3 md:grid-cols-2">
        <div>
          <span className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">Depart in</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {DEPARTS.map((d) => (
              <button key={d} onClick={() => setDepartIn(d)} className={`border-2 border-ink px-2 py-1 font-readout text-xs font-bold ${departIn === d ? "bg-ink text-paper" : "bg-paper"}`}>
                {d === 0 ? "now" : `+${d}m`}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">Harbour tunnel</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {([["", "auto"], ["cht", "CHT"], ["eht", "EHC"], ["wht", "WHC"]] as const).map(([v, label]) => (
              <button key={v} onClick={() => setTunnel(v)} className={`border-2 border-ink px-2 py-1 font-readout text-xs font-bold ${tunnel === v ? "bg-ink text-paper" : "bg-paper"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t-2 border-ink px-4 py-3">
        <button onClick={go} disabled={busy || fromIdx === toIdx} className="border-2 border-ink bg-signal px-6 py-2 font-display text-xl font-bold uppercase tracking-wide text-paper shadow-[3px_3px_0_var(--color-ink)] disabled:opacity-40 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
          {busy ? "Routing…" : "Get journey time"}
        </button>
        {fromIdx === toIdx && <span className="ml-3 font-readout text-xs text-signal">Origin and destination differ, please.</span>}
      </div>

      {error && <p className="border-t-2 border-signal px-4 py-2 font-readout text-xs text-signal">{error}</p>}

      {result && (
        <div className="border-t-2 border-ink">
          <div className="grid grid-cols-3 divide-x-2 divide-ink">
            <div className="px-4 py-3">
              <div className="font-display text-xs font-bold uppercase tracking-[0.18em] text-muted">Avg speed</div>
              <div className="font-readout text-4xl font-bold tabular-nums">{result.speed}</div>
            </div>
            <div className="px-4 py-3">
              <div className="font-display text-xs font-bold uppercase tracking-[0.18em] text-muted">Journey</div>
              <div className="font-readout text-4xl font-bold tabular-nums">{result.eta}</div>
            </div>
            <div className="px-4 py-3">
              <div className="font-display text-xs font-bold uppercase tracking-[0.18em] text-muted">Distance</div>
              <div className="font-readout text-4xl font-bold tabular-nums">{result.distU}</div>
            </div>
          </div>
          <div className="border-t border-line px-4 py-2 font-readout text-xs">
            <span className="uppercase tracking-widest text-muted">Via </span>
            {result.tunnels.length ? result.tunnels.join(" · ") : "no harbour crossing"}
          </div>
          {result.alternates.length > 0 && (
            <table className="w-full border-t-2 border-ink">
              <thead>
                <tr className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">
                  <th className="px-4 py-1 text-left">Alternate crossing</th>
                  <th className="px-4 py-1 text-right">Distance</th>
                  <th className="px-4 py-1 text-right">Journey</th>
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

// re-export for tree-shaking friendliness in tests
export { TUNNEL_LABEL };
