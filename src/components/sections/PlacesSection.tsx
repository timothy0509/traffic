// CSDI spatial-layer browser: pick any of the 86 registry datasets,
// resolve its ArcGIS FeatureServer, page through one sublayer, and
// render pins for point layers or counts + attribute table otherwise.

import { useEffect, useMemo, useRef, useState } from "react";
import { CSDI_LAYERS } from "../../lib/feeds/csdiLayers";
import {
  displayName,
  featureToPoints,
  isPointGeometry,
  layerList,
  layerMeta,
  queryFileApi,
  queryLayer,
  resolveService,
  type GeoJsonFC,
} from "../../lib/feeds/csdi";
import { fetchJson } from "../../lib/http";
import PointsMap, { HK_CENTER, type MapPoint } from "../PointsMap";
import { ChipRow, ErrorBox, LoadingLine, SectionShell } from "../ui";

type Group = "td" | "hyd" | "marine" | "other";

const GROUPS: Group[] = ["td", "hyd", "marine", "other"];
const GROUP_LABEL: Record<Group, string> = {
  td: "Transport Dept",
  hyd: "Highways",
  marine: "Marine",
  other: "Others",
};

function groupOf(provider: string): Group {
  if (provider === "hk-td") return "td";
  if (provider === "hk-hyd") return "hyd";
  if (provider === "hk-md") return "marine";
  return "other";
}

const INTERNAL_COL = /^(shape|objectid|globalid|fid|shape__.*|st_.*shape|objectid_.*)$/i;

function pickColumns(fc: GeoJsonFC): string[] {
  const seen: string[] = [];
  for (const f of fc.features.slice(0, 8)) {
    for (const k of Object.keys(f.properties ?? {})) {
      if (INTERNAL_COL.test(k)) continue;
      if (!seen.includes(k)) seen.push(k);
    }
  }
  const nameish = seen.filter((k) => /name|road|street|addr|stop|pier|title|label|no$/i.test(k));
  const rest = seen.filter((k) => !nameish.includes(k));
  return [...nameish, ...rest].slice(0, 6);
}

function withDeadline<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const cut = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new Error(`${label} timed out`)), ms);
  });
  return Promise.race([p, cut]).finally(() => clearTimeout(t)) as Promise<T>;
}

const DEFAULT_IDX = Math.max(
  0,
  CSDI_LAYERS.findIndex((l) => l.datasetId === "hyd_rcd_1632360512481_74705"),
);

