import { cached, fetchViaRelay, fetchViaRelayBytes } from "../http";
import type { Locale } from "../locale";

// Typed clients for the statistics feeds. All go through the same-origin
// relay (/api/relay, see api/relay.ts) because the upstream hosts send no
// CORS headers. Memory-cached: census 24h, flights 1h, CSVs 24h.

export interface CensusRow {
  period: string;
  label: string;
  value: number;
  dim?: string;
}

export interface CensusTableData {
  id: string;
  title: string;
  unit: string;
  rows: CensusRow[];
  dims: string[];
}

export interface CensusDataset {
  id: string;
  short: string;
  title: string;
  cadence: string;
}

export const CENSUS_TABLES: CensusDataset[] = [
  { id: "650-93021", short: "Airport transit pax", title: "Arrival transit passengers via HK Airport", cadence: "Quarterly" },
  { id: "410-92011", short: "Air cargo", title: "Inward / outward movements of cargo by air", cadence: "Quarterly" },
  { id: "410-55290", short: "Container throughput", title: "Port container throughput", cadence: "Quarterly" },
  { id: "410-55111", short: "Seaborne cargo", title: "Seaborne cargo throughput", cadence: "Quarterly" },
  { id: "410-55112", short: "River cargo", title: "River cargo throughput", cadence: "Quarterly" },
  { id: "635-92076", short: "Postal services", title: "Postal services statistics", cadence: "Quarterly" },
];

interface CensusRawRow {
  freq?: string;
  period?: string | number;
  figure?: string | number;
  Figure?: string | number;
  sv?: string;
  svDesc?: string;
  [k: string]: unknown;
}

interface CensusRaw {
  header?: { title?: string; unit?: string; [k: string]: unknown };
  dataSet?: CensusRawRow[];
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function dimOf(row: CensusRawRow): string | undefined {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(row)) {
    if (typeof v !== "string") continue;
    if (!/desc$/i.test(k)) continue;
    if (k === "svDesc") continue;
    const t = v.trim();
    if (t && t !== "-" && t !== "N.A.") parts.push(t);
  }
  return parts.length ? parts.join(" / ") : undefined;
}

export async function censusTable(id: string, lang: Locale = "en"): Promise<CensusTableData> {
  return cached(`census:${lang}:${id}`, 24 * 3600_000, async () => {
    const url = `https://www.censtatd.gov.hk/api/get.php?id=${encodeURIComponent(id)}&lang=${lang}&full_series=1`;
    const raw = await fetchViaRelay<CensusRaw>(url, true);
    const title = String(raw.header?.title ?? id);
    const unit = String(raw.header?.unit ?? "");
    const rows: CensusRow[] = [];
    for (const r of raw.dataSet ?? []) {
      const value = num(r.figure ?? r.Figure);
      if (value === null) continue;
      const period = String(r.period ?? "");
      const sv = typeof r.svDesc === "string" && r.svDesc.trim() ? ` · ${r.svDesc.trim()}` : "";
      const dim = dimOf(r);
      rows.push({ period, label: `${period}${sv}`, value, dim });
    }
    rows.sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : (a.dim ?? "") < (b.dim ?? "") ? -1 : 1));
    const dims = [...new Set(rows.map((r) => r.dim ?? "").filter(Boolean))].sort();
    return { id, title, unit, rows, dims };
  });
}

// ---- HKIA past flights ----

export interface HkiaFlight {
  time: string;
  numbers: string[];
  airlines: string[];
  status: string;
  destinations: string[];
  terminal: string;
  gate: string;
}

export interface HkiaDay {
  date: string;
  arrival: boolean;
  flights: HkiaFlight[];
  updated?: string;
}

interface HkiaRawFlight {
  time?: string;
  flight?: { no?: string; airline?: string }[];
  status?: string;
  destination?: string[];
  terminal?: string;
  gate?: string;
}

interface HkiaRawDay {
  date?: string;
  arrival?: boolean;
  list?: HkiaRawFlight[];
  lastUpdatedTime?: string;
}

