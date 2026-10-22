// Road-extras feeds: CCTV index, journey-time corridors, speed-map panels,
// roadworks, junction blacksites, red-light-camera junctions.
// All hosts below send CORS * (probed 2026-10-22); no backend needed.

import { cached, fetchJson, fetchText } from "../http";
import { lf, type Locale } from "../locale";

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

const CAMERA_URL: Record<Locale, string> = {
  en: "https://static.data.gov.hk/td/traffic-snapshot-images/code/Traffic_Camera_Locations_En.csv",
  tc: "https://static.data.gov.hk/td/traffic-snapshot-images/code/Traffic_Camera_Locations_Tc.csv",
};

export function cameraImageUrl(key: string): string {
  return `https://tdcctv.data.one.gov.hk/${key}.JPG`;
}

function numOrNull(s: string): number | null {
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** UTF-16 tab-separated index (~1020 rows). Cached 24 h. File picked by lang. */
export async function cameraIndex(lang: Locale = "en"): Promise<TrafficCamera[]> {
  return cached(`roadextra:cameras:${lang}`, 24 * 3600_000, async () => {
    const r = await fetch(CAMERA_URL[lang] ?? CAMERA_URL.en);
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

/** Journey-time corridors. LOCATION_ID codes only, no language — `_lang` kept for a uniform call signature. */
export async function corridorTimes(_lang: Locale = "en"): Promise<CorridorTime[]> {
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
  workstype_tc?: string;
  starttime?: string;
  endtime?: string;
  district?: string;
  district_tc?: string;
  latitude?: number | string;
  longitude?: number | string;
  roadname?: string;
  roadname_tc?: string;
  locdesc?: string;
  locdesc_tc?: string;
  bound?: string;
  bound_tc?: string;
  lane?: string;
  lane_tc?: string;
  worksstatus?: string;
  worksstatus_tc?: string;
  [k: string]: unknown;
}

/** Roadworks locations. Cached 10 h-keyed per lang; display strings picked with lf(). */
export async function roadworkList(lang: Locale = "en"): Promise<Roadwork[]> {
  return cached(`roadextra:roadworks:${lang}`, 10 * 60_000, async () => {
    const raw = await fetchJson<RoadworkRaw[]>(ROADWORKS_URL);
    const out: Roadwork[] = [];
    for (const w of raw) {
      const lat = Number(w.latitude);
      const lng = Number(w.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const rec = w as unknown as Record<string, unknown>;
      out.push({
        id: String(w.roadworks_id ?? `${lat},${lng}`),
        worksType: lf(rec, "workstype", lang),
        start: w.starttime ?? "",
        end: w.endtime ?? "",
        district: lf(rec, "district", lang) || "Unknown",
        lat,
        lng,
        road: lf(rec, "roadname", lang),
        loc: lf(rec, "locdesc", lang),
        bound: lf(rec, "bound", lang),
        lane: lf(rec, "lane", lang),
        status: lf(rec, "worksstatus", lang),
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
 * TC variant probed 2026-10-22:
 * .../junction_blacksite_list/resources/tc/junctionblacksite_internet_tc.csv
 * returns 404, so the English file is kept for both langs (chrome notes it).
 */
export async function blacksiteList(_lang: Locale = "en"): Promise<Blacksite[]> {
  return cached(`roadextra:blacksites:${_lang}`, 24 * 3600_000, async () => {
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

/** Red-light-camera junctions. Address only, no coordinates — list only.
 * TC file .../junctions-with-rlc/resources/tc/junctions_with_rlc_tc.csv
 * returns 404 (probed 2026-10-22); the combined en/tc/sc CSV below is kept
 * for both langs and the component picks the column by lang. */
export async function rlcList(_lang: Locale = "en"): Promise<RlcSite[]> {
  return cached(`roadextra:rlc:${_lang}`, 24 * 3600_000, async () => {
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