export default function PlacesSection() {
  const [group, setGroup] = useState<Group>("td");
  const [filter, setFilter] = useState("");
  const [selIdx, setSelIdx] = useState(DEFAULT_IDX);
  const [serviceUrl, setServiceUrl] = useState<string | null>(null);
  const [layers, setLayers] = useState<Array<{ id: number; name: string }>>([]);
  const [selLayerId, setSelLayerId] = useState<number | null>(null);
  const [geomType, setGeomType] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [fc, setFc] = useState<GeoJsonFC | null>(null);
  const [fallbackNote, setFallbackNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return CSDI_LAYERS.map((l, i) => ({ l, i })).filter(({ l }) => {
      if (groupOf(l.provider) !== group) return false;
      if (!q) return true;
      return `${l.title} ${l.label} ${l.datasetId}`.toLowerCase().includes(q);
    });
  }, [group, filter]);

  const selected = CSDI_LAYERS[selIdx] ?? null;

  const counts = useMemo(() => {
    const c: Record<Group, number> = { td: 0, hyd: 0, marine: 0, other: 0 };
    for (const l of CSDI_LAYERS) c[groupOf(l.provider)] += 1;
    return c;
  }, []);

  // Stage 1: resolve service + list sublayers for the picked dataset.
  useEffect(() => {
    if (!selected) return;
    const my = ++seq.current;
    setLoading(true);
    setError(null);
    setFc(null);
    setLayers([]);
    setSelLayerId(null);
    setServiceUrl(null);
    setFallbackNote(null);
    (async () => {
      try {
        const svc = await withDeadline(resolveService(selected.datasetId), 30000, "resolver");
        if (seq.current !== my) return;
        setServiceUrl(svc);
        const list = await withDeadline(layerList(svc), 30000, "layer list");
        if (seq.current !== my) return;
        if (!list.length) throw new Error("service returned no layers");
        setLayers(list);
        setSelLayerId((prev) => (list.some((x) => x.id === prev) ? prev : list[0].id));
      } catch (e) {
        if (seq.current !== my) return;
        setError(`Layer unreachable: ${e instanceof Error ? e.message : String(e)}`);
        setLoading(false);
      }
    })();
  }, [selected]);

  // Stage 2: query the picked sublayer. Polygons use returnGeometry=false.
  useEffect(() => {
    if (!selected || !serviceUrl || selLayerId === null) return;
    const my = seq.current;
    setLoading(true);
    setError(null);
    setFc(null);
    setFallbackNote(null);
    (async () => {
      try {
        const meta = await withDeadline(layerMeta(serviceUrl, selLayerId), 20000, "layer metadata").catch(
          (): { geometryType?: string; displayField?: string } => ({}),
        );
        if (seq.current !== my) return;
        setGeomType(meta.geometryType ?? null);
        const point = isPointGeometry(meta.geometryType);
        let data: GeoJsonFC;
        try {
          data = await withDeadline(queryLayer(serviceUrl, selLayerId, { geometry: point, limit: 5000 }), 60000, "query");
        } catch (qErr) {
          // Full-file fallback before giving up on this layer.
          const subName = layers.find((x) => x.id === selLayerId)?.name ?? "";
          data = await withDeadline(queryFileApi(selected.datasetId, subName), 60000, "file fallback");
          if (seq.current !== my) return;
          setFallbackNote("ArcGIS query failed; served from file API fallback.");
          if (!meta.geometryType) {
            const first = data.features.find((f) => f.geometry?.type);
            setGeomType(first ? `geojson:${first.geometry?.type}` : "unknown");
          }
          void qErr;
        }
        if (seq.current !== my) return;
        // Cheap exact count for the metadata line; ignore failures.
        withDeadline(
          fetchJson<{ count?: number }>(
            `${serviceUrl}/${selLayerId}/query?where=1%3D1&returnCountOnly=true&f=json`,
          ),
          15000,
          "count",
        )
          .then((c) => {
            if (seq.current === my && typeof c.count === "number") setTotal(c.count);
          })
          .catch(() => {
            if (seq.current === my) setTotal(null);
          });
        setFc(data);
        setLoading(false);
      } catch (e) {
        if (seq.current !== my) return;
        setError(`Layer unreachable: ${e instanceof Error ? e.message : String(e)}`);
        setLoading(false);
      }
    })();
  }, [selected, serviceUrl, selLayerId, layers]);

  const points: MapPoint[] = useMemo(() => (fc ? featureToPoints(fc).slice(0, 4000) : []), [fc]);
  const pointLayer = geomType ? isPointGeometry(geomType) || points.length > 0 : points.length > 0;
  const columns = useMemo(() => (fc ? pickColumns(fc) : []), [fc]);
  const rows = useMemo(() => (fc ? fc.features.slice(0, 50) : []), [fc]);
  const mapCenter: [number, number] = useMemo(() => {
    if (!points.length) return HK_CENTER;
    const s = points.slice(0, 2000);
    return [s.reduce((a, p) => a + p.lat, 0) / s.length, s.reduce((a, p) => a + p.lng, 0) / s.length];
  }, [points]);
  const showTable = fc !== null && (!pointLayer || (fc?.features.length ?? 0) > 200);

  const geomNote = !geomType
    ? "geometry type unknown"
    : pointLayer
      ? `point geometry (${geomType})`
      : `non-point geometry (${geomType}); geometry omitted for size`;
  const countNote =
    total !== null
      ? `${total.toLocaleString("en-HK")} features`
      : fc
        ? `${fc.features.length.toLocaleString("en-HK")}${fc.features.length >= 5000 ? "+" : ""} features loaded`
        : "";

  return (
    <SectionShell
      kicker="CSDI spatial library"
      title="Places"
      sub={`${CSDI_LAYERS.length} layers · Highways, Marine, Transport Dept and more`}
      right={<p className="font-readout text-xs text-ink-soft">{countNote}</p>}
    >
      <div className="border-b-2 border-ink px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <ChipRow
            options={GROUPS}
            value={group}
            onChange={setGroup}
            labels={{ td: `Transport Dept · ${counts.td}`, hyd: `Highways · ${counts.hyd}`, marine: `Marine · ${counts.marine}`, other: `Others · ${counts.other}` }}
          />
        </div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter 86 layers by name or id…"
            className="w-full border-2 border-ink bg-paper px-2 py-1.5 font-readout text-xs sm:max-w-xs"
          />
          <select
            value={String(selIdx)}
            onChange={(e) => setSelIdx(Number(e.target.value))}
            className="w-full border-2 border-ink bg-paper px-2 py-1.5 font-readout text-xs sm:flex-1"
          >
            {filtered.map(({ l, i }) => (
              <option key={`${l.datasetId}-${l.label}-${i}`} value={String(i)}>
                {l.label} — {l.title}
              </option>
            ))}
          </select>
        </div>
        {filtered.length === 0 && <p className="mt-2 font-readout text-xs text-signal">No layers match this filter.</p>}
        {layers.length > 1 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-readout text-[11px] font-bold uppercase tracking-widest text-ink-soft">Sublayer</span>
            <select
              value={selLayerId === null ? "" : String(selLayerId)}
              onChange={(e) => setSelLayerId(Number(e.target.value))}
              className="border-2 border-ink bg-paper px-2 py-1 font-readout text-xs"
            >
              {layers.map((x) => (
                <option key={x.id} value={String(x.id)}>
                  {x.id}: {x.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {selected && (
        <p className="border-b-2 border-ink bg-paper-dim px-4 py-2 font-readout text-[11px] uppercase tracking-widest text-ink-soft">
          {selected.provider} · {selected.datasetId} · {geomNote}
          {fallbackNote ? ` · ${fallbackNote}` : ""}
        </p>
      )}

      {loading && !fc && <LoadingLine text="Resolving CSDI service…" />}
      {error && !fc && <ErrorBox message={error} />}
      {error && fc && <ErrorBox message={error} />}

      {fc && pointLayer && points.length > 0 && (
        <div className="border-b-2 border-ink">
          <PointsMap points={points} center={mapCenter} zoom={points.length > 50 ? 11 : 13} />
          <p className="px-4 py-1 font-readout text-[11px] text-ink-soft">
            {points.length.toLocaleString("en-HK")} pins{fc.features.length > points.length ? ` from ${fc.features.length.toLocaleString("en-HK")} features` : ""} · hover a pin for its record name
          </p>
        </div>
      )}

      {fc && !pointLayer && (
        <p className="border-b-2 border-ink px-4 py-2 font-readout text-xs text-amber">
          Geometry omitted for size — counts + attribute table below. Polygons are too heavy to pin.
        </p>
      )}

      {fc && showTable && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-readout text-xs">
            <thead>
              <tr className="bg-ink text-paper">
                {columns.map((c) => (
                  <th key={c} className="border border-ink px-2 py-1 text-left font-bold uppercase tracking-wider">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((f, i) => (
                <tr key={i} className={i % 2 ? "bg-paper-dim" : "bg-paper"}>
                  {columns.map((c) => (
                    <td key={c} className="max-w-[220px] truncate border border-line px-2 py-1">
                      {String(f.properties?.[c] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-1 font-readout text-[11px] text-ink-soft">
            First {rows.length} of {fc.features.length.toLocaleString("en-HK")} loaded rows · {columns.length} key columns.
          </p>
        </div>
      )}

      {fc && !showTable && (
        <p className="px-4 py-3 font-readout text-xs text-ink-soft">
          {fc.features.slice(0, 8).map((f) => displayName(f.properties ?? {})).join(" · ").slice(0, 220)}
        </p>
      )}
    </SectionShell>
  );
}
