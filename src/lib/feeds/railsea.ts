// Typed clients for MTR Next Train / Light Rail / MTR Bus / ferries (HKKF + Sun Ferry).
// Pure client-side: every call is a direct browser fetch, no backend, no auth.
// Fortune Ferry / Water Taxi intentionally NOT wired (operator Cloudflare-blocks automated access).

import { cached, fetchJson, fetchText } from "../http";
import { lf, type Locale } from "../locale";

// ---------------------------------------------------------------- MTR heavy rail

export type MtrLineCode = "TML" | "EAL" | "KTL" | "ISL" | "TCL" | "AEL" | "DRL";

export interface MtrStation {
  code: string;
  name: string;
}

export interface MtrTrain {
  seq: string;
  dest: string;
  plat: string;
  time: string;
  ttnt: string;
  valid: string;
}

export interface MtrSchedule {
  sysTime: string;
  up: MtrTrain[];
  down: MtrTrain[];
}

// Curated major stations per line (code + English name).
// Covers the busiest interchanges + termini; users can extend freely —
// the section component passes any line/sta pair straight to the API.
export const MTR_LINES: { code: MtrLineCode; name: string }[] = [
  { code: "TML", name: "Tuen Ma Line" },
  { code: "EAL", name: "East Rail Line" },
  { code: "KTL", name: "Kwun Tong Line" },
  { code: "ISL", name: "Island Line" },
  { code: "TCL", name: "Tung Chung Line" },
  { code: "AEL", name: "Airport Express" },
  { code: "DRL", name: "Disneyland Resort Line" },
];

export const MTR_STATIONS: Record<MtrLineCode, MtrStation[]> = {
  TML: [
    { code: "TUM", name: "Tuen Mun" },
    { code: "YUL", name: "Yuen Long" },
    { code: "KSR", name: "Kam Sheung Road" },
    { code: "TWW", name: "Tsuen Wan West" },
    { code: "MEF", name: "Mei Foo" },
    { code: "NAC", name: "Nam Cheong" },
    { code: "HUH", name: "Hung Hom" },
    { code: "HOM", name: "Ho Man Tin" },
    { code: "DIH", name: "Diamond Hill" },
    { code: "TAW", name: "Tai Wai" },
    { code: "MOS", name: "Ma On Shan" },
    { code: "WKS", name: "Wu Kai Sha" },
  ],
  EAL: [
    { code: "ADM", name: "Admiralty" },
    { code: "EXC", name: "Exhibition Centre" },
    { code: "HUH", name: "Hung Hom" },
    { code: "MKK", name: "Mong Kok East" },
    { code: "KOT", name: "Kowloon Tong" },
    { code: "TAW", name: "Tai Wai" },
    { code: "SHT", name: "Sha Tin" },
    { code: "UNI", name: "University" },
    { code: "TPF", name: "Tai Po Market" },
    { code: "FAN", name: "Fanling" },
    { code: "SHS", name: "Sheung Shui" },
    { code: "LOW", name: "Lo Wu" },
  ],
  KTL: [
    { code: "WHA", name: "Whampoa" },
    { code: "HOM", name: "Ho Man Tin" },
    { code: "YMT", name: "Yau Ma Tei" },
    { code: "MOK", name: "Mong Kok" },
    { code: "KOT", name: "Kowloon Tong" },
    { code: "WTS", name: "Wong Tai Sin" },
    { code: "DIH", name: "Diamond Hill" },
    { code: "CHH", name: "Choi Hung" },
    { code: "KOB", name: "Kowloon Bay" },
    { code: "KWT", name: "Kwun Tong" },
    { code: "YAT", name: "Yau Tong" },
    { code: "TKO", name: "Tiu Keng Leng" },
  ],
  ISL: [
    { code: "KET", name: "Kennedy Town" },
    { code: "HKU", name: "HKU" },
    { code: "SHW", name: "Sheung Wan" },
    { code: "CEN", name: "Central" },
    { code: "ADM", name: "Admiralty" },
    { code: "WAC", name: "Wan Chai" },
    { code: "CAB", name: "Causeway Bay" },
    { code: "TIH", name: "Tin Hau" },
    { code: "NOP", name: "North Point" },
    { code: "QUB", name: "Quarry Bay" },
    { code: "TAK", name: "Tai Koo" },
    { code: "CAY", name: "Chai Wan" },
  ],
  TCL: [
    { code: "HOK", name: "Hong Kong" },
    { code: "KOW", name: "Kowloon" },
    { code: "OLY", name: "Olympic" },
    { code: "NAC", name: "Nam Cheong" },
    { code: "LAK", name: "Lai King" },
    { code: "TSY", name: "Tsing Yi" },
    { code: "SUN", name: "Sunny Bay" },
    { code: "TUC", name: "Tung Chung" },
  ],
  AEL: [
    { code: "HOK", name: "Hong Kong" },
    { code: "KOW", name: "Kowloon" },
    { code: "TSY", name: "Tsing Yi" },
    { code: "AIR", name: "Airport" },
    { code: "AWE", name: "AsiaWorld-Expo" },
  ],
  DRL: [
    { code: "SUN", name: "Sunny Bay" },
    { code: "DIS", name: "Disneyland Resort" },
  ],
};

