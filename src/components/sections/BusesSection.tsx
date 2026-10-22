import { useEffect, useMemo, useState } from "react";
import { ChipRow, ErrorBox, LoadingLine, SectionShell } from "../ui";
import {
  formatEta,
  getBatchStopEtas,
  getBatchStopRoutes,
  getCtbEtas,
  getCtbRouteStops,
  getCtbStop,
  getGmbRoute,
  getGmbRouteStopEta,
  getGmbRouteStops,
  getKmbRouteStops,
  getKmbStopEtas,
  getKmbStopRouteEta,
  getNlbEtas,
  listCtbRoutes,
  listGmbRoutes,
  listKmbRoutes,
  listKmbStops,
  listNlbRoutes,
  listNlbStops,
  type CtbEta,
  type GmbRegion,
  type KmbEta,
  type KmbStop,
} from "../../lib/feeds/buses";

type Op = "kmb" | "ctb" | "gmb" | "nlb" | "board";

const OPS: Op[] = ["kmb", "ctb", "gmb", "nlb", "board"];
const OP_LABEL: Record<Op, string> = {
  kmb: "KMB",
  ctb: "Citybus",
  gmb: "GMB",
  nlb: "NLB",
  board: "Stop board",
};

const ETA_POLL = 30_000;

function inputCls() {
  return "w-full border-2 border-ink bg-paper px-2 py-1.5 font-readout text-sm outline-none placeholder:text-muted";
}

function btnCls(active: boolean) {
  return `border-2 border-ink px-2 py-1 font-readout text-xs font-bold ${active ? "bg-ink text-paper" : "bg-paper"} shadow-[3px_3px_0_var(--color-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none`;
}

