// Typed client for HK franchised-bus ETA feeds. All hosts send CORS
// `access-control-allow-origin: *`, so the browser polls them directly.
// Static reference data is cached in memory for 24h; ETAs are fetched
// fresh (or with a 20s dedupe window) and callers poll every ~30s.

import { cached, fetchJson } from "../http";
import { lf, type Locale } from "../locale";

const DAY = 24 * 60 * 60 * 1000;
const ETA_TTL = 20 * 1000;

export const KMB_BASE = "https://data.etabus.gov.hk/v1/transport/kmb";
export const GMB_BASE = "https://data.etagmb.gov.hk";
export const CTB_BASE = "https://rt.data.gov.hk/v1/transport/citybus-nwfb";
export const NLB_BASE = "https://rt.data.gov.hk/v2/transport/nlb";
export const DPO_BASE = "https://rt.data.gov.hk";

/** Unwrap `{ data: T }` envelope or return payload as-is. */
function unwrap<T>(json: unknown): T {
  if (json !== null && typeof json === "object" && "data" in json) {
    return (json as { data: T }).data;
  }
  return json as T;
}

/** Minutes from now until an ISO-8601 or "YYYY-MM-DD HH:MM:SS" time. Null when unparseable/past-by-hours. */
export function minutesUntil(when: string | null | undefined): number | null {
  if (!when) return null;
  const iso = when.includes("T") ? when : when.replace(" ", "T");
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / 60000);
}

export function formatEta(when: string | null | undefined, lang: Locale = "en"): string {
  const m = minutesUntil(when);
  if (m === null) return "--";
  if (m <= 0) return lang === "tc" ? "即到" : "now";
  if (m === 1) return lang === "tc" ? "1 分鐘" : "1 min";
  return lang === "tc" ? `${m} 分鐘` : `${m} min`;
}

/** Localized display name for a stop-like record (name_en/name_tc, ...). */
export function dispName(obj: unknown, lang: Locale): string {
  return lf(obj as Record<string, unknown> | undefined | null, "name", lang);
}

/** Localized display origin for a route-like record. */
export function dispOrig(obj: unknown, lang: Locale): string {
  return lf(obj as Record<string, unknown> | undefined | null, "orig", lang);
}

/** Localized display destination for a route/ETA-like record. */
export function dispDest(obj: unknown, lang: Locale): string {
  return lf(obj as Record<string, unknown> | undefined | null, "dest", lang);
}

/** Localized display remark for an ETA-like record (rmk_en/rmk_tc, remarks_en/...). */
export function dispRemark(obj: unknown, lang: Locale): string {
  return lf(obj as Record<string, unknown> | undefined | null, "rmk", lang)
    || lf(obj as Record<string, unknown> | undefined | null, "remarks", lang);
}

/** Localized display route name for an NLB record (routeName_e/routeName_c/routeName_s). */
export function dispRouteName(obj: unknown, lang: Locale): string {
  return lf(obj as Record<string, unknown> | undefined | null, "routeName", lang);
}

/** Localized display stop name for an NLB record (stopName_e/stopName_c). */
export function dispStopName(obj: unknown, lang: Locale): string {
  return lf(obj as Record<string, unknown> | undefined | null, "stopName", lang);
}

// ---------------------------------------------------------------- KMB/LWB

export interface KmbRouteItem {
  route: string;
  bound: string; // "outbound" | "inbound"
  service_type: string;
  orig_en: string;
  dest_en: string;
  orig_tc?: string;
  dest_tc?: string;
}

export interface KmbStop {
  stop: string;
  name_en: string;
  name_tc?: string;
  lat: string;
  long: string;
}

export interface KmbRouteStop {
  seq: number;
  stop: string;
  bound?: string;
  service_type?: string;
}

export interface KmbEta {
  co: string;
  route: string;
  dir: string; // "outbound" | "inbound"
  seq: number;
  stop_seq?: number;
  dest_en: string;
  dest_tc?: string;
  eta: string | null;
  eta_seq?: number;
  rmk_en?: string;
  rmk_tc?: string;
  data_timestamp?: string;
}

export async function listKmbRoutes(lang: Locale = "en"): Promise<KmbRouteItem[]> {
  return cached(`kmb:routes:${lang}`, DAY, async () => {
    const json = await fetchJson<unknown>(`${KMB_BASE}/route/`);
    return unwrap<KmbRouteItem[]>(json) ?? [];
  });
}

export async function getKmbRoute(route: string, bound: string, serviceType: string, lang: Locale = "en"): Promise<KmbRouteItem | null> {
  return cached(`kmb:route:${route}:${bound}:${serviceType}:${lang}`, DAY, async () => {
    try {
      const json = await fetchJson<unknown>(`${KMB_BASE}/route/${encodeURIComponent(route)}/${bound}/${encodeURIComponent(serviceType)}`);
      return unwrap<KmbRouteItem | null>(json) ?? null;
    } catch {
      return null;
    }
  });
}