interface MtrRaw {
  sys_time?: string;
  curr_time?: string;
  data?: Record<string, { UP?: MtrTrain[]; DOWN?: MtrTrain[] }>;
  message?: string;
}

export async function fetchMtrSchedule(line: string, sta: string): Promise<MtrSchedule> {
  const url = `https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=${encodeURIComponent(line)}&sta=${encodeURIComponent(sta)}`;
  return cached(`mtr-${line}-${sta}`, 10_000, async () => {
    const raw = await fetchJson<MtrRaw>(url);
    const key = `${line}-${sta}`;
    const bucket = raw.data?.[key];
    return {
      sysTime: raw.sys_time ?? raw.curr_time ?? "",
      up: bucket?.UP ?? [],
      down: bucket?.DOWN ?? [],
    };
  });
}

// ---------------------------------------------------------------- Light Rail

export interface LrtRouteEta {
  route_no: string;
  dest_en: string;
  time_en: string;
  /** Display-ready strings resolved for the requested lang (dest_ch/time_ch in tc mode). */
  dest: string;
  time: string;
}

export interface LrtPlatform {
  platform_id: string;
  route_list: LrtRouteEta[];
}

export interface LrtStation {
  id: string;
  name: string;
}

// Small curated list of well-known stops; any numeric id can be typed in.
export const LRT_STATIONS: LrtStation[] = [
  { id: "010", name: "Yuen Long" },
  { id: "060", name: "Fung Nin Road" },
  { id: "100", name: "Tin Shui Wai" },
  { id: "150", name: "Tin Yiu" },
  { id: "170", name: "Locwood" },
  { id: "200", name: "Tuen Mun" },
  { id: "212", name: "Siu Hong" },
  { id: "240", name: "Tin Wing" },
];

interface LrtRaw {
  platform_list?: (Omit<LrtPlatform, "route_list"> & {
    route_list: (LrtRouteEta & Record<string, unknown>)[];
  })[];
}

export async function fetchLrtSchedule(stationId: string, lang: Locale = "en"): Promise<LrtPlatform[]> {
  const id = stationId.trim();
  return cached(`lrt-${id}-${lang}`, 10_000, async () => {
    const raw = await fetchJson<LrtRaw>(`https://rt.data.gov.hk/v1/transport/mtr/lrt/getSchedule?station_id=${encodeURIComponent(id)}`);
    return (raw.platform_list ?? []).map((p) => ({
      platform_id: p.platform_id,
      route_list: (p.route_list ?? []).map((r) => ({
        route_no: r.route_no,
        dest_en: r.dest_en,
        time_en: r.time_en,
        dest: lf(r, "dest", lang) || "—",
        time: lf(r, "time", lang) || "—",
      })),
    }));
  });
}

