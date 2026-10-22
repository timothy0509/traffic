// Typed client for HK franchised-bus ETA feeds. All hosts send CORS
// `access-control-allow-origin: *`, so the browser polls them directly.
// Static reference data is cached in memory for 24h; ETAs are fetched
// fresh (or with a 20s dedupe window) and callers poll every ~30s.

import { cached, fetchJson } from "../http";

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

export function formatEta(when: string | null | undefined): string {
  const m = minutesUntil(when);
  if (m === null) return "--";
  if (m <= 0) return "now";
  if (m === 1) return "1 min";
  return `${m} min`;
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
  eta: string | null;
  eta_seq?: number;
  rmk_en?: string;
  data_timestamp?: string;
}

export async function listKmbRoutes(): Promise<KmbRouteItem[]> {
  return cached("kmb:routes", DAY, async () => {
    const json = await fetchJson<unknown>(`${KMB_BASE}/route/`);
    return unwrap<KmbRouteItem[]>(json) ?? [];
  });
}

export async function getKmbRoute(route: string, bound: string, serviceType: string): Promise<KmbRouteItem | null> {
  return cached(`kmb:route:${route}:${bound}:${serviceType}`, DAY, async () => {
    try {
      const json = await fetchJson<unknown>(`${KMB_BASE}/route/${encodeURIComponent(route)}/${bound}/${encodeURIComponent(serviceType)}`);
      return unwrap<KmbRouteItem | null>(json) ?? null;
    } catch {
      return null;
    }
  });
}

export async function listKmbStops(): Promise<KmbStop[]> {
  return cached("kmb:stops", DAY, async () => {
    const json = await fetchJson<unknown>(`${KMB_BASE}/stop`);
    return unwrap<KmbStop[]>(json) ?? [];
  });
}

export async function getKmbStop(stopId: string): Promise<KmbStop | null> {
  return cached(`kmb:stop:${stopId}`, DAY, async () => {
    try {
      const json = await fetchJson<unknown>(`${KMB_BASE}/stop/${encodeURIComponent(stopId)}`);
      return unwrap<KmbStop | null>(json) ?? null;
    } catch {
      return null;
    }
  });
}

