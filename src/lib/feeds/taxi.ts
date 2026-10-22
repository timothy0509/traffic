import { fetchJson } from "../http";

export type FleetId = "amigo" | "bigboss" | "joie";

export interface TaxiVehicle {
  veh_id: string;
  taxi_type: string;
  passenger_cap: number;
  lat: number;
  long: number;
  time_stamp: string;
  op_status: string;
  fleet: FleetId;
}

export interface FleetCounts {
  total: number;
  vacant: number;
  occupied: number;
  nonService: number;
  newest: string | null;
}

export interface FleetResult {
  fleet: FleetId;
  vehicles: TaxiVehicle[];
  counts: FleetCounts;
}

export const FLEET_URLS: Record<FleetId, string> = {
  amigo: "https://api.amigo.taxi/webx/v1/vehicle/list",
  bigboss: "https://data.bigboss.hk/api/opendata/get_data/all",
  joie: "https://open-api.joie.socif.co/vehicles",
};

export const FLEET_LABELS: Record<FleetId, string> = {
  amigo: "Amigo",
  bigboss: "Big Boss",
  joie: "Joie",
};

export const FLEET_COLORS: Record<FleetId, string> = {
  amigo: "#c8102e",
  bigboss: "#9a6200",
  joie: "#1a7f4b",
};

interface RawTaxi {
  veh_id?: unknown;
  taxi_type?: unknown;
  passenger_cap?: unknown;
  lat?: unknown;
  long?: unknown;
  time_stamp?: unknown;
  op_status?: unknown;
}

function clean(fleet: FleetId, raw: RawTaxi): TaxiVehicle | null {
  if (typeof raw.lat !== "number" || typeof raw.long !== "number") return null;
  if (!Number.isFinite(raw.lat) || !Number.isFinite(raw.long)) return null;
  if (typeof raw.veh_id !== "string" || raw.veh_id === "") return null;
  return {
    veh_id: raw.veh_id,
    taxi_type: typeof raw.taxi_type === "string" ? raw.taxi_type : "",
    passenger_cap: typeof raw.passenger_cap === "number" ? raw.passenger_cap : 0,
    lat: raw.lat,
    long: raw.long,
    time_stamp: typeof raw.time_stamp === "string" ? raw.time_stamp : "",
    op_status: typeof raw.op_status === "string" ? raw.op_status : "",
    fleet,
  };
}

async function fetchFleet(fleet: FleetId): Promise<FleetResult> {
  const j = await fetchJson<{ taxis: RawTaxi[] }>(FLEET_URLS[fleet]);
  const vehicles = (Array.isArray(j.taxis) ? j.taxis : [])
    .map((r) => clean(fleet, r))
    .filter((v): v is TaxiVehicle => v !== null);
  let vacant = 0;
  let occupied = 0;
  let nonService = 0;
  let newest: string | null = null;
  for (const v of vehicles) {
    if (v.op_status === "V") vacant += 1;
    else if (v.op_status === "O") occupied += 1;
    else if (v.op_status === "N") nonService += 1;
    if (v.time_stamp !== "" && (newest === null || v.time_stamp > newest)) newest = v.time_stamp;
  }
  return { fleet, vehicles, counts: { total: vehicles.length, vacant, occupied, nonService, newest } };
}

export async function fleetStatus(): Promise<FleetResult[]> {
  return Promise.all([fetchFleet("amigo"), fetchFleet("bigboss"), fetchFleet("joie")]);
}
