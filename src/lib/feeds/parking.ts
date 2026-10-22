import { cached, fetchJson, fetchViaRelay } from "../http";
import type { Locale } from "../locale";

const ONE_STOP_URL = "https://api.data.gov.hk/v1/carpark-info-vacancy";
const SPS_INFO_URL = "https://sps-opendata.pilotsmartke.gov.hk/rest/getCarparkInfos";
const SPS_VAC_URL = "https://sps-opendata.pilotsmartke.gov.hk/rest/getCarparkVacancies";
const WKCDA_URL = "https://openapi.westkowloon.hk/datagovhk/carpark";

export interface OpeningPeriod {
  weekdays: string[];
  periodStart: string;
  periodEnd: string;
  excludePublicHoliday?: boolean;
}

export interface ChargeRow {
  weekdays?: string[];
  periodStart?: string;
  periodEnd?: string;
  price?: number;
  type?: string;
  covered?: string;
  remark?: string;
}

export interface OneStopCarpark {
  park_Id: string;
  name: string;
  district?: string;
  displayAddress?: string;
  address?: { region?: string; dcDistrict?: string; streetName?: string; buildingNo?: string };
  latitude: number;
  longitude: number;
  contactNo?: string;
  website?: string;
  opening_status?: string;
  openingHours?: OpeningPeriod[];
  heightLimits?: { height: number; remark?: string }[];
  facilities?: string[];
  paymentMethods?: string[];
  privateCar?: {
    space?: number;
    spaceEV?: number;
    spaceDIS?: number;
    spaceUNL?: number;
    hourlyCharges?: ChargeRow[];
    dayNightParks?: ChargeRow[];
    monthlyCharges?: { price?: number; type?: string; remark?: string }[];
  };
}

// One-stop payload has no live vacancy despite the name. Directory info only.
export async function oneStopInfo(): Promise<OneStopCarpark[]> {
  return cached("parking:onestop", 24 * 3600 * 1000, async () => {
    const j = await fetchJson<{ results: OneStopCarpark[] }>(ONE_STOP_URL);
    return Array.isArray(j.results) ? j.results : [];
  });
}

interface SpsInfoRaw {
  _id: number;
  name: string;
  coordinates?: [number, number];
  privateCar?: { space?: number };
  motorCycle?: { space?: number };
}

interface SpsVacRaw {
  _id: number;
  closed?: boolean;
  privateCar?: { vacancy?: number; vacancyEV?: number; vacancyDIS?: number };
  motorCycle?: { vacancy?: number };
  lastUploadDate?: string;
}

export interface SpsSite {
  id: number;
  name: string;
  lng: number | null;
  lat: number | null;
  closed: boolean;
  carSpaces: number | null;
  carVacancy: number | null;
  carVacancyEV: number | null;
  carVacancyDIS: number | null;
  motoVacancy: number | null;
  lastUpload: string | null;
}

// ONLY live-vacancy source for carparks. No CORS, must go through relay.
export async function spsJoined(): Promise<SpsSite[]> {
  const [info, vac] = await Promise.all([
    fetchViaRelay<{ results: SpsInfoRaw[] }>(SPS_INFO_URL),
    fetchViaRelay<{ results: SpsVacRaw[] }>(SPS_VAC_URL),
  ]);
  const infoById = new Map<number, SpsInfoRaw>((info.results ?? []).map((r) => [r._id, r]));
  return (vac.results ?? []).map((v) => {
    const m = infoById.get(v._id);
    const coords = m?.coordinates;
    return {
      id: v._id,
      name: m?.name ?? `Site ${v._id}`,
      lng: typeof coords?.[0] === "number" ? coords[0] : null,
      lat: typeof coords?.[1] === "number" ? coords[1] : null,
      closed: v.closed === true,
      carSpaces: typeof m?.privateCar?.space === "number" ? m.privateCar.space : null,
      carVacancy: typeof v.privateCar?.vacancy === "number" ? v.privateCar.vacancy : null,
      carVacancyEV: typeof v.privateCar?.vacancyEV === "number" ? v.privateCar.vacancyEV : null,
      carVacancyDIS: typeof v.privateCar?.vacancyDIS === "number" ? v.privateCar.vacancyDIS : null,
      motoVacancy: typeof v.motorCycle?.vacancy === "number" ? v.motorCycle.vacancy : null,
      lastUpload: typeof v.lastUploadDate === "string" ? v.lastUploadDate : null,
    } satisfies SpsSite;
  }).sort((a, b) => a.name.localeCompare(b.name));
}

interface WkcdaVacancy {
  vehicleType: string;
  hourly: number;
  timestamp: string;
}

interface WkcdaRaw {
  id: string;
  name?: { en?: string; tc?: string };
  address?: { en?: string; tc?: string };
  openingStatus?: string;
  heightLimit?: number;
  latitude?: string;
  longitude?: string;
  hourly_park_weekdays_except_public_holidays?: string;
  hourly_park_Sat_Sun_and_public_holidays?: string;
  opening_hours?: string;
  vacancies?: WkcdaVacancy[];
  timestamp?: string;
}

export interface WkcdaCarpark {
  id: string;
  nameEn: string;
  addressEn: string;
  /** Display-ready strings resolved for the requested lang (tc variants in tc mode). */
  name: string;
  address: string;
  openingStatus: string;
  heightLimit: number | null;
  lat: number | null;
  lng: number | null;
  hourlyWeekday: string;
  hourlyWeekend: string;
  openingHours: string;
  vacancies: WkcdaVacancy[];
  timestamp: string;
}

// WKCDA nests trilingual text as { en, tc, sc } objects rather than the flat
// *_tc suffixed keys lf() expects, so pick directly here.
function pickNested(o: { en?: string; tc?: string } | undefined, lang: Locale, fb: string): string {
  if (lang === "tc") return o?.tc || o?.en || fb;
  return o?.en || o?.tc || fb;
}

export async function wkcda(lang: Locale = "en"): Promise<WkcdaCarpark[]> {
  const j = await fetchViaRelay<{ carParks: WkcdaRaw[] }>(WKCDA_URL);
  const list = Array.isArray(j.carParks) ? j.carParks : [];
  return list.map((c) => ({
    id: c.id,
    nameEn: c.name?.en ?? c.id,
    addressEn: c.address?.en ?? "",
    name: pickNested(c.name, lang, c.id),
    address: pickNested(c.address, lang, ""),
    openingStatus: c.openingStatus ?? "",
    heightLimit: typeof c.heightLimit === "number" ? c.heightLimit : null,
    lat: c.latitude != null && c.latitude !== "" ? Number(c.latitude) : null,
    lng: c.longitude != null && c.longitude !== "" ? Number(c.longitude) : null,
    hourlyWeekday: c.hourly_park_weekdays_except_public_holidays ?? "",
    hourlyWeekend: c.hourly_park_Sat_Sun_and_public_holidays ?? "",
    openingHours: c.opening_hours ?? "",
    vacancies: Array.isArray(c.vacancies) ? c.vacancies : [],
    timestamp: c.timestamp ?? "",
  }));
}
