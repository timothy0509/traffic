import { useEffect, useMemo, useState } from "react";
import { SectionShell, ErrorBox, LoadingLine, ChipRow } from "../ui";
import Sparkline from "../Sparkline";
import {
  CENSUS_TABLES,
  censusTable,
  customsThroughput,
  hkiaFlights,
  portTeu,
  type CensusTableData,
  type CustomsRow,
  type HkiaDay,
  type PortRow,
} from "../../lib/feeds/stats";

type Panel = "census" | "flights" | "customs" | "port";

const RELAY_MSG = "Feed unavailable. This panel needs the relay host (works on Vercel, not on plain static).";
const fmt = new Intl.NumberFormat("en-HK");

function yesterday(): string {
  return new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
}

function SourceNote({ text }: { text: string }) {
  return <p className="border-t-2 border-ink px-4 py-2 font-readout text-[11px] uppercase tracking-widest text-ink-soft">{text}</p>;
}

function CensusPanel() {
  const [tableId, setTableId] = useState(CENSUS_TABLES[0].id);
  const [dim, setDim] = useState<string>("all");
  const [data, setData] = useState<CensusTableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const meta = CENSUS_TABLES.find((t) => t.id === tableId) ?? CENSUS_TABLES[0];

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    setDim("all");
    censusTable(tableId)
      .then((d) => { if (live) { setData(d); setLoading(false); } })
      .catch(() => { if (live) { setError(RELAY_MSG); setLoading(false); } });
    return () => { live = false; };
  }, [tableId]);

  const series = useMemo(() => {
    if (!data) return [];
    return data.rows.filter((r) => dim === "all" || (r.dim ?? "") === dim);
  }, [data, dim]);
  const latest = series[series.length - 1] ?? null;

  if (loading) return <LoadingLine text="Reading census tables…" />;
  if (error || !data) return <ErrorBox message={error ?? RELAY_MSG} />;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        <label className="font-readout text-xs font-bold uppercase tracking-widest" htmlFor="census-pick">Dataset</label>
        <select
          id="census-pick"
          value={tableId}
          onChange={(e) => setTableId(e.target.value)}
          className="border-2 border-ink bg-paper px-2 py-1 font-readout text-xs"
        >
          {CENSUS_TABLES.map((t) => (
            <option key={t.id} value={t.id}>{t.id} · {t.short}</option>
          ))}
        </select>
      </div>
      {data.dims.length > 0 && (
        <div className="px-4 pt-2">
          <ChipRow options={["all", ...data.dims]} value={dim} onChange={setDim} />
        </div>
      )}
      <div className="grid gap-0 px-4 py-3 md:grid-cols-2">
        <div className="border-2 border-ink px-4 py-3">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-muted">Latest value</p>
          <p className="font-readout text-4xl font-bold tabular-nums">{latest ? fmt.format(latest.value) : "--"}</p>
          <p className="mt-1 font-readout text-xs text-ink-soft">{latest ? latest.label : "no rows"}{data.unit ? ` · ${data.unit}` : ""}</p>
          <p className="mt-1 font-readout text-xs text-ink-soft">{data.rows.length} periods in full series</p>
        </div>
        <div className="border-2 border-ink px-4 py-3 md:border-l-0 max-md:border-t-0">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-muted">Period trend</p>
          <div className="mt-2"><Sparkline values={series.slice(-48).map((r) => r.value)} /></div>
        </div>
      </div>
      <div className="overflow-x-auto px-4 pb-3">
        <table className="w-full border-2 border-ink font-readout text-xs">
          <thead>
            <tr className="bg-paper-dim text-left uppercase tracking-widest">
              <th className="border-b-2 border-ink px-2 py-1">Period</th>
              {data.dims.length > 0 && <th className="border-b-2 border-ink px-2 py-1">Breakdown</th>}
              <th className="border-b-2 border-ink px-2 py-1 text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {series.slice(-8).reverse().map((r, i) => (
              <tr key={`${r.period}-${r.dim ?? ""}-${i}`} className="tabular-nums">
                <td className="border-t border-line px-2 py-1">{r.label}</td>
                {data.dims.length > 0 && <td className="border-t border-line px-2 py-1">{r.dim ?? "--"}</td>}
                <td className="border-t border-line px-2 py-1 text-right font-bold">{fmt.format(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SourceNote text={`Source: Census and Statistics Dept table ${tableId} · ${meta.cadence} · via /api/relay`} />
    </div>
  );
}

