// Generic CSDI spatial-layer client (pure browser, no backend).
// Verified live: ArcGIS portal echoes CORS, resolver search returns
// FeatureServer hrefs, layer query supports f=geojson paging with
// resultRecordCount/resultOffset + outSR=4326.

import { fetchJson } from "../http";
import type { MapPoint } from "../../components/PointsMap";

export interface CsdiLayerInfo {
  id: number;
  name: string;
  geometryType?: string;
}

export interface GeoJsonFeature {
  type: string;
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, unknown>;
  id?: unknown;
}

export interface GeoJsonFC {
  type: string;
  features: GeoJsonFeature[];
}

interface ResolverLink {
  rel?: string;
  dctype?: string;
  type?: string;
  href?: string;
  url?: string;
}

interface ResolverResult {
  links?: ResolverLink[];
  references?: ResolverLink[];
}

interface ResolverResponse {
  results?: ResolverResult[];
  records?: ResolverResult[];
}

const serviceCache = new Map<string, string>();
const layerListCache = new Map<string, CsdiLayerInfo[]>();
const layerMetaCache = new Map<string, { geometryType?: string; displayField?: string }>();

function withTimeout(ms = 25000): RequestInit {
  try {
    return { signal: AbortSignal.timeout(ms) };
  } catch {
    return {};
  }
}

function normaliseServiceHref(href: string): string {
  let s = href.trim();
  // Resolver sometimes points at a single layer; strip to service root.
  s = s.replace(/\/FeatureServer\/\d+\/?$/i, "/FeatureServer");
  s = s.replace(/\/query\/?$/i, "");
  s = s.replace(/\/+$/, "");
  return s;
}

/** Resolver-first service lookup, cached. Falls back to the common/ folder. */
export async function resolveService(datasetId: string): Promise<string> {
  const hit = serviceCache.get(datasetId);
  if (hit) return hit;
  const fallback = `https://portal.csdi.gov.hk/server/rest/services/common/${datasetId}/FeatureServer`;
  try {
    const j = await fetchJson<ResolverResponse>(
      `https://portal.csdi.gov.hk/geoportal/rest/metadata/search?f=json&q=${encodeURIComponent(datasetId)}`,
      withTimeout(),
    );
    const results = j.results ?? j.records ?? [];
    for (const r of results) {
      const links = r.links ?? r.references ?? [];
      for (const l of links) {
        const href = (l.href ?? l.url ?? "").trim();
        if (!href) continue;
        const dc = `${l.dctype ?? ""} ${l.type ?? ""}`.toLowerCase();
        if (/featureserver/i.test(href) && (l.rel === "related" || dc.includes("featureserver") || dc === "" || dc.includes("arcgis"))) {
          const svc = normaliseServiceHref(href);
          serviceCache.set(datasetId, svc);
          return svc;
        }
      }
    }
    // Second pass: any FeatureServer href at all.
    for (const r of results) {
      const links = r.links ?? r.references ?? [];
      for (const l of links) {
        const href = (l.href ?? l.url ?? "").trim();
        if (/featureserver/i.test(href)) {
          const svc = normaliseServiceHref(href);
          serviceCache.set(datasetId, svc);
          return svc;
        }
      }
    }
  } catch {
    // Resolver failed; fall through to folder guess.
  }
  serviceCache.set(datasetId, fallback);
  return fallback;
}

/** List sublayers of a FeatureServer, cached per service URL. */
export async function layerList(serviceUrl: string): Promise<CsdiLayerInfo[]> {
  const hit = layerListCache.get(serviceUrl);
  if (hit) return hit;
  const j = await fetchJson<{ layers?: Array<{ id: number; name: string; geometryType?: string }> }>(
    `${serviceUrl}?f=json`,
    withTimeout(),
  );
  const layers = (j.layers ?? []).map((l) => ({ id: l.id, name: l.name, geometryType: l.geometryType }));
  layerListCache.set(serviceUrl, layers);
  return layers;
}

/** Layer metadata (geometryType, displayField), cached. */
export async function layerMeta(
  serviceUrl: string,
  layerId: number,
): Promise<{ geometryType?: string; displayField?: string }> {
  const key = `${serviceUrl}#${layerId}`;
  const hit = layerMetaCache.get(key);
  if (hit) return hit;
  try {
    const j = await fetchJson<{ geometryType?: string; displayField?: string }>(
      `${serviceUrl}/${layerId}?f=json`,
      withTimeout(),
    );
    const out = { geometryType: j.geometryType, displayField: j.displayField };
    layerMetaCache.set(key, out);
    return out;
  } catch {
    return {};
  }
}

