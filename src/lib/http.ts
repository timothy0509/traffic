// Tiny fetch helper: TTL memory cache + JSON/text convenience.
// All upstream hosts used here send CORS headers; hosts that don't go
// through /api/relay (Vercel serverless, see api/relay.ts) instead.

const mem = new Map<string, { at: number; data: unknown }>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = mem.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
  const data = await fn();
  mem.set(key, { at: Date.now(), data });
  return data;
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${r.status} from ${new URL(url).hostname}`);
  return (await r.json()) as T;
}

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${r.status} from ${new URL(url).hostname}`);
  return r.text();
}

// Same-origin relay for hosts without CORS headers (censtatd, HKG airport,
// customs, HKMPDB, Kowloon East parking, WKCDA). Works on Vercel via
// api/relay.ts; on plain static hosts it 404s and callers must degrade.
export async function fetchViaRelay<T>(url: string, asJson = true): Promise<T> {
  const r = await fetch(`/api/relay?url=${encodeURIComponent(url)}`);
  if (!r.ok) throw new Error(`relay ${r.status}`);
  return (asJson ? await r.json() : await r.text()) as T;
}