export async function listKmbStops(lang: Locale = "en"): Promise<KmbStop[]> {
  return cached(`kmb:stops:${lang}`, DAY, async () => {
    const json = await fetchJson<unknown>(`${KMB_BASE}/stop`);
    return unwrap<KmbStop[]>(json) ?? [];
  });
}

export async function getKmbStop(stopId: string, lang: Locale = "en"): Promise<KmbStop | null> {
  return cached(`kmb:stop:${stopId}:${lang}`, DAY, async () => {
    try {
      const json = await fetchJson<unknown>(`${KMB_BASE}/stop/${encodeURIComponent(stopId)}`);
      return unwrap<KmbStop | null>(json) ?? null;
    } catch {
      return null;
    }
  });
}

export async function getKmbRouteStops(route: string, bound: string, serviceType: string, lang: Locale = "en"): Promise<KmbRouteStop[]> {
  return cached(`kmb:routestop:${route}:${bound}:${serviceType}:${lang}`, DAY, async () => {
    const json = await fetchJson<unknown>(`${KMB_BASE}/route-stop/${encodeURIComponent(route)}/${bound}/${encodeURIComponent(serviceType)}`);
    return unwrap<KmbRouteStop[]>(json) ?? [];
  });
}

async function fetchKmbEta(url: string): Promise<KmbEta[]> {
  const json = await fetchJson<unknown>(url);
  const data = unwrap<KmbEta[] | KmbEta | null>(json);
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

/** ETAs for one stop + route (both directions come back; filter by dir if needed). */
export function getKmbStopRouteEta(stopId: string, route: string, serviceType: string, lang: Locale = "en"): Promise<KmbEta[]> {
  return fetchKmbEta(`${KMB_BASE}/eta/${encodeURIComponent(stopId)}/${encodeURIComponent(route)}/${encodeURIComponent(serviceType)}`);
}

/** All routes calling at a stop. */
export function getKmbStopEtas(stopId: string, lang: Locale = "en"): Promise<KmbEta[]> {
  const key = `kmb:eta:stop:${stopId}:${lang}`;
  return cached(key, ETA_TTL, () => fetchKmbEta(`${KMB_BASE}/stop-eta/${encodeURIComponent(stopId)}`));
}

/** Whole-route ETA board. */
export function getKmbRouteEtas(route: string, serviceType: string, lang: Locale = "en"): Promise<KmbEta[]> {
  const key = `kmb:eta:route:${route}:${serviceType}:${lang}`;
  return cached(key, ETA_TTL, () => fetchKmbEta(`${KMB_BASE}/route-eta/${encodeURIComponent(route)}/${encodeURIComponent(serviceType)}`));
}

// ---------------------------------------------------------------- GMB

export type GmbRegion = "HKI" | "KLN" | "NT";

export interface GmbDirection {
  route_seq: number;
  orig_en?: string;
  dest_en?: string;
  orig_tc?: string;
  dest_tc?: string;
  orig_ch?: string;
  dest_ch?: string;
  headway_en?: string;
  headway_tc?: string;
  headway_ch?: string;
}

export interface GmbRouteDetail {
  route_id: number;
  route_code: string;
  region?: string;
  directions?: GmbDirection[];
  orig_en?: string;
  dest_en?: string;
}

export interface GmbRouteStop {
  stop_seq: number;
  stop_id: number;
  name_en?: string;
  name_tc?: string;
}

export interface GmbEtaItem {
  eta_seq?: number;
  eta?: string | null;
  timestamp?: string;
  remarks_en?: string;
  remarks_tc?: string;
  remarks_ch?: string;
  dest_en?: string;
  dest_tc?: string;
  dest_ch?: string;
}

export interface GmbStopInfo {
  stop_id?: number;
  name_en?: string;
  name_tc?: string;
  name_ch?: string;
  coordinates?: { wgs84?: { latitude?: number; longitude?: number } };
}

export async function listGmbRoutes(region: GmbRegion, lang: Locale = "en"): Promise<string[]> {
  return cached(`gmb:routes:${region}:${lang}`, DAY, async () => {
    const json = await fetchJson<unknown>(`${GMB_BASE}/route/${region}`);
    if (json !== null && typeof json === "object" && "routes" in json) {
      const r = (json as { routes: unknown }).routes;
      return Array.isArray(r) ? (r as string[]) : [];
    }
    const data = unwrap<unknown>(json);
    return Array.isArray(data) ? (data as string[]) : [];
  });
}

export async function getGmbRoute(region: GmbRegion, code: string, lang: Locale = "en"): Promise<GmbRouteDetail | null> {
  return cached(`gmb:route:${region}:${code}:${lang}`, DAY, async () => {
    try {
      const json = await fetchJson<unknown>(`${GMB_BASE}/route/${region}/${encodeURIComponent(code)}`);
      const data = unwrap<GmbRouteDetail | null>(json);
      return data ?? null;
    } catch {
      return null;
    }
  });
}

export async function getGmbRouteStops(routeId: number, routeSeq: number, lang: Locale = "en"): Promise<GmbRouteStop[]> {
  return cached(`gmb:routestop:${routeId}:${routeSeq}:${lang}`, DAY, async () => {
    const json = await fetchJson<unknown>(`${GMB_BASE}/route-stop/${routeId}/${routeSeq}`);
    if (json !== null && typeof json === "object" && "route_stops" in json) {
      const r = (json as { route_stops: unknown }).route_stops;
      return Array.isArray(r) ? (r as GmbRouteStop[]) : [];
    }
    const data = unwrap<GmbRouteStop[]>(json);
    return Array.isArray(data) ? data : [];
  });
}

export function getGmbRouteStopEta(routeId: number, routeSeq: number, stopSeq: number, lang: Locale = "en"): Promise<GmbEtaItem[]> {
  const key = `gmb:eta:${routeId}:${routeSeq}:${stopSeq}:${lang}`;
  return cached(key, ETA_TTL, async () => {
    const json = await fetchJson<unknown>(`${GMB_BASE}/eta/route-stop/${routeId}/${routeSeq}/${stopSeq}`);
    if (json !== null && typeof json === "object" && "eta" in json) {
      const e = (json as { eta: unknown }).eta;
      if (!e) return [];
      return Array.isArray(e) ? (e as GmbEtaItem[]) : [e as GmbEtaItem];
    }
    const data = unwrap<GmbEtaItem[] | GmbEtaItem | null>(json);
    if (!data) return [];
    return Array.isArray(data) ? data : [data];
  });
}

export function getGmbStopEta(stopId: number | string, lang: Locale = "en"): Promise<GmbEtaItem[]> {
  const key = `gmb:eta:stop:${stopId}:${lang}`;
  return cached(key, ETA_TTL, async () => {
    const json = await fetchJson<unknown>(`${GMB_BASE}/eta/stop/${encodeURIComponent(String(stopId))}`);
    if (json !== null && typeof json === "object" && "eta" in json) {
      const e = (json as { eta: unknown }).eta;
      if (!e) return [];
      return Array.isArray(e) ? (e as GmbEtaItem[]) : [e as GmbEtaItem];
    }
    const data = unwrap<GmbEtaItem[] | GmbEtaItem | null>(json);
    if (!data) return [];
    return Array.isArray(data) ? data : [data];
  });
}

export async function getGmbStop(stopId: number | string, lang: Locale = "en"): Promise<GmbStopInfo | null> {
  return cached(`gmb:stop:${stopId}:${lang}`, DAY, async () => {
    try {
      const json = await fetchJson<unknown>(`${GMB_BASE}/stop/${encodeURIComponent(String(stopId))}`);
      return unwrap<GmbStopInfo | null>(json) ?? null;
    } catch {
      return null;
    }
  });
}

// ---------------------------------------------------------------- Citybus

export interface CtbRoute {
  co: string;
  route: string;
  orig_en: string;
  dest_en: string;
  orig_tc?: string;
  dest_tc?: string;
}

export interface CtbRouteStop {
  seq: number;
  stop: string;
  bound?: string;
}

export interface CtbStop {
  stop: string;
  name_en: string;
  name_tc?: string;
  lat: string;
  long: string;
}

export interface CtbEta {
  co: string;
  route: string;
  dir: string; // "outbound" | "inbound"
  seq: number;
  stop: string;
  eta: string | null;
  eta_seq?: number;
  dest_en?: string;
  dest_tc?: string;
  rmk_en?: string;
  rmk_tc?: string;
  data_timestamp?: string;
}

export async function listCtbRoutes(lang: Locale = "en"): Promise<CtbRoute[]> {
  return cached(`ctb:routes:${lang}`, DAY, async () => {
    const json = await fetchJson<unknown>(`${CTB_BASE}/route/ctb`);
    return unwrap<CtbRoute[]>(json) ?? [];
  });
}

export async function getCtbRouteStops(route: string, bound: "outbound" | "inbound", lang: Locale = "en"): Promise<CtbRouteStop[]> {
  return cached(`ctb:routestop:${route}:${bound}:${lang}`, DAY, async () => {
    const json = await fetchJson<unknown>(`${CTB_BASE}/route-stop/ctb/${encodeURIComponent(route)}/${bound}`);
    return unwrap<CtbRouteStop[]>(json) ?? [];
  });
}

export async function getCtbStop(stopId: string, lang: Locale = "en"): Promise<CtbStop | null> {
  return cached(`ctb:stop:${stopId}:${lang}`, DAY, async () => {
    try {
      const json = await fetchJson<unknown>(`${CTB_BASE}/stop/${encodeURIComponent(stopId)}`);
      return unwrap<CtbStop | null>(json) ?? null;
    } catch {
      return null;
    }
  });
}

/** Both directions come back for a stop+route pair. */
export function getCtbEtas(stopId: string, route: string, lang: Locale = "en"): Promise<CtbEta[]> {
  const key = `ctb:eta:${stopId}:${route}:${lang}`;
  return cached(key, ETA_TTL, async () => {
    const json = await fetchJson<unknown>(`${CTB_BASE}/eta/ctb/${encodeURIComponent(stopId)}/${encodeURIComponent(route)}`);
    const data = unwrap<CtbEta[] | null>(json);
    return Array.isArray(data) ? data : [];
  });
}

// ---------------------------------------------------------------- NLB (v2 only; v1 deprecated)

export interface NlbRoute {
  routeId: string;
  routeNo: string;
  routeName_e?: string;
  routeName_c?: string;
  routeName_s?: string;
}

export interface NlbStop {
  stopId: string;
  stopName_e?: string;
  stopName_c?: string;
  stopName_s?: string;
  latitude?: string;
  longitude?: string;
  fare?: string;
}

export interface NlbEta {
  estimatedArrivalTime: string; // "YYYY-MM-DD HH:MM:SS"
  routeVariantName?: string;
  departed?: string;
  noGPS?: string;
  wheelChair?: string;
}

export async function listNlbRoutes(lang: Locale = "en"): Promise<NlbRoute[]> {
  return cached(`nlb:routes:${lang}`, DAY, async () => {
    const json = await fetchJson<{ routes?: NlbRoute[] }>(`${NLB_BASE}/route.php?action=list`);
    return Array.isArray(json.routes) ? json.routes : [];
  });
}

export async function listNlbStops(routeId: string, lang: Locale = "en"): Promise<NlbStop[]> {
  return cached(`nlb:stops:${routeId}:${lang}`, DAY, async () => {
    const json = await fetchJson<{ stops?: NlbStop[] }>(`${NLB_BASE}/stop.php?action=list&routeId=${encodeURIComponent(routeId)}`);
    return Array.isArray(json.stops) ? (json.stops as NlbStop[]) : [];
  });
}

export function getNlbEtas(routeId: string, stopId: string, lang: Locale = "en"): Promise<NlbEta[]> {
  const key = `nlb:eta:${routeId}:${stopId}:${lang}`;
  return cached(key, ETA_TTL, async () => {
    // NOTE: `language=tc` and `language=zh-hant` both return 200 but with
    // English-only text (routeVariantName/message), so always request `en`.
    const json = await fetchJson<{ estimatedArrivals?: NlbEta[] }>(
      `${NLB_BASE}/stop.php?action=estimatedArrivals&routeId=${encodeURIComponent(routeId)}&stopId=${encodeURIComponent(stopId)}&language=en`,
    );
    return Array.isArray(json.estimatedArrivals) ? (json.estimatedArrivals as NlbEta[]) : [];
  });
}

// ---------------------------------------------------------------- DPO batch board (CTB + NLB stops)

export interface BatchStopRoute {
  route?: string;
  orig_en?: string;
  dest_en?: string;
  orig_tc?: string;
  dest_tc?: string;
  service_type?: string;
  [k: string]: unknown;
}

export interface BatchStopEta {
  route?: string;
  dir?: string;
  seq?: number;
  eta?: string | null;
  dest_en?: string;
  dest_tc?: string;
  rmk_en?: string;
  rmk_tc?: string;
  [k: string]: unknown;
}

export async function getBatchStopRoutes(co: "CTB" | "NLB", stopId: string, lang: Locale = "en"): Promise<BatchStopRoute[]> {
  const q = lang === "tc" ? "zh-hant" : "en";
  const json = await fetchJson<unknown>(`${DPO_BASE}/v1.1/transport/batch/stop-route/${co}/${encodeURIComponent(stopId)}?lang=${q}`);
  const data = unwrap<BatchStopRoute[] | BatchStopRoute | null>(json);
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

export function getBatchStopEtas(co: "CTB" | "NLB", stopId: string, lang: Locale = "en"): Promise<BatchStopEta[]> {
  const key = `batch:eta:${co}:${stopId}:${lang}`;
  return cached(key, ETA_TTL, async () => {
    const q = lang === "tc" ? "zh-hant" : "en";
    const json = await fetchJson<unknown>(`${DPO_BASE}/v1/transport/batch/stop-eta/${co}/${encodeURIComponent(stopId)}?lang=${q}`);
    const data = unwrap<BatchStopEta[] | BatchStopEta | null>(json);
    if (!data) return [];
    return Array.isArray(data) ? data : [data];
  });
}
