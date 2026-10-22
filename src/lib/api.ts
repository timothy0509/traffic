import type { DetectorMeta, LiveResponse } from "./types";

export async function fetchMetas(): Promise<DetectorMeta[]> {
  const r = await fetch("/api/detectors");
  if (!r.ok) throw new Error(`detectors ${r.status}`);
  const j = await r.json();
  return j.detectors as DetectorMeta[];
}

export async function fetchLive(): Promise<LiveResponse> {
  const r = await fetch("/api/live");
  if (!r.ok) throw new Error(`live ${r.status}`);
  return (await r.json()) as LiveResponse;
}
