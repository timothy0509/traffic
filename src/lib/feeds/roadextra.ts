// Road-extras feeds: CCTV index, journey-time corridors, speed-map panels,
// roadworks, junction blacksites, red-light-camera junctions.
// All hosts below send CORS * (probed 2026-10-22); no backend needed.

import { cached, fetchJson, fetchText } from "../http";

export interface TrafficCamera {
  key: string;
  region: string;
  district: string;
  description: string;
  easting: number | null;
  northing: number | null;
  lat: number;
  lng: number;
  pageUrl: string;
}

const CAMERA_INDEX_URL =
  "https://static.data.gov.hk/td/traffic-snapshot-images/code/Traffic_Camera_Locations_En.csv";

export function cameraImageUrl(key: string): string {
  return `https://tdcctv.data.one.gov.hk/${key}.JPG`;
}

function numOrNull(s: string): number | null {
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** UTF-16 tab-separated index (~1020 rows). Cached 24 h. */
export async function cameraIndex(): Promise<TrafficCamera[]> {
  return cached("roadextra:cameras", 24 * 3600_000, async () => {
    const r = await fetch(CAMERA_INDEX_URL);
    if (!r.ok) throw new Error(`${r.status} from static.data.gov.hk`);
    const buf = await r.arrayBuffer();
    const text = new TextDecoder("utf-16").decode(buf);
    const lines = text.split("\n");
    const out: TrafficCamera[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].replace(/^\uFEFF/, "").trim();
      if (!line) continue;
      // key, region, district, description, easting, northing, lat, lng, url
      const cols = line.split("\t");
      if (cols.length < 9) continue;
      const [key, region, district, description, easting, northing, latS, lngS, pageUrl] =
        cols.map((c) => c.trim());
      const lat = Number(latS);
      const lng = Number(lngS);
      if (!key || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      out.push({
        key: key.replace(/^\uFEFF/, ""),
        region,
        district,
        description,
        easting: numOrNull(easting),
        northing: numOrNull(northing),
        lat,
        lng,
        pageUrl,
      });
    }
    return out;
  });
}

export interface CorridorTime {
  from: string;
  to: string;
  minutes: number;
  colour: 1 | 2 | 3 | 0;
  captureDate: string;
}

const CORRIDOR_URL = "https://resource.data.one.gov.hk/td/jss/Journeytimev2.xml";

function tag(row: string, name: string): string {
  const m = row.match(new RegExp(`<${name}>([^<]*)</${name}>`));
  return m ? m[1].trim() : "";
}

/** Journey-time corridors. Caller polls every 2 min; memory cache matches that. */
export async function corridorTimes(): Promise<CorridorTime[]> {
  return cached("roadextra:corridors", 2 * 60_000, async () => {
    const xml = await fetchText(CORRIDOR_URL);
    const rows = xml.match(/<jtis_journey_time>[\s\S]*?<\/jtis_journey_time>/g) ?? [];
    const out: CorridorTime[] = [];
    for (const row of rows) {
      const from = tag(row, "LOCATION_ID");
      const to = tag(row, "DESTINATION_ID");
      const minutes = Number(tag(row, "JOURNEY_DATA"));
      if (!from || !to || !Number.isFinite(minutes)) continue;
      const c = Number(tag(row, "COLOUR_ID"));
      out.push({
        from,
        to,
        minutes,
        colour: c === 1 || c === 2 || c === 3 ? c : 0,
        captureDate: tag(row, "CAPTURE_DATE"),
      });
    }
    out.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
    return out;
  });
}

export type PanelLang = "en" | "tc";

/** Verified 200 at build time (2026-10-22, curl): sj1..sj5 in en/tc/sc; sj6+ 404. */
export const PANEL_IDS: string[] = ["sj1", "sj2", "sj3", "sj4", "sj5"];

export function panelUrl(id: string, lang: PanelLang): string {
  return `https://resource.data.one.gov.hk/td/jss/${id}.${lang}.png`;
}

export interface Roadwork {
  id: string;
  worksType: string;
  start: string;
  end: string;
  district: string;
  lat: number;
  lng: number;
  road: string;
  loc: string;
  bound: string;
  lane: string;
  status: string;
}

const ROADWORKS_URL =
  "https://resource.data.one.gov.hk/td/roadworks-location/get_all_the_roadworks.json";

interface RoadworkRaw {
  roadworks_id?: string | number;
  workstype?: string;
  starttime?: string;
  endtime?: string;
  district?: string;
  latitude?: number | string;
  longitude?: number | string;
  roadname?: string;
  locdesc?: string;
  bound?: string;
  lane?: string;
  worksstatus?: string;
}

/** Roadworks locations. Cached 10 min. */
export async function roadworkList(): Promise<Roadwork[]> {
  return cached("roadextra:roadworks", 10 * 60_000, async () => {
    const raw = await fetchJson<RoadworkRaw[]>(ROADWORKS_URL);
    const out: Roadwork[] = [];
    for (const w of raw) {
      const lat = Number(w.latitude);
      const lng = Number(w.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      out.push({
        id: String(w.roadworks_id ?? `${lat},${lng}`),
        worksType: w.workstype ?? "",
        start: w.starttime ?? "",
        end: w.endtime ?? "",
        district: w.district ?? "Unknown",
        lat,
        lng,
        road: w.roadname ?? "",
        loc: w.locdesc ?? "",
        bound: w.bound ?? "",
        lane: w.lane ?? "",
        status: w.worksstatus ?? "",
      });
    }
    return out;
  });
}

export interface Blacksite {
  type: string;
  junction: string;
  easting: string;
  northing: string;
  note: string;
}

const BLACKSITE_URL =
  "https://www.td.gov.hk/datagovhk_td/junction_blacksite_list/resources/en/junctionblacksite_internet_eng.csv";

/** Quote-aware single CSV line split. */
function splitCsv(line: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      cols.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cols.push(cur);
  return cols;
}

function parseCsv(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map(splitCsv);
}

/**
 * Junction blacksites. Coordinates are HK1980 grid (easting/northing),
 * NOT lat/lng — table only, no map.
 */
export async function blacksiteList(): Promise<Blacksite[]> {
  return cached("roadextra:blacksites", 24 * 3600_000, async () => {
    const rows = parseCsv(await fetchText(BLACKSITE_URL));
    return rows.slice(1).map((c) => ({
      type: (c[0] ?? "").trim(),
      junction: (c[1] ?? "").trim(),
      easting: (c[2] ?? "").trim(),
      northing: (c[3] ?? "").trim(),
      note: (c[4] ?? "").trim(),
    }));
  });
}

export interface RlcSite {
  no: string;
  en: string;
  tc: string;
  sc: string;
  remarks: string;
}

const RLC_URL =
  "https://www.td.gov.hk/datagovhk_td/junctions-with-rlc/resources/junctions_with_rlc.csv";

/** Red-light-camera junctions. Address only, no coordinates — list only. */
export async function rlcList(): Promise<RlcSite[]> {
  return cached("roadextra:rlc", 24 * 3600_000, async () => {
    const rows = parseCsv(await fetchText(RLC_URL));
    return rows
      .slice(1)
      .map((c) => ({
        no: (c[0] ?? "").trim(),
        en: (c[1] ?? "").trim(),
        tc: (c[2] ?? "").trim(),
        sc: (c[3] ?? "").trim(),
        remarks: (c[4] ?? "").trim(),
      }))
      .filter((r) => r.en);
  });
}
