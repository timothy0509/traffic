// Client for the Traffic Data Analytics System route API.
// POST origin/destination, get average journey speed, distance, ETA and
// harbour-crossing alternates. CORS is open, so the browser calls it directly.
// Spec: https://tdas-api.hkemobility.gov.hk/tdas/specification/TD_TDAS_API_Specifications.pdf

const ROUTE_URL = "https://tdas-api.hkemobility.gov.hk/tdas/api/route";

export interface TdasPlanArgs {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  departIn?: number; // minutes, one of 0/15/30/45/60/75/90
  type?: "ST" | "SD";
  tunnel?: "cht" | "eht" | "wht";
}

export interface TdasAlternate {
  name: string;
  distU: string;
  eta: string;
}

export interface TdasResult {
  speed: string;
  distU: string;
  eta: string;
  tunnels: string[];
  alternates: TdasAlternate[];
}

const TUNNEL_NAMES: Record<string, string> = {
  cht: "Cross-Harbour Tunnel",
  wht: "Western Harbour Crossing",
  eht: "Eastern Harbour Crossing",
};

export const TUNNEL_LABEL = TUNNEL_NAMES;

export async function planRoute(args: TdasPlanArgs): Promise<TdasResult> {
  const body: Record<string, unknown> = {
    start: { lat: args.from.lat, long: args.from.lng },
    end: { lat: args.to.lat, long: args.to.lng },
    lang: "en",
    type: args.type ?? "ST",
  };
  if (args.departIn) body.departIn = args.departIn;
  if (args.tunnel) body.tunnel = args.tunnel;
  const r = await fetch(ROUTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await r.json()) as Record<string, unknown>;
  if (!r.ok) throw new Error((j.Message as string) || `route ${r.status}`);
  const tunnels = ["cht", "wht", "eht"].filter((t) => j[t] === true).map((t) => TUNNEL_NAMES[t]);
  return {
    speed: String(j.jSpeed ?? "--"),
    distU: String(j.distU ?? "--"),
    eta: String(j.eta ?? "--"),
    tunnels,
    alternates: (Array.isArray(j.ar) ? j.ar : []).map((a) => {
      const alt = a as Record<string, unknown>;
      const name = String(alt.name ?? "");
      return { name: TUNNEL_NAMES[name] ?? name, distU: String(alt.distU ?? ""), eta: String(alt.eta ?? "") };
    }),
  };
}

export interface PresetPlace {
  name: string;
  lat: number;
  lng: number;
}

export const PRESET_PLACES: PresetPlace[] = [
  { name: "Central (IFC)", lat: 22.2849, lng: 114.1577 },
  { name: "Causeway Bay", lat: 22.2806, lng: 114.1855 },
  { name: "Tsim Sha Tsui", lat: 22.2988, lng: 114.1722 },
  { name: "Mong Kok", lat: 22.3193, lng: 114.1694 },
  { name: "Kwun Tong", lat: 22.3126, lng: 114.226 },
  { name: "Sha Tin", lat: 22.3822, lng: 114.1887 },
  { name: "Tsuen Wan", lat: 22.37, lng: 114.1141 },
  { name: "Airport", lat: 22.308, lng: 113.9185 },
];