export async function hkiaFlights(date: string, arrival: boolean, lang: Locale = "en"): Promise<HkiaDay> {
  // NOTE: lang=tc was probed 2026-10-22 and the endpoint rejects it
  // (400 "Invalid value for filtering parameter lang: tc"), so English is
  // requested for both langs. Cache key still carries lang for a uniform signature.
  return cached(`hkia:${lang}:${date}:${arrival ? "arr" : "dep"}`, 3600_000, async () => {
    const url =
      `https://www.hongkongairport.com/flightinfo-rest/rest/flights/past` +
      `?date=${encodeURIComponent(date)}&lang=en&cargo=false&arrival=${arrival ? "true" : "false"}`;
    const raw = await fetchViaRelay<HkiaRawDay[]>(url, true);
    const day = Array.isArray(raw) ? raw[0] : undefined;
    const flights: HkiaFlight[] = (day?.list ?? []).map((f) => ({
      time: String(f.time ?? ""),
      numbers: (f.flight ?? []).map((x) => String(x.no ?? "").trim()).filter(Boolean),
      airlines: [...new Set((f.flight ?? []).map((x) => String(x.airline ?? "").trim()).filter(Boolean))],
      status: String(f.status ?? ""),
      destinations: (f.destination ?? []).map(String),
      terminal: String(f.terminal ?? ""),
      gate: String(f.gate ?? ""),
    }));
    return { date, arrival, flights, updated: day?.lastUpdatedTime ? String(day.lastUpdatedTime) : undefined };
  });
}

// ---- CSV helpers ----

function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (!lines.length) return { header: [], rows: [] };
  const header = splitLine(lines[0].replace(/^\uFEFF/, ""));
  return { header, rows: lines.slice(1).map(splitLine) };
}

// ---- Customs land-boundary vehicular throughput ----

export interface CustomsRow {
  point: string;
  vehicle: string;
  year: number;
  quarter: string;
  value: number;
}

export async function customsThroughput(lang: Locale = "en"): Promise<CustomsRow[]> {
  return cached(`customs:land-veh:${lang}`, 24 * 3600_000, async () => {
    const url =
      lang === "tc"
        ? "https://www.customs.gov.hk/hcms/filemanager/common/csv/statistics/passenger_land_tc.csv"
        : "https://www.customs.gov.hk/hcms/filemanager/common/csv/statistics/passenger_land_en.csv";
    const text = await fetchViaRelay<string>(url, false);
    // EN and TC headers share the same column order (verified 2026-10-22),
    // so parse positionally: point, vehicle, year, quarter, value.
    const { rows } = parseCsv(text);
    const out: CustomsRow[] = [];
    for (const r of rows) {
      const year = Number((r[2] ?? "").replace(/,/g, ""));
      const value = num(r[4]);
      if (!Number.isFinite(year) || value === null) continue;
      out.push({
        point: r[0] ?? "",
        vehicle: r[1] ?? "",
        year,
        quarter: r[3] ?? "",
        value,
      });
    }
    out.sort((a, b) => a.year - b.year || a.quarter.localeCompare(b.quarter));
    return out;
  });
}

// ---- HKMPDB port / Kwai Tsing TEU ----

export interface PortRow {
  year: number;
  month: string;
  total: number;
  kwaiTsing: number | null;
  yoy: number | null;
}

export async function portTeu(lang: Locale = "en"): Promise<PortRow[]> {
  return cached(`hkmpdb:teu:${lang}`, 24 * 3600_000, async () => {
    const url =
      lang === "tc"
        ? "https://www.hkmpdb.gov.hk/document/HKP_KTCT-stat_csv1(TC).csv"
        : "https://www.hkmpdb.gov.hk/document/HKP_KTCT-stat_csv1(EN).csv";
    const buf = await fetchViaRelayBytes(url);
    // TC file is Big5-encoded; decode explicitly so month names survive.
    const text = new TextDecoder(lang === "tc" ? "big5" : "utf-8").decode(buf);
    // EN and TC headers share the same column order (verified 2026-10-22),
    // so parse positionally: year, month, KT, other, total, KT-yoy, ... .
    const { rows } = parseCsv(text);
    const out: PortRow[] = [];
    for (const r of rows) {
      const year = Number((r[0] ?? "").replace(/,/g, ""));
      const total = num(r[4]);
      if (!Number.isFinite(year) || total === null) continue;
      out.push({
        year,
        month: r[1] ?? "",
        total,
        kwaiTsing: num(r[2]),
        yoy: r[5] !== undefined ? num(String(r[5]).replace(/%/g, "")) : null,
      });
    }
    return out;
  });
}
