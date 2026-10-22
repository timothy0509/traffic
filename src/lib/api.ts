import type { DetectorMeta, LiveResponse } from "./types";
import { FALLBACK_DETECTORS } from "./fallbackDetectors";

// Pure client-side data layer. Both upstream feeds send
// `access-control-allow-origin: *`, so the browser fetches them directly
// with no proxy or backend needed. Works on any static host (Vercel, etc).

const LIVE_URL = "https://resource.data.one.gov.hk/td/traffic-detectors/rawSpeedVol_SLP-all.xml";
const META_URL = "https://static.data.gov.hk/td/traffic-data-slp/info/traffic_speed_volume_occ_info-slp.csv";

const META_TTL = 24 * 3600_000; // detector locations barely change
const LIVE_TTL = 45_000; // upstream refreshes every minute

let metaCache: { at: number; data: DetectorMeta[] } | null = null;
let liveCache: { at: number; data: LiveResponse } | null = null;

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

const LIVE_STORE_KEY = "hk-traffic:last-live";

function readStoredLive(): LiveResponse | null {
  try {
    const raw = localStorage.getItem(LIVE_STORE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as LiveResponse;
    if (!Array.isArray(j.periods)) return null;
    return j;
  } catch {
    return null;
  }
}

export async function fetchMetas(): Promise<DetectorMeta[]> {
  if (metaCache && Date.now() - metaCache.at < META_TTL) return metaCache.data;
  try {
    const r = await fetch(META_URL);
    if (!r.ok) throw new Error(`detectors ${r.status}`);
    const data = parseMetaCsv(await r.text());
    if (!data.length) throw new Error("detectors empty");
    metaCache = { at: Date.now(), data };
    return data;
  } catch {
    // Bundled copy so the map always renders, even offline.
    return metaCache?.data ?? FALLBACK_DETECTORS;
  }
}

export async function fetchLive(): Promise<LiveResponse> {
  if (liveCache && Date.now() - liveCache.at < LIVE_TTL) return liveCache.data;
  const r = await fetch(LIVE_URL);
  if (!r.ok) throw new Error(`live feed ${r.status}`);
  const data = parseLiveXml(await r.text());
  if (!data.periods.length) throw new Error("live feed empty");
  liveCache = { at: Date.now(), data };
  try {
    localStorage.setItem(LIVE_STORE_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable, ignore
  }
  return data;
}

export function getStoredLive(): LiveResponse | null {
  return liveCache?.data ?? readStoredLive();
}