export async function getKmbRouteStops(route: string, bound: string, serviceType: string): Promise<KmbRouteStop[]> {
  return cached(`kmb:routestop:${route}:${bound}:${serviceType}`, DAY, async () => {
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
export function getKmbStopRouteEta(stopId: string, route: string, serviceType: string): Promise<KmbEta[]> {
  return fetchKmbEta(`${KMB_BASE}/eta/${encodeURIComponent(stopId)}/${encodeURIComponent(route)}/${encodeURIComponent(serviceType)}`);
}

/** All routes calling at a stop. */
export function getKmbStopEtas(stopId: string): Promise<KmbEta[]> {
  const key = `kmb:eta:stop:${stopId}`;
  return cached(key, ETA_TTL, () => fetchKmbEta(`${KMB_BASE}/stop-eta/${encodeURIComponent(stopId)}`));
}

/** Whole-route ETA board. */
export function getKmbRouteEtas(route: string, serviceType: string): Promise<KmbEta[]> {
  const key = `kmb:eta:route:${route}:${serviceType}`;
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
  headway_en?: string;
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
  dest_en?: string;
}

export interface GmbStopInfo {
  stop_id?: number;
  name_en?: string;
  coordinates?: { wgs84?: { latitude?: number; longitude?: number } };
}

export async function listGmbRoutes(region: GmbRegion): Promise<string[]> {
  return cached(`gmb:routes:${region}`, DAY, async () => {
    const json = await fetchJson<unknown>(`${GMB_BASE}/route/${region}`);
    if (json !== null && typeof json === "object" && "routes" in json) {
      const r = (json as { routes: unknown }).routes;
      return Array.isArray(r) ? (r as string[]) : [];
    }
    const data = unwrap<unknown>(json);
    return Array.isArray(data) ? (data as string[]) : [];
  });
}

export async function getGmbRoute(region: GmbRegion, code: string): Promise<GmbRouteDetail | null> {
  return cached(`gmb:route:${region}:${code}`, DAY, async () => {
    try {
      const json = await fetchJson<unknown>(`${GMB_BASE}/route/${region}/${encodeURIComponent(code)}`);
      const data = unwrap<GmbRouteDetail | null>(json);
      return data ?? null;
    } catch {
      return null;
    }
  });
}

export async function getGmbRouteStops(routeId: number, routeSeq: number): Promise<GmbRouteStop[]> {
  return cached(`gmb:routestop:${routeId}:${routeSeq}`, DAY, async () => {
    const json = await fetchJson<unknown>(`${GMB_BASE}/route-stop/${routeId}/${routeSeq}`);
    if (json !== null && typeof json === "object" && "route_stops" in json) {
      const r = (json as { route_stops: unknown }).route_stops;
      return Array.isArray(r) ? (r as GmbRouteStop[]) : [];
    }
    const data = unwrap<GmbRouteStop[]>(json);
    return Array.isArray(data) ? data : [];
  });
}

export function getGmbRouteStopEta(routeId: number, routeSeq: number, stopSeq: number): Promise<GmbEtaItem[]> {
  const key = `gmb:eta:${routeId}:${routeSeq}:${stopSeq}`;
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

export function getGmbStopEta(stopId: number | string): Promise<GmbEtaItem[]> {
  const key = `gmb:eta:stop:${stopId}`;
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

export async function getGmbStop(stopId: number | string): Promise<GmbStopInfo | null> {
  return cached(`gmb:stop:${stopId}`, DAY, async () => {
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
  rmk_en?: string;
  data_timestamp?: string;
}

export async function listCtbRoutes(): Promise<CtbRoute[]> {
  return cached("ctb:routes", DAY, async () => {
    const json = await fetchJson<unknown>(`${CTB_BASE}/route/ctb`);
    return unwrap<CtbRoute[]>(json) ?? [];
  });
}

export async function getCtbRouteStops(route: string, bound: "outbound" | "inbound"): Promise<CtbRouteStop[]> {
  return cached(`ctb:routestop:${route}:${bound}`, DAY, async () => {
    const json = await fetchJson<unknown>(`${CTB_BASE}/route-stop/ctb/${encodeURIComponent(route)}/${bound}`);
    return unwrap<CtbRouteStop[]>(json) ?? [];
  });
}

export async function getCtbStop(stopId: string): Promise<CtbStop | null> {
  return cached(`ctb:stop:${stopId}`, DAY, async () => {
    try {
      const json = await fetchJson<unknown>(`${CTB_BASE}/stop/${encodeURIComponent(stopId)}`);
      return unwrap<CtbStop | null>(json) ?? null;
    } catch {
      return null;
    }
  });
}

/** Both directions come back for a stop+route pair. */
export function getCtbEtas(stopId: string, route: string): Promise<CtbEta[]> {
  const key = `ctb:eta:${stopId}:${route}`;
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
}

export interface NlbStop {
  stopId: string;
  stopName_e?: string;
  stopName_c?: string;
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

export async function listNlbRoutes(): Promise<NlbRoute[]> {
  return cached("nlb:routes", DAY, async () => {
    const json = await fetchJson<{ routes?: NlbRoute[] }>(`${NLB_BASE}/route.php?action=list`);
    return Array.isArray(json.routes) ? json.routes : [];
  });
}

export async function listNlbStops(routeId: string): Promise<NlbStop[]> {
  return cached(`nlb:stops:${routeId}`, DAY, async () => {
    const json = await fetchJson<{ stops?: NlbStop[] }>(`${NLB_BASE}/stop.php?action=list&routeId=${encodeURIComponent(routeId)}`);
    return Array.isArray(json.stops) ? (json.stops as NlbStop[]) : [];
  });
}

export function getNlbEtas(routeId: string, stopId: string): Promise<NlbEta[]> {
  const key = `nlb:eta:${routeId}:${stopId}`;
  return cached(key, ETA_TTL, async () => {
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
  service_type?: string;
  [k: string]: unknown;
}

export interface BatchStopEta {
  route?: string;
  dir?: string;
  seq?: number;
  eta?: string | null;
  dest_en?: string;
  rmk_en?: string;
  [k: string]: unknown;
}

export async function getBatchStopRoutes(co: "CTB" | "NLB", stopId: string): Promise<BatchStopRoute[]> {
  const json = await fetchJson<unknown>(`${DPO_BASE}/v1.1/transport/batch/stop-route/${co}/${encodeURIComponent(stopId)}`);
  const data = unwrap<BatchStopRoute[] | BatchStopRoute | null>(json);
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

export function getBatchStopEtas(co: "CTB" | "NLB", stopId: string): Promise<BatchStopEta[]> {
  const key = `batch:eta:${co}:${stopId}`;
  return cached(key, ETA_TTL, async () => {
    const json = await fetchJson<unknown>(`${DPO_BASE}/v1/transport/batch/stop-eta/${co}/${encodeURIComponent(stopId)}`);
    const data = unwrap<BatchStopEta[] | BatchStopEta | null>(json);
    if (!data) return [];
    return Array.isArray(data) ? data : [data];
  });
}