// ---------------------------------------------------------------- MTR Bus (POST only)

export interface MtrBusDeparture {
  departureTimeText: string;
  arrivalTimeText: string;
  busId: string;
  isScheduled: string;
}

export interface MtrBusStop {
  busStopId: string;
  bus: MtrBusDeparture[];
}

export const MTR_BUS_EXAMPLES = ["K52", "K65", "K73", "K51", "K54"];

interface MtrBusRaw {
  busStop?: MtrBusStop[];
}

export async function fetchMtrBusSchedule(routeName: string, lang: Locale = "en"): Promise<MtrBusStop[]> {
  const route = routeName.trim().toUpperCase();
  if (!route) throw new Error(lang === "tc" ? "請輸入路線名稱" : "enter a route name");
  return cached(`mtrbus-${route}-${lang}`, 10_000, async () => {
    const raw = await fetchJson<MtrBusRaw>("https://rt.data.gov.hk/v1/transport/mtr/bus/getSchedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: lang === "tc" ? "zh" : "en", routeName: route }),
    });
    return raw.busStop ?? [];
  });
}

// ---------------------------------------------------------------- HKKF ferry

const HKKF = "https://www.hkkfeta.com";

export interface HkkfRoute {
  route_id?: string;
  route_no?: string;
  name_en?: string;
  name_tc?: string;
  route_name_en?: string;
  route_name_tc?: string;
  origin?: string;
  destination?: string;
  [k: string]: unknown;
}

export interface HkkfPier {
  pier_id?: string;
  name_en?: string;
  name_tc?: string;
  lat?: string;
  long?: string;
}

export interface HkkfEta {
  type?: string;
  data?: unknown[];
}

// HKKF publishes routes 1-4 under opendata/route/ (trailing slash required,
// path segments only — query-string forms return 422).
export const HKKF_ROUTES = [
  { id: "1", hint: "Route 1" },
  { id: "2", hint: "Route 2" },
  { id: "3", hint: "Route 3" },
  { id: "4", hint: "Route 4" },
];

export type HkkfDirection = "inbound" | "outbound";

/** Display-ready route name: route_name_tc/name_tc in tc mode, English otherwise. */
export function hkkfRouteName(r: HkkfRoute | undefined, lang: Locale): string {
  if (!r) return "";
  const named = lf(r, "route_name", lang) || lf(r, "name", lang);
  if (named) return named;
  const o = lf(r, "origin", lang);
  const d = lf(r, "destination", lang);
  if (o || d) return `${o} – ${d}`;
  return "";
}

export async function fetchHkkfRoutes(): Promise<HkkfRoute[]> {
  return cached("hkkf-routes", 300_000, async () => {
    const raw = await fetchJson<HkkfRoute[] | { data?: HkkfRoute[] }>(`${HKKF}/opendata/route/`);
    return Array.isArray(raw) ? raw : (raw.data ?? []);
  });
}

// HKKF path rules (verified): route list needs trailing slash; pier, eta,
// timetable and fare endpoints 404 with one — path segments only, no query.
export async function fetchHkkfPier(pierId: string): Promise<HkkfPier> {
  return cached(`hkkf-pier-${pierId}`, 300_000, async () => {
    const raw = await fetchJson<HkkfPier | { data?: HkkfPier }>(`${HKKF}/opendata/pier/${encodeURIComponent(pierId)}`);
    return (raw as { data?: HkkfPier }).data ?? (raw as HkkfPier);
  });
}

export async function fetchHkkfEta(routeId: string, direction: HkkfDirection): Promise<HkkfEta> {
  return cached(`hkkf-eta-${routeId}-${direction}`, 20_000, () =>
    fetchJson<HkkfEta>(`${HKKF}/opendata/eta/${encodeURIComponent(routeId)}/${direction}`),
  );
}

