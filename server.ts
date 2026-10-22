// Bun server: proxies DATA.GOV.HK live feeds (avoids CORS), caches, serves SPA.
const LIVE_XML = "https://resource.data.one.gov.hk/td/traffic-detectors/rawSpeedVol_SLP-all.xml";
const META_CSV = "https://static.data.gov.hk/td/traffic-data-slp/info/traffic_speed_volume_occ_info-slp.csv";
const PORT = Number(process.env.PORT ?? 3000);

let liveCache: { at: number; json: unknown } | null = null;
let metaCache: { at: number; json: unknown } | null = null;

function num(v: string | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseLiveXml(xml: string) {
  const date = /<date>(.*?)<\/date>/.exec(xml)?.[1] ?? "";
  const periods: { from: string; to: string; detectors: unknown[] }[] = [];
  const periodRe = /<period>([\s\S]*?)<\/period>/g;
  let pm: RegExpExecArray | null;
  while ((pm = periodRe.exec(xml))) {
    const body = pm[1];
    const from = /<period_from>(.*?)<\/period_from>/.exec(body)?.[1] ?? "";
    const to = /<period_to>(.*?)<\/period_to>/.exec(body)?.[1] ?? "";
    const detectors: unknown[] = [];
    const detRe = /<detector>([\s\S]*?)<\/detector>/g;
    let dm: RegExpExecArray | null;
    while ((dm = detRe.exec(body))) {
      const d = dm[1];
      const id = /<detector_id>(.*?)<\/detector_id>/.exec(d)?.[1] ?? "";
      const direction = /<direction>(.*?)<\/direction>/.exec(d)?.[1] ?? "";
      const lanes: unknown[] = [];
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
  return { date, periods };
}

function parseMetaCsv(csv: string) {
  const lines = csv.trim().split(/\r?\n/);
  lines.shift(); // header
  const detectors = [];
  for (const line of lines) {
    // fields contain no quoted commas except road names without commas, safe split
    const c = line.split(",");
    if (c.length < 11) continue;
    detectors.push({
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
  return { detectors };
}

async function handleApi(req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  if (url.pathname === "/api/live") {
    if (liveCache && Date.now() - liveCache.at < 30_000) {
      return Response.json({ ...((liveCache.json as object) ?? {}), cached: true });
    }
    const r = await fetch(LIVE_XML, { headers: { "User-Agent": "hk-traffic-app/1.0" } });
    if (!r.ok) return Response.json({ error: `upstream ${r.status}` }, { status: 502 });
    const xml = await r.text();
    const parsed = parseLiveXml(xml);
    const json = { ...parsed, fetchedAt: new Date().toISOString(), cached: false };
    liveCache = { at: Date.now(), json };
    return Response.json(json);
  }
  if (url.pathname === "/api/detectors") {
    if (metaCache && Date.now() - metaCache.at < 3_600_000) {
      return Response.json(metaCache.json);
    }
    const r = await fetch(META_CSV, { headers: { "User-Agent": "hk-traffic-app/1.0" } });
    if (!r.ok) return Response.json({ error: `upstream ${r.status}` }, { status: 502 });
    const csv = await r.text();
    const json = parseMetaCsv(csv);
    metaCache = { at: Date.now(), json };
    return Response.json(json);
  }
  if (url.pathname === "/api/health") {
    return Response.json({ ok: true, time: new Date().toISOString() });
  }
  return null;
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        const res = await handleApi(req);
        if (res) return res;
      } catch (e) {
        return Response.json({ error: String(e) }, { status: 500 });
      }
      return Response.json({ error: "not found" }, { status: 404 });
    }
    // static: dist (production build) else public hint
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(`dist${path}`);
    if (await file.exists()) {
      return new Response(file);
    }
    // SPA fallback
    const index = Bun.file("dist/index.html");
    if (await index.exists()) return new Response(index);
    return new Response("Run `bunx vite` for dev (proxies /api to :3000), or `bun run build` then `bun server.ts`.", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  },
});

console.log(`traffic server on http://localhost:${server.port}`);
