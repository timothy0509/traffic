// Same-origin relay for browser-blocked upstreams (no CORS headers).
// Vercel serverless: GET /api/relay?url=<encoded upstream URL>

const ALLOW = new Set([
  "www.censtatd.gov.hk",
  "www.hongkongairport.com",
  "hongkongairport.com",
  "www.customs.gov.hk",
  "www.hkmpdb.gov.hk",
  "openapi.westkowloon.hk",
  "sps-opendata.pilotsmartke.gov.hk",
]);

const UA = "Mozilla/5.0 (compatible; HK-Traffic-Bulletin/1.0; +https://www.censtatd.gov.hk/)";

function cors(res: any): void {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET, OPTIONS");
  res.setHeader("access-control-allow-headers", "*");
}

export default async function handler(req: any, res: any): Promise<void> {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  const raw: unknown =
    (req.query && (req.query as Record<string, unknown>).url) ??
    new URL(req.url || "/", "http://x").searchParams.get("url");
  const target = Array.isArray(raw) ? raw[0] : (raw as string | null);
  if (!target || typeof target !== "string") {
    res.status(400).send("missing ?url=");
    return;
  }
  let u: URL;
  try {
    u = new URL(target);
  } catch {
    res.status(400).send("bad url");
    return;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    res.status(400).send("only http(s) allowed");
    return;
  }
  if (!ALLOW.has(u.hostname)) {
    res.status(400).send(`host not allowlisted: ${u.hostname}`);
    return;
  }
  try {
    const up = await fetch(u.toString(), {
      headers: { "user-agent": UA, accept: "*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
    const ct = up.headers.get("content-type");
    if (ct) res.setHeader("content-type", ct);
    res.setHeader("cache-control", "public, s-maxage=60, max-age=60");
    const buf = Buffer.from(await up.arrayBuffer());
    res.status(up.status).send(buf);
  } catch (e) {
    res.status(502).send(`relay fetch failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}