function FlightsPanel() {
  const [date, setDate] = useState(yesterday);
  const [arrival, setArrival] = useState(true);
  const [data, setData] = useState<HkiaDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    hkiaFlights(date, arrival)
      .then((d) => { if (live) { setData(d); setLoading(false); } })
      .catch(() => { if (live) { setError(RELAY_MSG); setLoading(false); } });
    return () => { live = false; };
  }, [date, arrival]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        <label className="font-readout text-xs font-bold uppercase tracking-widest" htmlFor="hkia-date">Date (past only)</label>
        <input
          id="hkia-date"
          type="date"
          value={date}
          max={yesterday()}
          onChange={(e) => setDate(e.target.value)}
          className="border-2 border-ink bg-paper px-2 py-1 font-readout text-xs"
        />
        <ChipRow options={["arr", "dep"]} value={arrival ? "arr" : "dep"} onChange={(v) => setArrival(v === "arr")} labels={{ arr: "Arrivals", dep: "Departures" }} />
        {data && <span className="font-readout text-xs text-ink-soft">{data.flights.length} flights</span>}
      </div>
      <div className="px-4 py-3">
        {loading ? <LoadingLine text="Reading HKIA schedule…" /> :
          error || !data ? <ErrorBox message={error ?? RELAY_MSG} /> :
          data.flights.length === 0 ? <p className="font-readout text-sm text-ink-soft">No flights returned for {date}. Past dates only.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full border-2 border-ink font-readout text-xs">
              <thead>
                <tr className="bg-paper-dim text-left uppercase tracking-widest">
                  <th className="border-b-2 border-ink px-2 py-1">Time</th>
                  <th className="border-b-2 border-ink px-2 py-1">Flight</th>
                  <th className="border-b-2 border-ink px-2 py-1">To / from</th>
                  <th className="border-b-2 border-ink px-2 py-1">Status</th>
                  <th className="border-b-2 border-ink px-2 py-1">Ter / gate</th>
                </tr>
              </thead>
              <tbody>
                {data.flights.slice(0, 60).map((f, i) => (
                  <tr key={`${f.time}-${f.numbers[0] ?? i}-${i}`}>
                    <td className="border-t border-line px-2 py-1 tabular-nums">{f.time}</td>
                    <td className="border-t border-line px-2 py-1 font-bold">{f.numbers.join(" / ") || "--"}</td>
                    <td className="border-t border-line px-2 py-1">{f.destinations.join(", ") || "--"}</td>
                    <td className="border-t border-line px-2 py-1">{f.status || "--"}</td>
                    <td className="border-t border-line px-2 py-1">{[f.terminal, f.gate].filter(Boolean).join(" / ") || "--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.flights.length > 60 && <p className="mt-1 font-readout text-[11px] text-ink-soft">Showing 60 of {data.flights.length}.</p>}
          </div>
        )}
      </div>
      <SourceNote text="Source: Hong Kong International Airport flight info · daily, past dates only · via /api/relay" />
    </div>
  );
}

function CustomsPanel() {
  const [rows, setRows] = useState<CustomsRow[] | null>(null);
  const [point, setPoint] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    customsThroughput()
      .then((r) => { if (live) { setRows(r); if (r.length && !point) setPoint(r[0].point); setLoading(false); } })
      .catch(() => { if (live) { setError(RELAY_MSG); setLoading(false); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const points = useMemo(() => [...new Set((rows ?? []).map((r) => r.point))].sort(), [rows]);
  const mine = useMemo(() => (rows ?? []).filter((r) => r.point === point), [rows, point]);
  const latest = mine[mine.length - 1] ?? null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        <label className="font-readout text-xs font-bold uppercase tracking-widest" htmlFor="customs-point">Control point</label>
        <select id="customs-point" value={point} onChange={(e) => setPoint(e.target.value)} className="border-2 border-ink bg-paper px-2 py-1 font-readout text-xs">
          {points.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        {latest && <span className="font-readout text-xs text-ink-soft">Latest: {latest.year} {latest.quarter} · {fmt.format(latest.value)} '000 veh</span>}
      </div>
      <div className="px-4 py-3">
        {loading ? <LoadingLine text="Reading Customs throughput…" /> :
          error || !rows ? <ErrorBox message={error ?? RELAY_MSG} /> : (
          <div className="overflow-x-auto">
            <table className="w-full border-2 border-ink font-readout text-xs">
              <thead>
                <tr className="bg-paper-dim text-left uppercase tracking-widest">
                  <th className="border-b-2 border-ink px-2 py-1">Quarter</th>
                  <th className="border-b-2 border-ink px-2 py-1">Vehicle</th>
                  <th className="border-b-2 border-ink px-2 py-1 text-right">Throughput ('000)</th>
                </tr>
              </thead>
              <tbody>
                {mine.slice(-12).reverse().map((r, i) => (
                  <tr key={`${r.year}-${r.quarter}-${r.vehicle}-${i}`} className="tabular-nums">
                    <td className="border-t border-line px-2 py-1">{r.year} {r.quarter}</td>
                    <td className="border-t border-line px-2 py-1">{r.vehicle || "--"}</td>
                    <td className="border-t border-line px-2 py-1 text-right font-bold">{fmt.format(r.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <SourceNote text="Source: Customs and Excise Dept, land boundary vehicular throughput · quarterly · via /api/relay" />
    </div>
  );
}

function PortPanel() {
  const [rows, setRows] = useState<PortRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    portTeu()
      .then((r) => { if (live) { setRows(r); setLoading(false); } })
      .catch(() => { if (live) { setError(RELAY_MSG); setLoading(false); } });
    return () => { live = false; };
  }, []);

  const annual = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of rows ?? []) m.set(r.year, (m.get(r.year) ?? 0) + r.total);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [rows]);
  const latest = annual[annual.length - 1] ?? null;

  return (
    <div>
      <div className="grid gap-0 px-4 py-3 md:grid-cols-2">
        <div className="border-2 border-ink px-4 py-3">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-muted">Latest annual TEU</p>
          <p className="font-readout text-4xl font-bold tabular-nums">{latest ? fmt.format(Math.round(latest[1])) : "--"}</p>
          <p className="mt-1 font-readout text-xs text-ink-soft">{latest ? `Year ${latest[0]}` : "no rows"}</p>
        </div>
        <div className="border-2 border-ink px-4 py-3 md:border-l-0 max-md:border-t-0">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-muted">Annual trend</p>
          <div className="mt-2"><Sparkline values={annual.map(([, v]) => v)} /></div>
        </div>
      </div>
      <div className="px-4 pb-3">
        {loading ? <LoadingLine text="Reading port throughput…" /> :
          error || !rows ? <ErrorBox message={error ?? RELAY_MSG} /> : (
          <div className="overflow-x-auto">
            <table className="w-full border-2 border-ink font-readout text-xs">
              <thead>
                <tr className="bg-paper-dim text-left uppercase tracking-widest">
                  <th className="border-b-2 border-ink px-2 py-1">Year</th>
                  <th className="border-b-2 border-ink px-2 py-1 text-right">Annual TEU</th>
                </tr>
              </thead>
              <tbody>
                {annual.slice(-8).reverse().map(([y, v]) => (
                  <tr key={y} className="tabular-nums">
                    <td className="border-t border-line px-2 py-1">{y}</td>
                    <td className="border-t border-line px-2 py-1 text-right font-bold">{fmt.format(Math.round(v))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <SourceNote text="Source: HKMPDB Kwai Tsing / port container throughput CSV · monthly · via /api/relay" />
    </div>
  );
}

export default function StatsSection() {
  const [panel, setPanel] = useState<Panel>("census");
  return (
    <SectionShell
      kicker="Census · airport · customs · port"
      title="Stats desk"
      sub="Quarterly and daily transport figures behind the live map"
      right={<ChipRow options={["census", "flights", "customs", "port"]} value={panel} onChange={setPanel} labels={{ census: "Census tables", flights: "HKIA flights", customs: "Boundary vehicles", port: "Port TEU" }} />}
    >
      {panel === "census" && <CensusPanel />}
      {panel === "flights" && <FlightsPanel />}
      {panel === "customs" && <CustomsPanel />}
      {panel === "port" && <PortPanel />}
    </SectionShell>
  );
}