function EtaLine({ dest, eta, remark, seq }: { dest: string; eta: string | null | undefined; remark?: string; seq?: number }) {
  const urgent = eta !== null && eta !== undefined && eta !== "";
  return (
    <li className="flex items-baseline justify-between gap-2 border-b border-line px-3 py-1.5 font-readout text-sm tabular-nums last:border-b-0">
      <span className="min-w-0 truncate">
        {typeof seq === "number" && <span className="mr-2 text-muted">#{seq}</span>}
        {dest || "—"}
        {remark && <span className="ml-2 text-[11px] text-muted">{remark}</span>}
      </span>
      <span className={`shrink-0 font-bold ${urgent ? "" : "text-muted"}`}>{formatEta(eta)}</span>
    </li>
  );
}

function StopList({ stops, selected, onSelect }: { stops: { id: string; label: string; sub?: string }[]; selected: string | null; onSelect: (id: string) => void }) {
  if (!stops.length) return <p className="px-3 py-3 font-readout text-xs text-muted">No stops found.</p>;
  return (
    <ul className="max-h-64 overflow-y-auto">
      {stops.map((s) => (
        <li key={s.id}>
          <button
            onClick={() => onSelect(s.id)}
            className={`block w-full border-b border-line px-3 py-1.5 text-left font-readout text-xs ${selected === s.id ? "bg-ink text-paper" : "hover:bg-paper-dim"}`}
          >
            <span className="font-bold tabular-nums">{s.id}</span>
            <span className="ml-2">{s.label}</span>
            {s.sub && <span className="ml-2 text-muted">{s.sub}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- KMB

function KmbPane() {
  const [routes, setRoutes] = useState<{ route: string; bound: string; service_type: string; orig_en: string; dest_en: string }[] | null>(null);
  const [stopNames, setStopNames] = useState<Map<string, KmbStop> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [routeSel, setRouteSel] = useState("");
  const [bound, setBound] = useState<"outbound" | "inbound">("outbound");
  const [svc, setSvc] = useState("");
  const [stops, setStops] = useState<{ seq: number; stop: string }[]>([]);
  const [stopsError, setStopsError] = useState<string | null>(null);
  const [stopSel, setStopSel] = useState<string | null>(null);
  const [etas, setEtas] = useState<KmbEta[]>([]);
  const [etaError, setEtaError] = useState<string | null>(null);
  const [etaTick, setEtaTick] = useState(0);

  useEffect(() => {
    let live = true;
    Promise.all([listKmbRoutes(), listKmbStops()])
      .then(([r, s]) => {
        if (!live) return;
        setRoutes(r);
        setStopNames(new Map(s.map((x) => [x.stop, x])));
        if (r.length && !routeSel) {
          const first = r[0].route;
          setRouteSel(first);
          setBound(r[0].bound === "inbound" ? "inbound" : "outbound");
          setSvc(r[0].service_type);
        }
      })
      .catch((e) => live && setError(String(e instanceof Error ? e.message : e)));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const variants = useMemo(() => (routes ?? []).filter((r) => r.route === routeSel), [routes, routeSel]);
  const bounds = useMemo(() => Array.from(new Set(variants.map((v) => v.bound))), [variants]);
  const svcs = useMemo(() => Array.from(new Set(variants.filter((v) => v.bound === bound).map((v) => v.service_type))), [variants, bound]);

  useEffect(() => {
    if (bounds.length && !bounds.includes(bound)) setBound(bounds[0] === "inbound" ? "inbound" : "outbound");
  }, [bounds, bound]);
  useEffect(() => {
    if (svcs.length && !svcs.includes(svc)) setSvc(svcs[0]);
  }, [svcs, svc]);

  const filtered = useMemo(() => {
    const all = Array.from(new Set((routes ?? []).map((r) => r.route)));
    const q = query.trim().toUpperCase();
    const list = q ? all.filter((r) => r.toUpperCase().includes(q)) : all;
    return list.slice(0, 60);
  }, [routes, query]);

  useEffect(() => {
    if (!routeSel || !svc) return;
    let live = true;
    setStopsError(null);
    getKmbRouteStops(routeSel, bound, svc)
      .then((s) => {
        if (!live) return;
        setStops(s.map((x) => ({ seq: x.seq, stop: x.stop })));
        setStopSel((prev) => (prev && s.some((x) => x.stop === prev) ? prev : (s[0]?.stop ?? null)));
      })
      .catch((e) => live && setStopsError(String(e instanceof Error ? e.message : e)));
    return () => {
      live = false;
    };
  }, [routeSel, bound, svc]);

  useEffect(() => {
    if (!stopSel || !routeSel || !svc) return;
    let live = true;
    setEtaError(null);
    getKmbStopRouteEta(stopSel, routeSel, svc)
      .then((e) => live && setEtas(e.filter((x) => !x.dir || x.dir === bound)))
      .catch((e) => live && setEtaError(String(e instanceof Error ? e.message : e)));
    const t = setInterval(() => setEtaTick((x) => x + 1), ETA_POLL);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [stopSel, routeSel, svc, bound]);
  useEffect(() => {
    if (etaTick === 0 || !stopSel || !routeSel || !svc) return;
    getKmbStopRouteEta(stopSel, routeSel, svc).then((e) => setEtas(e.filter((x) => !x.dir || x.dir === bound))).catch(() => undefined);
  }, [etaTick, stopSel, routeSel, svc, bound]);

  if (!routes) return error ? <ErrorBox message={error} /> : <LoadingLine text="Loading KMB route list…" />;
  return (
    <div className="grid gap-0 md:grid-cols-2">
      <div className="border-b-2 border-ink p-3 md:border-b-0 md:border-r-2">
        <label className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">Filter routes · {routes.length} variants</label>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. 1A, 968, N216" className={`${inputCls()} mt-1`} />
        <label className="mt-2 block font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">Route</label>
        <select value={routeSel} onChange={(e) => setRouteSel(e.target.value)} className={`${inputCls()} mt-1`}>
          {filtered.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <div className="mt-2 flex flex-wrap gap-1">
          {(["outbound", "inbound"] as const).map((b) => (
            <button key={b} disabled={!bounds.includes(b)} onClick={() => setBound(b)} className={`${btnCls(bound === b)} disabled:opacity-30`}>{b}</button>
          ))}
          {svcs.length > 1 && svcs.map((s) => (
            <button key={s} onClick={() => setSvc(s)} className={btnCls(svc === s)}>svc {s}</button>
          ))}
        </div>
        <p className="mt-2 font-readout text-[11px] text-muted">
          {variants.find((v) => v.bound === bound && (!svc || v.service_type === svc))
            ? `${variants.find((v) => v.bound === bound && (!svc || v.service_type === svc))?.orig_en} → ${variants.find((v) => v.bound === bound && (!svc || v.service_type === svc))?.dest_en}`
            : "Pick a direction."}
        </p>
        <div className="mt-2 border-2 border-ink">
          <p className="border-b-2 border-ink bg-paper-dim px-3 py-1 font-display text-sm font-bold uppercase tracking-wide">Stops · {stops.length}</p>
          {stopsError ? <ErrorBox message={stopsError} /> : (
            <StopList
              stops={stops.map((s) => ({ id: s.stop, label: stopNames?.get(s.stop)?.name_en ?? `seq ${s.seq}`, sub: `#${s.seq}` }))}
              selected={stopSel}
              onSelect={setStopSel}
            />
          )}
        </div>
      </div>
      <div className="p-3">
        <p className="font-display text-sm font-bold uppercase tracking-wide">Departures · stop {stopSel ?? "—"}</p>
        <p className="font-readout text-[11px] text-muted">{stopNames?.get(stopSel ?? "")?.name_en ?? ""} · auto-refresh 30s</p>
        {etaError ? <ErrorBox message={etaError} /> : etas.length === 0 ? (
          <p className="mt-2 font-readout text-xs text-muted">No scheduled departures.</p>
        ) : (
          <ul className="mt-2 border-2 border-ink">
            {etas.slice(0, 12).map((e, i) => (
              <EtaLine key={`${e.seq}-${e.eta_seq ?? i}-${e.eta ?? ""}`} dest={e.dest_en} eta={e.eta} remark={e.rmk_en || undefined} seq={e.seq} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Citybus

function CtbPane() {
  const [routes, setRoutes] = useState<{ route: string; orig_en: string; dest_en: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [routeSel, setRouteSel] = useState("");
  const [bound, setBound] = useState<"outbound" | "inbound">("outbound");
  const [stopIds, setStopIds] = useState<{ seq: number; stop: string }[]>([]);
  const [stopMeta, setStopMeta] = useState<Record<string, string>>({});
  const [stopSel, setStopSel] = useState<string | null>(null);
  const [etas, setEtas] = useState<CtbEta[]>([]);
  const [etaError, setEtaError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    listCtbRoutes()
      .then((r) => {
        if (!live) return;
        setRoutes(r);
        if (r.length) setRouteSel((p) => p || r[0].route);
      })
      .catch((e) => live && setError(String(e instanceof Error ? e.message : e)));
    return () => {
      live = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    const all = routes ?? [];
    return (q ? all.filter((r) => r.route.toUpperCase().includes(q)) : all).slice(0, 60);
  }, [routes, query]);

  const head = useMemo(() => (routes ?? []).find((r) => r.route === routeSel), [routes, routeSel]);

  useEffect(() => {
    if (!routeSel) return;
    let live = true;
    getCtbRouteStops(routeSel, bound)
      .then(async (s) => {
        if (!live) return;
        setStopIds(s.map((x) => ({ seq: x.seq, stop: x.stop })));
        setStopSel((prev) => (prev && s.some((x) => x.stop === prev) ? prev : (s[0]?.stop ?? null)));
        const missing = s.map((x) => x.stop).filter((id) => !(id in stopMeta)).slice(0, 60);
        const got = await Promise.allSettled(missing.map((id) => getCtbStop(id)));
        if (!live) return;
        const next: Record<string, string> = {};
        got.forEach((r, i) => {
          if (r.status === "fulfilled" && r.value) next[missing[i]] = r.value.name_en;
        });
        if (Object.keys(next).length) setStopMeta((p) => ({ ...p, ...next }));
      })
      .catch(() => live && setStopIds([]));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeSel, bound]);

  useEffect(() => {
    if (!stopSel || !routeSel) return;
    let live = true;
    setEtaError(null);
    getCtbEtas(stopSel, routeSel)
      .then((e) => live && setEtas(e.filter((x) => !bound || x.dir === bound)))
      .catch((e) => live && setEtaError(String(e instanceof Error ? e.message : e)));
    const t = setInterval(() => setTick((x) => x + 1), ETA_POLL);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [stopSel, routeSel, bound]);
  useEffect(() => {
    if (tick === 0 || !stopSel || !routeSel) return;
    getCtbEtas(stopSel, routeSel).then((e) => setEtas(e.filter((x) => !bound || x.dir === bound))).catch(() => undefined);
  }, [tick, stopSel, routeSel, bound]);

  if (!routes) return error ? <ErrorBox message={error} /> : <LoadingLine text="Loading Citybus routes…" />;
  return (
    <div className="grid gap-0 md:grid-cols-2">
      <div className="border-b-2 border-ink p-3 md:border-b-0 md:border-r-2">
        <label className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">Filter routes · {routes.length}</label>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. 5B, 973, N8X" className={`${inputCls()} mt-1`} />
        <select value={routeSel} onChange={(e) => setRouteSel(e.target.value)} className={`${inputCls()} mt-2`}>
          {filtered.map((r) => (
            <option key={r.route} value={r.route}>{r.route} · {r.orig_en} → {r.dest_en}</option>
          ))}
        </select>
        <div className="mt-2 flex gap-1">
          {(["outbound", "inbound"] as const).map((b) => (
            <button key={b} onClick={() => setBound(b)} className={btnCls(bound === b)}>{b}</button>
          ))}
        </div>
        {head && <p className="mt-2 font-readout text-[11px] text-muted">{head.orig_en} → {head.dest_en}</p>}
        <div className="mt-2 border-2 border-ink">
          <p className="border-b-2 border-ink bg-paper-dim px-3 py-1 font-display text-sm font-bold uppercase tracking-wide">Stops · {stopIds.length}</p>
          <StopList stops={stopIds.map((s) => ({ id: s.stop, label: stopMeta[s.stop] ?? `seq ${s.seq}`, sub: `#${s.seq}` }))} selected={stopSel} onSelect={setStopSel} />
        </div>
      </div>
      <div className="p-3">
        <p className="font-display text-sm font-bold uppercase tracking-wide">Departures · {routeSel} @ {stopSel ?? "—"}</p>
        <p className="font-readout text-[11px] text-muted">{stopMeta[stopSel ?? ""] ?? ""} · auto-refresh 30s</p>
        {etaError ? <ErrorBox message={etaError} /> : etas.length === 0 ? (
          <p className="mt-2 font-readout text-xs text-muted">No scheduled departures.</p>
        ) : (
          <ul className="mt-2 border-2 border-ink">
            {etas.slice(0, 12).map((e, i) => (
              <EtaLine key={`${e.seq}-${i}-${e.eta ?? ""}`} dest={e.dest_en ?? routeSel} eta={e.eta} remark={e.rmk_en || undefined} seq={e.seq} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- GMB

function GmbPane() {
  const [region, setRegion] = useState<GmbRegion>("HKI");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [code, setCode] = useState("");
  const [seqs, setSeqs] = useState<{ route_seq: number; orig_en?: string; dest_en?: string }[]>([]);
  const [routeId, setRouteId] = useState<number | null>(null);
  const [seq, setSeq] = useState<number | null>(null);
  const [stops, setStops] = useState<{ stop_seq: number; stop_id: number; name_en?: string }[]>([]);
  const [stopSel, setStopSel] = useState<number | null>(null);
  const [etas, setEtas] = useState<{ eta?: string | null; remarks_en?: string }[]>([]);
  const [etaError, setEtaError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    setCodes(null);
    setError(null);
    listGmbRoutes(region)
      .then((r) => {
        if (!live) return;
        setCodes(r);
        setCode((p) => (p && r.includes(p) ? p : (r[0] ?? "")));
      })
      .catch((e) => live && setError(String(e instanceof Error ? e.message : e)));
    return () => {
      live = false;
    };
  }, [region]);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    const all = codes ?? [];
    return (q ? all.filter((c) => c.toUpperCase().includes(q)) : all).slice(0, 60);
  }, [codes, query]);

  useEffect(() => {
    if (!code) return;
    let live = true;
    getGmbRoute(region, code)
      .then((d) => {
        if (!live || !d) return;
        setRouteId(d.route_id);
        const dirs = (d.directions ?? []).map((x) => ({ route_seq: x.route_seq, orig_en: x.orig_en, dest_en: x.dest_en }));
        setSeqs(dirs);
        setSeq((p) => (p && dirs.some((x) => x.route_seq === p) ? p : (dirs[0]?.route_seq ?? null)));
      })
      .catch(() => live && setSeqs([]));
    return () => {
      live = false;
    };
  }, [region, code]);

  useEffect(() => {
    if (routeId === null || seq === null) return;
    let live = true;
    getGmbRouteStops(routeId, seq)
      .then((s) => {
        if (!live) return;
        setStops(s);
        setStopSel((p) => (p && s.some((x) => x.stop_seq === p) ? p : (s[0]?.stop_seq ?? null)));
      })
      .catch(() => live && setStops([]));
    return () => {
      live = false;
    };
  }, [routeId, seq]);

  useEffect(() => {
    if (routeId === null || seq === null || stopSel === null) return;
    let live = true;
    setEtaError(null);
    getGmbRouteStopEta(routeId, seq, stopSel)
      .then((e) => live && setEtas(e))
      .catch((e) => live && setEtaError(String(e instanceof Error ? e.message : e)));
    const t = setInterval(() => setTick((x) => x + 1), ETA_POLL);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [routeId, seq, stopSel]);
  useEffect(() => {
    if (tick === 0 || routeId === null || seq === null || stopSel === null) return;
    getGmbRouteStopEta(routeId, seq, stopSel).then((e) => setEtas(e)).catch(() => undefined);
  }, [tick, routeId, seq, stopSel]);

  return (
    <div className="grid gap-0 md:grid-cols-2">
      <div className="border-b-2 border-ink p-3 md:border-b-0 md:border-r-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">Region</span>
          <ChipRow options={["HKI", "KLN", "NT"] as GmbRegion[]} value={region} onChange={setRegion} />
        </div>
        {error ? <ErrorBox message={error} /> : !codes ? <LoadingLine text="Loading GMB routes…" /> : (
          <>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter route code, e.g. 4A" className={`${inputCls()} mt-2`} />
            <select value={code} onChange={(e) => setCode(e.target.value)} className={`${inputCls()} mt-2`}>
              {filtered.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </>
        )}
        {seqs.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {seqs.map((d) => (
              <button key={d.route_seq} onClick={() => setSeq(d.route_seq)} className={btnCls(seq === d.route_seq)}>
                seq {d.route_seq}{d.orig_en || d.dest_en ? ` · ${d.orig_en ?? ""}→${d.dest_en ?? ""}` : ""}
              </button>
            ))}
          </div>
        )}
        <div className="mt-2 border-2 border-ink">
          <p className="border-b-2 border-ink bg-paper-dim px-3 py-1 font-display text-sm font-bold uppercase tracking-wide">Stops · {stops.length}</p>
          <StopList stops={stops.map((s) => ({ id: String(s.stop_seq), label: s.name_en ?? `stop ${s.stop_id}`, sub: `#${s.stop_seq}` }))} selected={stopSel === null ? null : String(stopSel)} onSelect={(id) => setStopSel(Number(id))} />
        </div>
      </div>
      <div className="p-3">
        <p className="font-display text-sm font-bold uppercase tracking-wide">Departures · {code} seq {seq ?? "—"} stop {stopSel ?? "—"}</p>
        <p className="font-readout text-[11px] text-muted">auto-refresh 30s</p>
        {etaError ? <ErrorBox message={etaError} /> : etas.length === 0 ? (
          <p className="mt-2 font-readout text-xs text-muted">No scheduled departures.</p>
        ) : (
          <ul className="mt-2 border-2 border-ink">
            {etas.slice(0, 12).map((e, i) => (
              <EtaLine key={i} dest={stops.find((s) => s.stop_seq === stopSel)?.name_en ?? code} eta={e.eta ?? null} remark={e.remarks_en || undefined} seq={i + 1} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- NLB

function NlbPane() {
  const [routes, setRoutes] = useState<{ routeId: string; routeNo: string; routeName_e?: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [routeId, setRouteId] = useState("");
  const [stops, setStops] = useState<{ stopId: string; stopName_e?: string }[]>([]);
  const [stopSel, setStopSel] = useState<string | null>(null);
  const [etas, setEtas] = useState<{ estimatedArrivalTime: string; routeVariantName?: string; noGPS?: string }[]>([]);
  const [etaError, setEtaError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    listNlbRoutes()
      .then((r) => {
        if (!live) return;
        setRoutes(r);
        if (r.length) setRouteId((p) => p || r[0].routeId);
      })
      .catch((e) => live && setError(String(e instanceof Error ? e.message : e)));
    return () => {
      live = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    const all = routes ?? [];
    return (q ? all.filter((r) => r.routeNo.toUpperCase().includes(q) || (r.routeName_e ?? "").toUpperCase().includes(q)) : all).slice(0, 60);
  }, [routes, query]);

  useEffect(() => {
    if (!routeId) return;
    let live = true;
    listNlbStops(routeId)
      .then((s) => {
        if (!live) return;
        setStops(s);
        setStopSel((p) => (p && s.some((x) => x.stopId === p) ? p : (s[0]?.stopId ?? null)));
      })
      .catch(() => live && setStops([]));
    return () => {
      live = false;
    };
  }, [routeId]);

  useEffect(() => {
    if (!routeId || !stopSel) return;
    let live = true;
    setEtaError(null);
    getNlbEtas(routeId, stopSel)
      .then((e) => live && setEtas(e))
      .catch((e) => live && setEtaError(String(e instanceof Error ? e.message : e)));
    const t = setInterval(() => setTick((x) => x + 1), ETA_POLL);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [routeId, stopSel]);
  useEffect(() => {
    if (tick === 0 || !routeId || !stopSel) return;
    getNlbEtas(routeId, stopSel).then((e) => setEtas(e)).catch(() => undefined);
  }, [tick, routeId, stopSel]);

  if (!routes) return error ? <ErrorBox message={error} /> : <LoadingLine text="Loading NLB routes…" />;
  return (
    <div className="grid gap-0 md:grid-cols-2">
      <div className="border-b-2 border-ink p-3 md:border-b-0 md:border-r-2">
        <label className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">Filter routes · {routes.length}</label>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. 38, B2, N35" className={`${inputCls()} mt-1`} />
        <select value={routeId} onChange={(e) => setRouteId(e.target.value)} className={`${inputCls()} mt-2`}>
          {filtered.map((r) => (
            <option key={r.routeId} value={r.routeId}>{r.routeNo} · {r.routeName_e ?? r.routeId}</option>
          ))}
        </select>
        <div className="mt-2 border-2 border-ink">
          <p className="border-b-2 border-ink bg-paper-dim px-3 py-1 font-display text-sm font-bold uppercase tracking-wide">Stops · {stops.length}</p>
          <StopList stops={stops.map((s) => ({ id: s.stopId, label: s.stopName_e ?? s.stopId }))} selected={stopSel} onSelect={setStopSel} />
        </div>
      </div>
      <div className="p-3">
        <p className="font-display text-sm font-bold uppercase tracking-wide">Departures · stop {stopSel ?? "—"}</p>
        <p className="font-readout text-[11px] text-muted">noGPS=1 rows are scheduled · auto-refresh 30s</p>
        {etaError ? <ErrorBox message={etaError} /> : etas.length === 0 ? (
          <p className="mt-2 font-readout text-xs text-muted">No scheduled departures.</p>
        ) : (
          <ul className="mt-2 border-2 border-ink">
            {etas.slice(0, 12).map((e, i) => (
              <EtaLine key={i} dest={e.routeVariantName ?? routes.find((r) => r.routeId === routeId)?.routeNo ?? ""} eta={e.estimatedArrivalTime} remark={e.noGPS === "1" ? "scheduled" : undefined} seq={i + 1} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Stop board (DPO batch + KMB stop-eta)

function BoardPane() {
  const [co, setCo] = useState<"CTB" | "NLB">("CTB");
  const [stopId, setStopId] = useState("");
  const [routes, setRoutes] = useState<{ route?: string; orig_en?: string; dest_en?: string }[] | null>(null);
  const [etas, setEtas] = useState<{ route?: string; eta?: string | null; dest_en?: string; rmk_en?: string }[]>([]);
  const [kmbEtas, setKmbEtas] = useState<KmbEta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  const go = async (stop: string, company: "CTB" | "NLB") => {
    const id = stop.trim();
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const [r, e] = await Promise.all([getBatchStopRoutes(company, id), getBatchStopEtas(company, id)]);
      setRoutes(r);
      setEtas(e);
      try {
        setKmbEtas(await getKmbStopEtas(id));
      } catch {
        setKmbEtas([]);
      }
    } catch (e2) {
      setError(String(e2 instanceof Error ? e2.message : e2));
      setRoutes([]);
      setEtas([]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (tick === 0 || !stopId.trim()) return;
    getBatchStopEtas(co, stopId.trim()).then((e) => setEtas(e)).catch(() => undefined);
    getKmbStopEtas(stopId.trim()).then((e) => setKmbEtas(e)).catch(() => undefined);
  }, [tick, co, stopId]);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), ETA_POLL);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <span className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">Company</span>
          <div className="mt-1"><ChipRow options={["CTB", "NLB"] as ("CTB" | "NLB")[]} value={co} onChange={setCo} /></div>
        </div>
        <label className="min-w-48 flex-1">
          <span className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">Stop id</span>
          <input value={stopId} onChange={(e) => setStopId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go(stopId, co)} placeholder="e.g. CTB 002892 · NLB stop id · KMB EF7743" className={`${inputCls()} mt-1`} />
        </label>
        <button onClick={() => go(stopId, co)} disabled={busy || !stopId.trim()} className="border-2 border-ink bg-signal px-4 py-1.5 font-display text-lg font-bold uppercase text-paper shadow-[3px_3px_0_var(--color-ink)] disabled:opacity-40 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
          {busy ? "…" : "Board"}
        </button>
      </div>
      {error && <ErrorBox message={error} />}
      {routes !== null && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="border-2 border-ink">
            <p className="border-b-2 border-ink bg-paper-dim px-3 py-1 font-display text-sm font-bold uppercase tracking-wide">Routes serving · {routes.length}</p>
            {routes.length === 0 ? (
              <p className="px-3 py-2 font-readout text-xs text-muted">No routes on file for this stop/company.</p>
            ) : (
              <ul className="max-h-64 overflow-y-auto">
                {routes.map((r, i) => (
                  <li key={`${r.route}-${i}`} className="border-b border-line px-3 py-1.5 font-readout text-xs last:border-b-0">
                    <span className="font-bold">{r.route ?? "—"}</span>
                    <span className="ml-2 text-ink-soft">{[r.orig_en, r.dest_en].filter(Boolean).join(" → ")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-2 border-ink">
            <p className="border-b-2 border-ink bg-paper-dim px-3 py-1 font-display text-sm font-bold uppercase tracking-wide">ETAs · {etas.length + kmbEtas.length}</p>
            {etas.length === 0 && kmbEtas.length === 0 ? (
              <p className="px-3 py-2 font-readout text-xs text-muted">No departures within 60 min (NLB eta may be blank past the window).</p>
            ) : (
              <ul>
                {etas.slice(0, 12).map((e, i) => (
                  <EtaLine key={`b-${i}`} dest={`${e.route ?? ""} → ${e.dest_en ?? ""}`} eta={e.eta ?? null} remark={e.rmk_en || undefined} />
                ))}
                {kmbEtas.slice(0, 8).map((e, i) => (
                  <EtaLine key={`k-${i}`} dest={`${e.route} → ${e.dest_en}`} eta={e.eta} remark={e.rmk_en || "KMB"} seq={e.seq} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Section

export default function BusesSection() {
  const [op, setOp] = useState<Op>("kmb");
  return (
    <SectionShell
      kicker="Franchised buses · live ETA"
      title="Bus bulletin"
      sub="KMB · Citybus · GMB · NLB departures, polled live from the operators."
      right={<ChipRow options={OPS} value={op} onChange={setOp} labels={OP_LABEL} />}
    >
      <div className="border-t-2 border-ink">
        {op === "kmb" && <KmbPane />}
        {op === "ctb" && <CtbPane />}
        {op === "gmb" && <GmbPane />}
        {op === "nlb" && <NlbPane />}
        {op === "board" && <BoardPane />}
      </div>
      <p className="border-t border-line px-4 py-2 font-readout text-[11px] text-muted">
        Sources: data.etabus.gov.hk (KMB/LWB) · data.etagmb.gov.hk (GMB) · rt.data.gov.hk Citybus + NLB v2 + batch board. Static lists cached 24h in memory; ETAs refresh every 30s.
      </p>
    </SectionShell>
  );
}
