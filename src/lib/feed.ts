import type { DetectorMeta, LiveResponse } from "./types";

// Shared parsers and fetchers for the Transport Department detector feeds.
// Both the smart-lamppost feed and the strategic-roads feed publish the same
// XML/CSV shapes and send `access-control-allow-origin: *`, so the browser
// fetches them directly with no backend.

export interface SourceConfig {
  id: string;
  label: string;
  metaUrl: string;
  liveUrl: string;
  metaTtlMs: number;
  liveTtlMs: number;
  storeKey: string;
  fallback?: DetectorMeta[];
}

function num(v: string | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function parseLiveXml(xml: string): LiveResponse {
  const date = /<date>(.*?)<\/date>/.exec(xml)?.[1] ?? "";
  const periods: LiveResponse["periods"] = [];
  const periodRe = /<period>([\s\S]*?)<\/period>/g;
  let pm: RegExpExecArray | null;
  while ((pm = periodRe.exec(xml))) {
    const body = pm[1];
    const from = /<period_from>(.*?)<\/period_from>/.exec(body)?.[1] ?? "";
    const to = /<period_to>(.*?)<\/period_to>/.exec(body)?.[1] ?? "";
    const detectors: LiveResponse["periods"][number]["detectors"] = [];
    const detRe = /<detector>([\s\S]*?)<\/detector>/g;
    let dm: RegExpExecArray | null;
    while ((dm = detRe.exec(body))) {
      const d = dm[1];
      const id = /<detector_id>(.*?)<\/detector_id>/.exec(d)?.[1] ?? "";
      const direction = /<direction>(.*?)<\/direction>/.exec(d)?.[1] ?? "";
      const lanes: LiveResponse["periods"][number]["detectors"][number]["lanes"] = [];
      const laneRe = /<lane>([\s\S]*?)<\/lane>/g;
      let lm: RegExpExecArray | null;
      while ((lm = laneRe.exec(d))) {
        const l = lm[1];
        const pick = (t: string) => new RegExp(`<${t}>(.*?)<\/${t}>`).exec(l)?.[1] ?? "";
        lanes.push({
          lane_id: pick("lane_id"),
          speed: num(pick("speed")),
          occupancy: num(pick("occupancy")),
          volume: num(pick("volume")),
          valid: pick("valid") === "Y",
        });
      }
      detectors.push({ id, direction, lanes });
    }
    periods.push({ from, to, detectors });
  }
  return { date, fetchedAt: new Date().toISOString(), periods };
}

export function parseMetaCsv(csv: string): DetectorMeta[] {
  const lines = csv.trim().split(/\r?\n/);
  lines.shift();
  const out: DetectorMeta[] = [];
  for (const line of lines) {
    const c = line.split(",");
    if (c.length < 11) continue;
    out.push({
      id: c[0].trim(),
      district: c[1].trim(),
      road_en: c[2].trim(),
      road_tc: c[3].trim(),
      lat: num(c[7]),
      lng: num(c[8]),
      direction: c[9].trim(),
      rotation: num(c[10]),
    });
  }
  return out;
}

const metaCache = new Map<string, { at: number; data: DetectorMeta[] }>();
const liveCache = new Map<string, { at: number; data: LiveResponse }>();

function readStored(key: string): LiveResponse | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const j = JSON.parse(raw) as LiveResponse;
    if (!Array.isArray(j.periods)) return null;
    return j;
  } catch {
    return null;
  }
}

export async function fetchMetas(cfg: SourceConfig): Promise<DetectorMeta[]> {
  const hit = metaCache.get(cfg.id);
  if (hit && Date.now() - hit.at < cfg.metaTtlMs) return hit.data;
  try {
    const r = await fetch(cfg.metaUrl);
    if (!r.ok) throw new Error(`${cfg.id} locations ${r.status}`);
    const data = parseMetaCsv(await r.text());
    if (!data.length) throw new Error(`${cfg.id} locations empty`);
    metaCache.set(cfg.id, { at: Date.now(), data });
    return data;
  } catch {
    if (hit) return hit.data;
    return cfg.fallback ?? [];
  }
}

export async function fetchLive(cfg: SourceConfig): Promise<LiveResponse> {
  const hit = liveCache.get(cfg.id);
  if (hit && Date.now() - hit.at < cfg.liveTtlMs) return hit.data;
  const r = await fetch(cfg.liveUrl);
  if (!r.ok) throw new Error(`${cfg.id} live feed ${r.status}`);
  const data = parseLiveXml(await r.text());
  if (!data.periods.length) throw new Error(`${cfg.id} live feed empty`);
  liveCache.set(cfg.id, { at: Date.now(), data });
  try {
    localStorage.setItem(cfg.storeKey, JSON.stringify(data));
  } catch {
    // storage full or unavailable, ignore
  }
  return data;
}

export function getStoredLive(cfg: SourceConfig): LiveResponse | null {
  return liveCache.get(cfg.id)?.data ?? readStored(cfg.storeKey);
}
