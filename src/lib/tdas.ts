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
  lang?: "en" | "tc";
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

const TUNNEL_NAMES: Record<string, { en: string; tc: string }> = {
  cht: { en: "Cross-Harbour Tunnel", tc: "紅磡海底隧道" },
  wht: { en: "Western Harbour Crossing", tc: "西區海底隧道" },
  eht: { en: "Eastern Harbour Crossing", tc: "東區海底隧道" },
};

export const TUNNEL_LABEL = TUNNEL_NAMES;

export async function planRoute(args: TdasPlanArgs): Promise<TdasResult> {
  const lang = args.lang === "tc" ? "tc" : "en";
  const body: Record<string, unknown> = {
    start: { lat: args.from.lat, long: args.from.lng },
    end: { lat: args.to.lat, long: args.to.lng },
    lang,
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
  const tunnels = ["cht", "wht", "eht"].filter((t) => j[t] === true).map((t) => TUNNEL_NAMES[t][lang]);
  return {
    speed: String(j.jSpeed ?? "--"),
    distU: String(j.distU ?? "--"),
    eta: String(j.eta ?? "--"),
    tunnels,
    alternates: (Array.isArray(j.ar) ? j.ar : []).map((a) => {
      const alt = a as Record<string, unknown>;
      const name = String(alt.name ?? "");
      return { name: TUNNEL_NAMES[name]?.[lang] ?? name, distU: String(alt.distU ?? ""), eta: String(alt.eta ?? "") };
    }),
  };
}

export interface PresetPlace {
  name: string;
  name_tc: string;
  lat: number;
  lng: number;
}

export const PRESET_PLACES: PresetPlace[] = [
  { name: "Central (IFC)", name_tc: "中環（國際金融中心）", lat: 22.2849, lng: 114.1577 },
  { name: "Causeway Bay", name_tc: "銅鑼灣", lat: 22.2806, lng: 114.1855 },
  { name: "Tsim Sha Tsui", name_tc: "尖沙咀", lat: 22.2988, lng: 114.1722 },
  { name: "Mong Kok", name_tc: "旺角", lat: 22.3193, lng: 114.1694 },
  { name: "Kwun Tong", name_tc: "觀塘", lat: 22.3126, lng: 114.226 },
  { name: "Sha Tin", name_tc: "沙田", lat: 22.3822, lng: 114.1887 },
  { name: "Tsuen Wan", name_tc: "荃灣", lat: 22.37, lng: 114.1141 },
  { name: "Airport", name_tc: "機場", lat: 22.308, lng: 113.9185 },
];