export async function fetchHkkfTimetable(routeId: string, direction: HkkfDirection): Promise<string> {
  return cached(`hkkf-tt-${routeId}-${direction}`, 300_000, () =>
    fetchText(`${HKKF}/opendata/time_table/${encodeURIComponent(routeId)}/${direction}`),
  );
}

export async function fetchHkkfFare(routeId: string): Promise<string> {
  return cached(`hkkf-fare-${routeId}`, 300_000, () =>
    fetchText(`${HKKF}/opendata/fare_table/${encodeURIComponent(routeId)}`),
  );
}

// ---------------------------------------------------------------- Sun Ferry

export interface SunFerrySailing {
  routecode?: string;
  route_en?: string;
  route_tc?: string;
  vesselcode?: string;
  depart_time?: string;
  eta?: string;
  rmk_en?: string | null;
  rmk_tc?: string | null;
  lat?: string | number;
  lng?: string | number;
  /** Display-ready strings resolved for the requested lang (route_tc/rmk_tc in tc mode). */
  routeName: string;
  remark: string;
}

export const SUNFERRY_ROUTES = [
  { code: "CECC", label: "Central → Cheung Chau" },
  { code: "CCCE", label: "Cheung Chau → Central" },
  { code: "CEMW", label: "Central → Mui Wo" },
  { code: "MWCE", label: "Mui Wo → Central" },
  { code: "NPHH", label: "North Point → Hung Hom" },
  { code: "HHNP", label: "Hung Hom → North Point" },
  { code: "NPKC", label: "North Point → Kowloon City" },
  { code: "KCNP", label: "Kowloon City → North Point" },
];

export async function fetchSunFerry(route: string, lang: Locale = "en"): Promise<SunFerrySailing[]> {
  const code = route.trim().toUpperCase();
  if (!code) throw new Error(lang === "tc" ? "請選擇航線" : "pick a route");
  type Raw = SunFerrySailing & Record<string, unknown>;
  return cached(`sunferry-${code}-${lang}`, 20_000, async () => {
    const raw = await fetchJson<{ data?: Raw[] } | Raw[]>(
      `https://www.sunferry.com.hk/eta/?route=${encodeURIComponent(code)}`,
    );
    const list = Array.isArray(raw) ? raw : (raw.data ?? []);
    return list.map((s) => ({
      ...s,
      routeName: lf(s, "route", lang) || s.routecode || code,
      remark: lf(s, "rmk", lang),
    }));
  });
}

// ---------------------------------------------------------------- countdown helpers

function parseClock(s: string): { h: number; m: number; s2: number } | null {
  const m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]), s2: Number(m[3] ?? 0) };
}

/** Minutes from `now` until an MTR `time` field (accepts "HH:MM" or "YYYY-MM-DD HH:MM:SS"). */
export function minutesUntil(timeStr: string, now: Date = new Date()): number | null {
  const full = timeStr.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (full) {
    const t = new Date(
      Number(full[1]), Number(full[2]) - 1, Number(full[3]),
      Number(full[4]), Number(full[5]), Number(full[6] ?? 0),
    );
    return Math.round((t.getTime() - now.getTime()) / 60000);
  }
  const c = parseClock(timeStr);
  if (!c) return null;
  const t = new Date(now);
  t.setHours(c.h, c.m, c.s2, 0);
  let diff = Math.round((t.getTime() - now.getTime()) / 60000);
  if (diff < -12 * 60) diff += 24 * 60; // crossed midnight
  return diff;
}

/** Compact countdown label, localized. tc: "即到" / "N 分鐘". */
export function countdownLabel(mins: number | null, fallback: string, lang: Locale = "en"): string {
  if (mins === null) return fallback;
  if (mins <= 0) return lang === "tc" ? "即到" : "due";
  if (mins < 60) return lang === "tc" ? `${mins} 分鐘` : `${mins} min`;
  return fallback;
}
