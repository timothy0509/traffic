import { useEffect, useMemo, useState } from "react";
import { SectionShell, ErrorBox, LoadingLine, ChipRow } from "../ui";
import { useLocale, type Locale } from "../../lib/locale";
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

const STR = {
  en: {
    relay: "Feed unavailable. This panel needs the relay host (works on Vercel, not on plain static).",
    kicker: "Census · airport · customs · port",
    title: "Stats desk",
    sub: "Quarterly and daily transport figures behind the live map",
    panels: { census: "Census tables", flights: "HKIA flights", customs: "Boundary vehicles", port: "Port TEU" } as Record<Panel, string>,
    cadence: "Quarterly",
    datasetShort: {
      "650-93021": "Airport transit pax",
      "410-92011": "Air cargo",
      "410-55290": "Container throughput",
      "410-55111": "Seaborne cargo",
      "410-55112": "River cargo",
      "635-92076": "Postal services",
    } as Record<string, string>,
    dataset: "Dataset",
    latestValue: "Latest value",
    noRows: "no rows",
    periodsInSeries: (n: number) => `${n} periods in full series`,
    periodTrend: "Period trend",
    period: "Period",
    breakdown: "Breakdown",
    value: "Value",
    censusSource: (id: string, cadence: string) => `Source: Census and Statistics Dept table ${id} · ${cadence} · via /api/relay`,
    readingCensus: "Reading census tables…",
    hkiaDate: "Date (past only)",
    arrivals: "Arrivals",
    departures: "Departures",
    flights: (n: number) => `${n} flights`,
    readingHkia: "Reading HKIA schedule…",
    noFlights: (d: string) => `No flights returned for ${d}. Past dates only.`,
    time: "Time",
    flight: "Flight",
    toFrom: "To / from",
    status: "Status",
    terGate: "Ter / gate",
    showing60: (n: number) => `Showing 60 of ${n}.`,
    hkiaSource: "Source: Hong Kong International Airport flight info · daily, past dates only · via /api/relay",
    controlPoint: "Control point",
    latestCustoms: (y: number, q: string, v: string) => `Latest: ${y} ${q} · ${v} '000 veh`,
    readingCustoms: "Reading Customs throughput…",
    quarter: "Quarter",
    vehicle: "Vehicle",
    throughput: "Throughput ('000)",
    customsSource: "Source: Customs and Excise Dept, land boundary vehicular throughput · quarterly · via /api/relay",
    latestAnnualTeu: "Latest annual TEU",
    annualTrend: "Annual trend",
    yearWord: (y: number | string) => `Year ${y}`,
    readingPort: "Reading port throughput…",
    year: "Year",
    annualTeu: "Annual TEU",
    portSource: "Source: HKMPDB Kwai Tsing / port container throughput CSV · monthly · via /api/relay",
    hkiaEnNote: "",
  },
  tc: {
    relay: "暫時無法載入。此面板需要中繼主機（僅適用於 Vercel，不適用於純靜態託管）。",
    kicker: "統計處 · 機場 · 海關 · 港口",
    title: "數據台",
    sub: "即時地圖背後的按季及每日運輸數字",
    panels: { census: "統計表", flights: "機場航班", customs: "過境車輛", port: "港口貨櫃" } as Record<Panel, string>,
    cadence: "每季",
    datasetShort: {
      "650-93021": "機場過境旅客",
      "410-92011": "空運貨物",
      "410-55290": "貨櫃吞吐量",
      "410-55111": "海運貨物",
      "410-55112": "河運貨物",
      "635-92076": "郵政服務",
    } as Record<string, string>,
    dataset: "數據集",
    latestValue: "最新數值",
    noRows: "沒有數據",
    periodsInSeries: (n: number) => `完整系列共 ${n} 期`,
    periodTrend: "時期趨勢",
    period: "時期",
    breakdown: "細分",
    value: "數值",
    censusSource: (id: string, cadence: string) => `資料來源：政府統計處表格 ${id} · ${cadence} · 經 /api/relay`,
    readingCensus: "正在讀取統計表…",
    hkiaDate: "日期（只限過去）",
    arrivals: "抵港",
    departures: "離港",
    flights: (n: number) => `共 ${n} 班航班`,
    readingHkia: "正在讀取機場時刻表…",
    noFlights: (d: string) => `${d} 沒有航班記錄。只限過去日期。`,
    time: "時間",
    flight: "航班",
    toFrom: "來往",
    status: "狀況",
    terGate: "客運大樓 / 閘口",
    showing60: (n: number) => `顯示 ${n} 班中的 60 班。`,
    hkiaSource: "資料來源：香港國際機場航班資訊 · 每日，只限過去日期 · 經 /api/relay",
    controlPoint: "管制站",
    latestCustoms: (y: number, q: string, v: string) => `最新：${y} 年 ${q} · ${v} 千車次`,
    readingCustoms: "正在讀取海關車流…",
    quarter: "季度",
    vehicle: "車輛",
    throughput: "車輛流量（千次）",
    customsSource: "資料來源：香港海關陸路邊境車輛流量 · 每季 · 經 /api/relay",
    latestAnnualTeu: "最近全年貨櫃量",
    annualTrend: "全年趨勢",
    yearWord: (y: number | string) => `${y} 年`,
    readingPort: "正在讀取港口吞吐量…",
    year: "年份",
    annualTeu: "全年貨櫃量",
    portSource: "資料來源：海事處葵青 / 港口貨櫃吞吐量 CSV · 每月 · 經 /api/relay",
    hkiaEnNote: "機場官方暫不支援中文參數 — 以下航班資訊為英文原文。",
  },
};