export function isPointGeometry(geometryType?: string): boolean {
  const g = (geometryType ?? "").toLowerCase();
  if (g.includes("multipoint")) return false;
  return g.includes("point");
}

/**
 * Paged ArcGIS -> GeoJSON query. Caps total features at `limit`
 * (default 5000). Callers should pass geometry:false for polygon /
 * polyline layers and render counts + attribute table instead of pins.
 */
export async function queryLayer(
  serviceUrl: string,
  layerId: number,
  opts?: { geometry?: boolean; limit?: number; pageSize?: number },
): Promise<GeoJsonFC> {
  const geometry = opts?.geometry ?? true;
  const limit = Math.min(opts?.limit ?? 5000, 5000);
  const pageSize = Math.min(opts?.pageSize ?? 1000, 1000);
  const out: GeoJsonFeature[] = [];
  let offset = 0;
  for (;;) {
    const url =
      `${serviceUrl}/${layerId}/query?where=1%3D1&outFields=*&f=geojson` +
      `&resultRecordCount=${pageSize}&resultOffset=${offset}&outSR=4326` +
      `&returnGeometry=${geometry ? "true" : "false"}`;
    const page = await fetchJson<GeoJsonFC>(url, withTimeout(30000));
    const feats = Array.isArray(page.features) ? page.features : [];
    out.push(...feats);
    if (feats.length < pageSize) break;
    offset += feats.length;
    if (offset >= limit) break;
    if (out.length >= limit) break;
  }
  return { type: "FeatureCollection", features: out.slice(0, limit) };
}

/** Full-file fallback (CORS *): whole dataset as GeoJSON, sliced to limit. */
export async function queryFileApi(datasetId: string, layerName: string, limit = 5000): Promise<GeoJsonFC> {
  const url =
    `https://portal.csdi.gov.hk/csdi-webpage/file-api?dataset_id=${encodeURIComponent(datasetId)}` +
    `&format=geojson&layer_name=${encodeURIComponent(layerName)}`;
  const j = await fetchJson<GeoJsonFC | GeoJsonFeature[] | { features?: GeoJsonFeature[] }>(url, withTimeout(30000));
  if (Array.isArray(j)) return { type: "FeatureCollection", features: (j as GeoJsonFeature[]).slice(0, limit) };
  const feats = (j as GeoJsonFC).features ?? (j as { features?: GeoJsonFeature[] }).features ?? [];
  return { type: "FeatureCollection", features: feats.slice(0, limit) };
}

const NAME_KEYS = [
  "NAME",
  "Name",
  "name",
  "NAME_EN",
  "name_en",
  "STR_NO",
  "OBJNAM",
  "ROADNAME",
  "RoadName",
  "STREET",
  "Street",
  "ADDRESS",
  "Address",
  "address",
  "STOP_NAME",
  "PIER_NAME",
  "TITLE",
  "Title",
  "title",
  "LABEL",
  "Label",
  "label",
];

const INTERNAL_KEY = /^(shape|objectid|globalid|fid|shape__.*|st_.*shape)$/i;

/** Best human label for a feature's property bag. */
export function displayName(props: Record<string, unknown>): string {
  for (const k of NAME_KEYS) {
    const v = props[k];
    if (v !== null && v !== undefined && String(v).trim() !== "") return String(v).trim();
  }
  for (const [k, v] of Object.entries(props)) {
    if (/name/i.test(k) && v !== null && v !== undefined && String(v).trim() !== "") return String(v).trim();
  }
  for (const [k, v] of Object.entries(props)) {
    if (INTERNAL_KEY.test(k)) continue;
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  for (const [k, v] of Object.entries(props)) {
    if (/objectid|^fid$|^id$/i.test(k) && v !== null && v !== undefined && String(v).trim() !== "") return `#${String(v).trim()}`;
  }
  return "feature";
}

/** Extract map pins from Point features only; polygons return []. */
export function featureToPoints(fc: GeoJsonFC): MapPoint[] {
  const pts: MapPoint[] = [];
  fc.features.forEach((f, i) => {
    const g = f.geometry;
    if (!g || g.type !== "Point" || !Array.isArray(g.coordinates)) return;
    const [lng, lat] = g.coordinates as unknown[];
    if (typeof lng !== "number" || typeof lat !== "number") return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const props = f.properties ?? {};
    const oid = props.OBJECTID ?? props.ObjectId ?? props.objectid ?? props.FID ?? i;
    pts.push({ id: `f${String(oid)}-${i}`, lat, lng, tip: displayName(props).slice(0, 90) });
  });
  return pts;
}