function stringsFor(lang: Locale) {
  return STR[lang];
}

function yesterday(): string {
  return new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
}

function SourceNote({ text }: { text: string }) {
  return <p className="border-t-2 border-ink px-4 py-2 font-readout text-[11px] uppercase tracking-widest text-ink-soft">{text}</p>;
}

function CensusPanel({ lang }: { lang: Locale }) {
  const S = stringsFor(lang);
  const fmt = useMemo(() => new Intl.NumberFormat(lang === "tc" ? "zh-Hant-HK" : "en-HK"), [lang]);
  const [tableId, setTableId] = useState(CENSUS_TABLES[0].id);
  const [dim, setDim] = useState<string>("all");
  const [data, setData] = useState<CensusTableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    setDim("all");
    censusTable(tableId, lang)
      .then((d) => { if (live) { setData(d); setLoading(false); } })
      .catch(() => { if (live) { setError(S.relay); setLoading(false); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, lang]);

  const series = useMemo(() => {
    if (!data) return [];
    return data.rows.filter((r) => dim === "all" || (r.dim ?? "") === dim);
  }, [data, dim]);
  const latest = series[series.length - 1] ?? null;

  if (loading) return <LoadingLine text={S.readingCensus} />;
  if (error || !data) return <ErrorBox message={error ?? S.relay} />;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        <label className="font-readout text-xs font-bold uppercase tracking-widest" htmlFor="census-pick">{S.dataset}</label>
        <select
          id="census-pick"
          value={tableId}
          onChange={(e) => setTableId(e.target.value)}
          className="border-2 border-ink bg-paper px-2 py-1 font-readout text-xs"
        >
          {CENSUS_TABLES.map((t) => (
            <option key={t.id} value={t.id}>{t.id} · {S.datasetShort[t.id] ?? t.short}</option>
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
          <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-muted">{S.latestValue}</p>
          <p className="font-readout text-4xl font-bold tabular-nums">{latest ? fmt.format(latest.value) : "--"}</p>
          <p className="mt-1 font-readout text-xs text-ink-soft">{latest ? latest.label : S.noRows}{data.unit ? ` · ${data.unit}` : ""}</p>
          <p className="mt-1 font-readout text-xs text-ink-soft">{S.periodsInSeries(data.rows.length)}</p>
        </div>
        <div className="border-2 border-ink px-4 py-3 md:border-l-0 max-md:border-t-0">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-muted">{S.periodTrend}</p>
          <div className="mt-2"><Sparkline values={series.slice(-48).map((r) => r.value)} /></div>
        </div>
      </div>
      <div className="overflow-x-auto px-4 pb-3">
        <table className="w-full border-2 border-ink font-readout text-xs">
          <thead>
            <tr className="bg-paper-dim text-left uppercase tracking-widest">
              <th className="border-b-2 border-ink px-2 py-1">{S.period}</th>
              {data.dims.length > 0 && <th className="border-b-2 border-ink px-2 py-1">{S.breakdown}</th>}
              <th className="border-b-2 border-ink px-2 py-1 text-right">{S.value}</th>
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
      <SourceNote text={S.censusSource(tableId, S.cadence)} />
    </div>
  );
}

function FlightsPanel({ lang }: { lang: Locale }) {
  const S = stringsFor(lang);
  const [date, setDate] = useState(yesterday);
  const [arrival, setArrival] = useState(true);
  const [data, setData] = useState<HkiaDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    hkiaFlights(date, arrival, lang)
      .then((d) => { if (live) { setData(d); setLoading(false); } })
      .catch(() => { if (live) { setError(S.relay); setLoading(false); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, arrival, lang]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        <label className="font-readout text-xs font-bold uppercase tracking-widest" htmlFor="hkia-date">{S.hkiaDate}</label>
        <input
          id="hkia-date"
          type="date"
          value={date}
          max={yesterday()}
          onChange={(e) => setDate(e.target.value)}
          className="border-2 border-ink bg-paper px-2 py-1 font-readout text-xs"
        />
        <ChipRow options={["arr", "dep"]} value={arrival ? "arr" : "dep"} onChange={(v) => setArrival(v === "arr")} labels={{ arr: S.arrivals, dep: S.departures }} />
        {data && <span className="font-readout text-xs text-ink-soft">{S.flights(data.flights.length)}</span>}
      </div>
      {S.hkiaEnNote && <p className="px-4 pt-2 font-readout text-[11px] text-ink-soft">{S.hkiaEnNote}</p>}
      <div className="px-4 py-3">
        {loading ? <LoadingLine text={S.readingHkia} /> :
          error || !data ? <ErrorBox message={error ?? S.relay} /> :
          data.flights.length === 0 ? <p className="font-readout text-sm text-ink-soft">{S.noFlights(date)}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full border-2 border-ink font-readout text-xs">
              <thead>
                <tr className="bg-paper-dim text-left uppercase tracking-widest">
                  <th className="border-b-2 border-ink px-2 py-1">{S.time}</th>
                  <th className="border-b-2 border-ink px-2 py-1">{S.flight}</th>
                  <th className="border-b-2 border-ink px-2 py-1">{S.toFrom}</th>
                  <th className="border-b-2 border-ink px-2 py-1">{S.status}</th>
                  <th className="border-b-2 border-ink px-2 py-1">{S.terGate}</th>
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
            {data.flights.length > 60 && <p className="mt-1 font-readout text-[11px] text-ink-soft">{S.showing60(data.flights.length)}</p>}
          </div>
        )}
      </div>
      <SourceNote text={S.hkiaSource} />
    </div>
  );
}

function CustomsPanel({ lang }: { lang: Locale }) {
  const S = stringsFor(lang);
  const fmt = useMemo(() => new Intl.NumberFormat(lang === "tc" ? "zh-Hant-HK" : "en-HK"), [lang]);
  const [rows, setRows] = useState<CustomsRow[] | null>(null);
  const [point, setPoint] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setRows(null);
    customsThroughput(lang)
      .then((r) => { if (live) { setRows(r); if (r.length && !point) setPoint(r[0].point); setLoading(false); } })
      .catch(() => { if (live) { setError(S.relay); setLoading(false); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const points = useMemo(() => [...new Set((rows ?? []).map((r) => r.point))].sort(), [rows]);
  const mine = useMemo(() => (rows ?? []).filter((r) => r.point === point), [rows, point]);
  const latest = mine[mine.length - 1] ?? null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        <label className="font-readout text-xs font-bold uppercase tracking-widest" htmlFor="customs-point">{S.controlPoint}</label>
        <select id="customs-point" value={point} onChange={(e) => setPoint(e.target.value)} className="border-2 border-ink bg-paper px-2 py-1 font-readout text-xs">
          {points.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        {latest && <span className="font-readout text-xs text-ink-soft">{S.latestCustoms(latest.year, latest.quarter, fmt.format(latest.value))}</span>}
      </div>
      <div className="px-4 py-3">
        {loading ? <LoadingLine text={S.readingCustoms} /> :
          error || !rows ? <ErrorBox message={error ?? S.relay} /> : (
          <div className="overflow-x-auto">
            <table className="w-full border-2 border-ink font-readout text-xs">
              <thead>
                <tr className="bg-paper-dim text-left uppercase tracking-widest">
                  <th className="border-b-2 border-ink px-2 py-1">{S.quarter}</th>
                  <th className="border-b-2 border-ink px-2 py-1">{S.vehicle}</th>
                  <th className="border-b-2 border-ink px-2 py-1 text-right">{S.throughput}</th>
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
      <SourceNote text={S.customsSource} />
    </div>
  );
}

function PortPanel({ lang }: { lang: Locale }) {
  const S = stringsFor(lang);
  const fmt = useMemo(() => new Intl.NumberFormat(lang === "tc" ? "zh-Hant-HK" : "en-HK"), [lang]);
  const [rows, setRows] = useState<PortRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setRows(null);
    portTeu(lang)
      .then((r) => { if (live) { setRows(r); setLoading(false); } })
      .catch(() => { if (live) { setError(S.relay); setLoading(false); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

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
          <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-muted">{S.latestAnnualTeu}</p>
          <p className="font-readout text-4xl font-bold tabular-nums">{latest ? fmt.format(Math.round(latest[1])) : "--"}</p>
          <p className="mt-1 font-readout text-xs text-ink-soft">{latest ? S.yearWord(latest[0]) : S.noRows}</p>
        </div>
        <div className="border-2 border-ink px-4 py-3 md:border-l-0 max-md:border-t-0">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-muted">{S.annualTrend}</p>
          <div className="mt-2"><Sparkline values={annual.map(([, v]) => v)} /></div>
        </div>
      </div>
      <div className="px-4 pb-3">
        {loading ? <LoadingLine text={S.readingPort} /> :
          error || !rows ? <ErrorBox message={error ?? S.relay} /> : (
          <div className="overflow-x-auto">
            <table className="w-full border-2 border-ink font-readout text-xs">
              <thead>
                <tr className="bg-paper-dim text-left uppercase tracking-widest">
                  <th className="border-b-2 border-ink px-2 py-1">{S.year}</th>
                  <th className="border-b-2 border-ink px-2 py-1 text-right">{S.annualTeu}</th>
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
      <SourceNote text={S.portSource} />
    </div>
  );
}

export default function StatsSection() {
  const { lang } = useLocale();
  const S = stringsFor(lang);
  const [panel, setPanel] = useState<Panel>("census");
  return (
    <SectionShell
      kicker={S.kicker}
      title={S.title}
      sub={S.sub}
      right={<ChipRow options={["census", "flights", "customs", "port"]} value={panel} onChange={setPanel} labels={{ census: S.panels.census, flights: S.panels.flights, customs: S.panels.customs, port: S.panels.port }} />}
    >
      {panel === "census" && <CensusPanel lang={lang} />}
      {panel === "flights" && <FlightsPanel lang={lang} />}
      {panel === "customs" && <CustomsPanel lang={lang} />}
      {panel === "port" && <PortPanel lang={lang} />}
    </SectionShell>
  );
}
