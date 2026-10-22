import { useEffect, useMemo, useState } from "react";
import { ChipRow, ErrorBox, LoadingLine, SectionShell } from "../ui";
import { useLocale } from "../../lib/locale";
import {
  dispDest,
  dispName,
  dispOrig,
  dispRemark,
  dispRouteName,
  dispStopName,
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
  type CtbStop,
  type GmbRegion,
  type KmbEta,
  type KmbStop,
} from "../../lib/feeds/buses";

type Op = "kmb" | "ctb" | "gmb" | "nlb" | "board";

const OPS: Op[] = ["kmb", "ctb", "gmb", "nlb", "board"];

const STR = {
  en: {
    ops: { kmb: "KMB", ctb: "Citybus", gmb: "GMB", nlb: "NLB", board: "Stop board" } as Record<Op, string>,
    kicker: "Franchised buses · live ETA",
    title: "Bus bulletin",
    sub: "KMB · Citybus · GMB · NLB departures, polled live from the operators.",
    footnote:
      "Sources: data.etabus.gov.hk (KMB/LWB) · data.etagmb.gov.hk (GMB) · rt.data.gov.hk Citybus + NLB v2 + batch board. Static lists cached 24h in memory; ETAs refresh every 30s.",
    loadingKmb: "Loading KMB route list…",
    loadingCtb: "Loading Citybus routes…",
    loadingGmb: "Loading GMB routes…",
    loadingNlb: "Loading NLB routes…",
    filterRoutes: (n: number) => `Filter routes · ${n} variants`,
    phKmb: "e.g. 1A, 968, N216",
    phCtb: "e.g. 5B, 973, N8X",
    phNlb: "e.g. 38, B2, N35",
    route: "Route",
    outbound: "outbound",
    inbound: "inbound",
    svc: (s: string) => `svc ${s}`,
    pickDirection: "Pick a direction.",
    stops: (n: number) => `Stops · ${n}`,
    noStops: "No stops found.",
    departuresStop: (s: string) => `Departures · stop ${s}`,
    departuresRouteStop: (r: string, s: string) => `Departures · ${r} @ ${s}`,
    departuresGmb: (code: string, seq: string, stop: string) => `Departures · ${code} seq ${seq} stop ${stop}`,
    autoRefresh: "auto-refresh 30s",
    noGPSNote: "noGPS=1 rows are scheduled · auto-refresh 30s",
    noDepartures: "No scheduled departures.",
    stopFallback: (seq: number) => `seq ${seq}`,
    region: "Region",
    filterCode: "Filter route code, e.g. 4A",
    seqBtn: (n: number) => `seq ${n}`,
    scheduled: "scheduled",
    company: "Company",
    stopIdLabel: "Stop id",
    boardPlaceholder: "e.g. CTB 002892 · NLB stop id · KMB EF7743",
    board: "Board",
    routesServing: (n: number) => `Routes serving · ${n}`,
    noRoutes: "No routes on file for this stop/company.",
    etasTitle: (n: number) => `ETAs · ${n}`,
    noBoardEtas: "No departures within 60 min (NLB eta may be blank past the window).",
  },
  tc: {
    ops: { kmb: "KMB", ctb: "城巴", gmb: "專線小巴", nlb: "嶼巴", board: "站牌" } as Record<Op, string>,
    kicker: "專營巴士 · 實時到站",
    title: "巴士到站板",
    sub: "九巴 · 城巴 · 專線小巴 · 嶼巴班次，直接向營辦商實時查詢。",
    footnote:
      "資料來源：data.etabus.gov.hk（九巴／龍運）· data.etagmb.gov.hk（專線小巴）· rt.data.gov.hk 城巴＋嶼巴 v2＋批量站牌。靜態路線資料快取 24 小時；到站時間每 30 秒更新。",
    loadingKmb: "正在載入九巴路線…",
    loadingCtb: "正在載入城巴路線…",
    loadingGmb: "正在載入專線小巴路線…",
    loadingNlb: "正在載入嶼巴路線…",
    filterRoutes: (n: number) => `篩選路線 · 共 ${n} 個組合`,
    phKmb: "例如 1A、968、N216",
    phCtb: "例如 5B、973、N8X",
    phNlb: "例如 38、B2、N35",
    route: "路線",
    outbound: "去程",
    inbound: "回程",
    svc: (s: string) => `班別 ${s}`,
    pickDirection: "請選擇方向。",
    stops: (n: number) => `車站 · ${n}`,
    noStops: "找不到車站。",
    departuresStop: (s: string) => `班次 · 車站 ${s}`,
    departuresRouteStop: (r: string, s: string) => `班次 · ${r} @ ${s}`,
    departuresGmb: (code: string, seq: string, stop: string) => `班次 · ${code} 班次${seq} 車站${stop}`,
    autoRefresh: "每30秒自動更新",
    noGPSNote: "noGPS=1 為時間表班次 · 每30秒自動更新",
    noDepartures: "暫無預定班次。",
    stopFallback: (seq: number) => `車站 ${seq}`,
    region: "地區",
    filterCode: "篩選路線編號，例如 4A",
    seqBtn: (n: number) => `班次 ${n}`,
    scheduled: "時間表班次",
    company: "公司",
    stopIdLabel: "車站編號",
    boardPlaceholder: "例如 CTB 002892 · 嶼巴車站編號 · 九巴 EF7743",
    board: "查詢",
    routesServing: (n: number) => `途經路線 · ${n}`,
    noRoutes: "此車站／公司暫無路線資料。",
    etasTitle: (n: number) => `預計到站 · ${n}`,
    noBoardEtas: "60分鐘內暫無班次（嶼巴在此時間窗外可能沒有資料）。",
  },
};

const ETA_POLL = 30_000;

function inputCls() {
  return "w-full border-2 border-ink bg-paper px-2 py-1.5 font-readout text-sm outline-none placeholder:text-muted";
}

function btnCls(active: boolean) {
  return `border-2 border-ink px-2 py-1 font-readout text-xs font-bold ${active ? "bg-ink text-paper" : "bg-paper"} shadow-[3px_3px_0_var(--color-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none`;
}

function EtaLine({ dest, eta, remark, seq }: { dest: string; eta: string | null | undefined; remark?: string; seq?: number }) {
  const { lang } = useLocale();
  const urgent = eta !== null && eta !== undefined && eta !== "";
  return (
    <li className="flex items-baseline justify-between gap-2 border-b border-line px-3 py-1.5 font-readout text-sm tabular-nums last:border-b-0">
      <span className="min-w-0 truncate">
        {typeof seq === "number" && <span className="mr-2 text-muted">#{seq}</span>}
        {dest || "—"}
        {remark && <span className="ml-2 text-[11px] text-muted">{remark}</span>}
      </span>
      <span className={`shrink-0 font-bold ${urgent ? "" : "text-muted"}`}>{formatEta(eta, lang)}</span>
    </li>
  );
}

function StopList({ stops, selected, onSelect }: { stops: { id: string; label: string; sub?: string }[]; selected: string | null; onSelect: (id: string) => void }) {
  const { lang } = useLocale();
  if (!stops.length) return <p className="px-3 py-3 font-readout text-xs text-muted">{STR[lang].noStops}</p>;
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
  const { lang } = useLocale();
  const t = STR[lang];
  const [routes, setRoutes] = useState<{ route: string; bound: string; service_type: string; orig_en: string; dest_en: string; orig_tc?: string; dest_tc?: string }[] | null>(null);
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
    Promise.all([listKmbRoutes(lang), listKmbStops(lang)])
      .then(([r, s]) => {
        if (!live) return;
        setRoutes(r);
        setStopNames(new Map(s.map((x) => [x.stop, x])));
        if (r.length && !routeSel) {
          const match = r[0];
          setRouteSel(match.route);
          setBound(match.bound === "inbound" ? "inbound" : "outbound");
          setSvc(match.service_type);
        }
      })
      .catch((e) => live && setError(String(e instanceof Error ? e.message : e)));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

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
    getKmbRouteStops(routeSel, bound, svc, lang)
      .then((s) => {
        if (!live) return;
        setStops(s.map((x) => ({ seq: x.seq, stop: x.stop })));
        setStopSel((prev) => (prev && s.some((x) => x.stop === prev) ? prev : (s[0]?.stop ?? null)));
      })
      .catch((e) => live && setStopsError(String(e instanceof Error ? e.message : e)));
    return () => {
      live = false;
    };
  }, [routeSel, bound, svc, lang]);

  useEffect(() => {
    if (!stopSel || !routeSel || !svc) return;
    let live = true;
    setEtaError(null);
    getKmbStopRouteEta(stopSel, routeSel, svc, lang)
      .then((e) => live && setEtas(e.filter((x) => !x.dir || x.dir === bound)))
      .catch((e) => live && setEtaError(String(e instanceof Error ? e.message : e)));
    const tm = setInterval(() => setEtaTick((x) => x + 1), ETA_POLL);
    return () => {
      live = false;
      clearInterval(tm);
    };
  }, [stopSel, routeSel, svc, bound, lang]);
  useEffect(() => {
    if (etaTick === 0 || !stopSel || !routeSel || !svc) return;
    getKmbStopRouteEta(stopSel, routeSel, svc, lang).then((e) => setEtas(e.filter((x) => !x.dir || x.dir === bound))).catch(() => undefined);
  }, [etaTick, stopSel, routeSel, svc, bound, lang]);

  const head = variants.find((v) => v.bound === bound && (!svc || v.service_type === svc));
  if (!routes) return error ? <ErrorBox message={error} /> : <LoadingLine text={t.loadingKmb} />;
  return (
    <div className="grid gap-0 md:grid-cols-2">
      <div className="border-b-2 border-ink p-3 md:border-b-0 md:border-r-2">
        <label className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">{t.filterRoutes(routes.length)}</label>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.phKmb} className={`${inputCls()} mt-1`} />
        <label className="mt-2 block font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">{t.route}</label>
        <select value={routeSel} onChange={(e) => setRouteSel(e.target.value)} className={`${inputCls()} mt-1`}>
          {filtered.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <div className="mt-2 flex flex-wrap gap-1">
          {(["outbound", "inbound"] as const).map((b) => (
            <button key={b} disabled={!bounds.includes(b)} onClick={() => setBound(b)} className={`${btnCls(bound === b)} disabled:opacity-30`}>{t[b]}</button>
          ))}
          {svcs.length > 1 && svcs.map((s) => (
            <button key={s} onClick={() => setSvc(s)} className={btnCls(svc === s)}>{t.svc(s)}</button>
          ))}
        </div>
        <p className="mt-2 font-readout text-[11px] text-muted">
          {head ? `${dispOrig(head, lang)} → ${dispDest(head, lang)}` : t.pickDirection}
        </p>
        <div className="mt-2 border-2 border-ink">
          <p className="border-b-2 border-ink bg-paper-dim px-3 py-1 font-display text-sm font-bold uppercase tracking-wide">{t.stops(stops.length)}</p>
          {stopsError ? <ErrorBox message={stopsError} /> : (
            <StopList
              stops={stops.map((s) => ({ id: s.stop, label: dispName(stopNames?.get(s.stop), lang) || t.stopFallback(s.seq), sub: `#${s.seq}` }))}
              selected={stopSel}
              onSelect={setStopSel}
            />
          )}
        </div>
      </div>
      <div className="p-3">
        <p className="font-display text-sm font-bold uppercase tracking-wide">{t.departuresStop(stopSel ?? "—")}</p>
        <p className="font-readout text-[11px] text-muted">{dispName(stopNames?.get(stopSel ?? ""), lang)} · {t.autoRefresh}</p>
        {etaError ? <ErrorBox message={etaError} /> : etas.length === 0 ? (
          <p className="mt-2 font-readout text-xs text-muted">{t.noDepartures}</p>
        ) : (
          <ul className="mt-2 border-2 border-ink">
            {etas.slice(0, 12).map((e, i) => (
              <EtaLine key={`${e.seq}-${e.eta_seq ?? i}-${e.eta ?? ""}`} dest={dispDest(e, lang)} eta={e.eta} remark={dispRemark(e, lang) || undefined} seq={e.seq} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Citybus

function CtbPane() {
  const { lang } = useLocale();
  const t = STR[lang];
  const [routes, setRoutes] = useState<{ route: string; orig_en: string; dest_en: string; orig_tc?: string; dest_tc?: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [routeSel, setRouteSel] = useState("");
  const [bound, setBound] = useState<"outbound" | "inbound">("outbound");
  const [stopIds, setStopIds] = useState<{ seq: number; stop: string }[]>([]);
  const [stopMeta, setStopMeta] = useState<Record<string, CtbStop>>({});
  const [stopSel, setStopSel] = useState<string | null>(null);
  const [etas, setEtas] = useState<CtbEta[]>([]);
  const [etaError, setEtaError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    listCtbRoutes(lang)
      .then((r) => {
        if (!live) return;
        setRoutes(r);
        if (r.length) setRouteSel((p) => p || r[0].route);
      })
      .catch((e) => live && setError(String(e instanceof Error ? e.message : e)));
    return () => {
      live = false;
    };
  }, [lang]);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    const all = routes ?? [];
    return (q ? all.filter((r) => r.route.toUpperCase().includes(q)) : all).slice(0, 60);
  }, [routes, query]);

  const head = useMemo(() => (routes ?? []).find((r) => r.route === routeSel), [routes, routeSel]);

  useEffect(() => {
    if (!routeSel) return;
    let live = true;
    getCtbRouteStops(routeSel, bound, lang)
      .then(async (s) => {
        if (!live) return;
        setStopIds(s.map((x) => ({ seq: x.seq, stop: x.stop })));
        setStopSel((prev) => (prev && s.some((x) => x.stop === prev) ? prev : (s[0]?.stop ?? null)));
        const missing = s.map((x) => x.stop).filter((id) => !(id in stopMeta)).slice(0, 60);
        const got = await Promise.allSettled(missing.map((id) => getCtbStop(id, lang)));
        if (!live) return;
        const next: Record<string, CtbStop> = {};
        got.forEach((r, i) => {
          if (r.status === "fulfilled" && r.value) next[missing[i]] = r.value;
        });
        if (Object.keys(next).length) setStopMeta((p) => ({ ...p, ...next }));
      })
      .catch(() => live && setStopIds([]));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeSel, bound, lang]);

  useEffect(() => {
    if (!stopSel || !routeSel) return;
    let live = true;
    setEtaError(null);
    getCtbEtas(stopSel, routeSel, lang)
      .then((e) => live && setEtas(e.filter((x) => !bound || x.dir === bound)))
      .catch((e) => live && setEtaError(String(e instanceof Error ? e.message : e)));
    const tm = setInterval(() => setTick((x) => x + 1), ETA_POLL);
    return () => {
      live = false;
      clearInterval(tm);
    };
  }, [stopSel, routeSel, bound, lang]);
  useEffect(() => {
    if (tick === 0 || !stopSel || !routeSel) return;
    getCtbEtas(stopSel, routeSel, lang).then((e) => setEtas(e.filter((x) => !bound || x.dir === bound))).catch(() => undefined);
  }, [tick, stopSel, routeSel, bound, lang]);

  if (!routes) return error ? <ErrorBox message={error} /> : <LoadingLine text={t.loadingCtb} />;
  return (
    <div className="grid gap-0 md:grid-cols-2">
      <div className="border-b-2 border-ink p-3 md:border-b-0 md:border-r-2">
        <label className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">{t.filterRoutes(routes.length)}</label>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.phCtb} className={`${inputCls()} mt-1`} />
        <select value={routeSel} onChange={(e) => setRouteSel(e.target.value)} className={`${inputCls()} mt-2`}>
          {filtered.map((r) => (
            <option key={r.route} value={r.route}>{r.route} · {dispOrig(r, lang)} → {dispDest(r, lang)}</option>
          ))}
        </select>
        <div className="mt-2 flex gap-1">
          {(["outbound", "inbound"] as const).map((b) => (
            <button key={b} onClick={() => setBound(b)} className={btnCls(bound === b)}>{t[b]}</button>
          ))}
        </div>
        {head && <p className="mt-2 font-readout text-[11px] text-muted">{dispOrig(head, lang)} → {dispDest(head, lang)}</p>}
        <div className="mt-2 border-2 border-ink">
          <p className="border-b-2 border-ink bg-paper-dim px-3 py-1 font-display text-sm font-bold uppercase tracking-wide">{t.stops(stopIds.length)}</p>
          <StopList stops={stopIds.map((s) => ({ id: s.stop, label: dispName(stopMeta[s.stop], lang) || t.stopFallback(s.seq), sub: `#${s.seq}` }))} selected={stopSel} onSelect={setStopSel} />
        </div>
      </div>
      <div className="p-3">
        <p className="font-display text-sm font-bold uppercase tracking-wide">{t.departuresRouteStop(routeSel, stopSel ?? "—")}</p>
        <p className="font-readout text-[11px] text-muted">{dispName(stopMeta[stopSel ?? ""], lang)} · {t.autoRefresh}</p>
        {etaError ? <ErrorBox message={etaError} /> : etas.length === 0 ? (
          <p className="mt-2 font-readout text-xs text-muted">{t.noDepartures}</p>
        ) : (
          <ul className="mt-2 border-2 border-ink">
            {etas.slice(0, 12).map((e, i) => (
              <EtaLine key={`${e.seq}-${i}-${e.eta ?? ""}`} dest={dispDest(e, lang) || routeSel} eta={e.eta} remark={dispRemark(e, lang) || undefined} seq={e.seq} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- GMB

function GmbPane() {
  const { lang } = useLocale();
  const t = STR[lang];
  const [region, setRegion] = useState<GmbRegion>("HKI");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [code, setCode] = useState("");
  const [seqs, setSeqs] = useState<{ route_seq: number; orig_en?: string; dest_en?: string; orig_tc?: string; dest_tc?: string; orig_ch?: string; dest_ch?: string }[]>([]);
  const [routeId, setRouteId] = useState<number | null>(null);
  const [seq, setSeq] = useState<number | null>(null);
  const [stops, setStops] = useState<{ stop_seq: number; stop_id: number; name_en?: string; name_tc?: string; name_ch?: string }[]>([]);
  const [stopSel, setStopSel] = useState<number | null>(null);
  const [etas, setEtas] = useState<{ eta?: string | null; remarks_en?: string; remarks_tc?: string; remarks_ch?: string }[]>([]);
  const [etaError, setEtaError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    setCodes(null);
    setError(null);
    listGmbRoutes(region, lang)
      .then((r) => {
        if (!live) return;
        setCodes(r);
        setCode((p) => (p && r.includes(p) ? p : (r[0] ?? "")));
      })
      .catch((e) => live && setError(String(e instanceof Error ? e.message : e)));
    return () => {
      live = false;
    };
  }, [region, lang]);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    const all = codes ?? [];
    return (q ? all.filter((c) => c.toUpperCase().includes(q)) : all).slice(0, 60);
  }, [codes, query]);

  useEffect(() => {
    if (!code) return;
    let live = true;
    getGmbRoute(region, code, lang)
      .then((d) => {
        if (!live || !d) return;
        setRouteId(d.route_id);
        const dirs = (d.directions ?? []).map((x) => ({ route_seq: x.route_seq, orig_en: x.orig_en, dest_en: x.dest_en, orig_tc: x.orig_tc, dest_tc: x.dest_tc, orig_ch: x.orig_ch, dest_ch: x.dest_ch }));
        setSeqs(dirs);
        setSeq((p) => (p && dirs.some((x) => x.route_seq === p) ? p : (dirs[0]?.route_seq ?? null)));
      })
      .catch(() => live && setSeqs([]));
    return () => {
      live = false;
    };
  }, [region, code, lang]);

  useEffect(() => {
    if (routeId === null || seq === null) return;
    let live = true;
    getGmbRouteStops(routeId, seq, lang)
      .then((s) => {
        if (!live) return;
        setStops(s);
        setStopSel((p) => (p && s.some((x) => x.stop_seq === p) ? p : (s[0]?.stop_seq ?? null)));
      })
      .catch(() => live && setStops([]));
    return () => {
      live = false;
    };
  }, [routeId, seq, lang]);

  useEffect(() => {
    if (routeId === null || seq === null || stopSel === null) return;
    let live = true;
    setEtaError(null);
    getGmbRouteStopEta(routeId, seq, stopSel, lang)
      .then((e) => live && setEtas(e))
      .catch((e) => live && setEtaError(String(e instanceof Error ? e.message : e)));
    const tm = setInterval(() => setTick((x) => x + 1), ETA_POLL);
    return () => {
      live = false;
      clearInterval(tm);
    };
  }, [routeId, seq, stopSel, lang]);
  useEffect(() => {
    if (tick === 0 || routeId === null || seq === null || stopSel === null) return;
    getGmbRouteStopEta(routeId, seq, stopSel, lang).then((e) => setEtas(e)).catch(() => undefined);
  }, [tick, routeId, seq, stopSel, lang]);

  return (
    <div className="grid gap-0 md:grid-cols-2">
      <div className="border-b-2 border-ink p-3 md:border-b-0 md:border-r-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">{t.region}</span>
          <ChipRow options={["HKI", "KLN", "NT"] as GmbRegion[]} value={region} onChange={setRegion} />
        </div>
        {error ? <ErrorBox message={error} /> : !codes ? <LoadingLine text={t.loadingGmb} /> : (
          <>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.filterCode} className={`${inputCls()} mt-2`} />
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
                {t.seqBtn(d.route_seq)}{(dispOrig(d, lang) || dispDest(d, lang)) ? ` · ${dispOrig(d, lang)}→${dispDest(d, lang)}` : ""}
              </button>
            ))}
          </div>
        )}
        <div className="mt-2 border-2 border-ink">
          <p className="border-b-2 border-ink bg-paper-dim px-3 py-1 font-display text-sm font-bold uppercase tracking-wide">{t.stops(stops.length)}</p>
          <StopList stops={stops.map((s) => ({ id: String(s.stop_seq), label: dispName(s, lang) || t.stopFallback(s.stop_seq), sub: `#${s.stop_seq}` }))} selected={stopSel === null ? null : String(stopSel)} onSelect={(id) => setStopSel(Number(id))} />
        </div>
      </div>
      <div className="p-3">
        <p className="font-display text-sm font-bold uppercase tracking-wide">{t.departuresGmb(code, seq === null ? "—" : String(seq), stopSel === null ? "—" : String(stopSel))}</p>
        <p className="font-readout text-[11px] text-muted">{t.autoRefresh}</p>
        {etaError ? <ErrorBox message={etaError} /> : etas.length === 0 ? (
          <p className="mt-2 font-readout text-xs text-muted">{t.noDepartures}</p>
        ) : (
          <ul className="mt-2 border-2 border-ink">
            {etas.slice(0, 12).map((e, i) => (
              <EtaLine key={i} dest={dispName(stops.find((s) => s.stop_seq === stopSel), lang) || code} eta={e.eta ?? null} remark={dispRemark(e, lang) || undefined} seq={i + 1} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- NLB

function NlbPane() {
  const { lang } = useLocale();
  const t = STR[lang];
  const [routes, setRoutes] = useState<{ routeId: string; routeNo: string; routeName_e?: string; routeName_c?: string; routeName_s?: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [routeId, setRouteId] = useState("");
  const [stops, setStops] = useState<{ stopId: string; stopName_e?: string; stopName_c?: string; stopName_s?: string }[]>([]);
  const [stopSel, setStopSel] = useState<string | null>(null);
  const [etas, setEtas] = useState<{ estimatedArrivalTime: string; routeVariantName?: string; noGPS?: string }[]>([]);
  const [etaError, setEtaError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    listNlbRoutes(lang)
      .then((r) => {
        if (!live) return;
        setRoutes(r);
        if (r.length) setRouteId((p) => p || r[0].routeId);
      })
      .catch((e) => live && setError(String(e instanceof Error ? e.message : e)));
    return () => {
      live = false;
    };
  }, [lang]);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    const all = routes ?? [];
    return (q ? all.filter((r) => r.routeNo.toUpperCase().includes(q) || dispRouteName(r, lang).toUpperCase().includes(q)) : all).slice(0, 60);
  }, [routes, query, lang]);

  useEffect(() => {
    if (!routeId) return;
    let live = true;
    listNlbStops(routeId, lang)
      .then((s) => {
        if (!live) return;
        setStops(s);
        setStopSel((p) => (p && s.some((x) => x.stopId === p) ? p : (s[0]?.stopId ?? null)));
      })
      .catch(() => live && setStops([]));
    return () => {
      live = false;
    };
  }, [routeId, lang]);

  useEffect(() => {
    if (!routeId || !stopSel) return;
    let live = true;
    setEtaError(null);
    getNlbEtas(routeId, stopSel, lang)
      .then((e) => live && setEtas(e))
      .catch((e) => live && setEtaError(String(e instanceof Error ? e.message : e)));
    const tm = setInterval(() => setTick((x) => x + 1), ETA_POLL);
    return () => {
      live = false;
      clearInterval(tm);
    };
  }, [routeId, stopSel, lang]);
  useEffect(() => {
    if (tick === 0 || !routeId || !stopSel) return;
    getNlbEtas(routeId, stopSel, lang).then((e) => setEtas(e)).catch(() => undefined);
  }, [tick, routeId, stopSel, lang]);

  if (!routes) return error ? <ErrorBox message={error} /> : <LoadingLine text={t.loadingNlb} />;
  return (
    <div className="grid gap-0 md:grid-cols-2">
      <div className="border-b-2 border-ink p-3 md:border-b-0 md:border-r-2">
        <label className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">{t.filterRoutes(routes.length)}</label>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.phNlb} className={`${inputCls()} mt-1`} />
        <select value={routeId} onChange={(e) => setRouteId(e.target.value)} className={`${inputCls()} mt-2`}>
          {filtered.map((r) => (
            <option key={r.routeId} value={r.routeId}>{r.routeNo} · {dispRouteName(r, lang) || r.routeId}</option>
          ))}
        </select>
        <div className="mt-2 border-2 border-ink">
          <p className="border-b-2 border-ink bg-paper-dim px-3 py-1 font-display text-sm font-bold uppercase tracking-wide">{t.stops(stops.length)}</p>
          <StopList stops={stops.map((s) => ({ id: s.stopId, label: dispStopName(s, lang) || s.stopId }))} selected={stopSel} onSelect={setStopSel} />
        </div>
      </div>
      <div className="p-3">
        <p className="font-display text-sm font-bold uppercase tracking-wide">{t.departuresStop(stopSel ?? "—")}</p>
        <p className="font-readout text-[11px] text-muted">{t.noGPSNote}</p>
        {etaError ? <ErrorBox message={etaError} /> : etas.length === 0 ? (
          <p className="mt-2 font-readout text-xs text-muted">{t.noDepartures}</p>
        ) : (
          <ul className="mt-2 border-2 border-ink">
            {etas.slice(0, 12).map((e, i) => (
              <EtaLine key={i} dest={e.routeVariantName ?? routes.find((r) => r.routeId === routeId)?.routeNo ?? ""} eta={e.estimatedArrivalTime} remark={e.noGPS === "1" ? t.scheduled : undefined} seq={i + 1} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Stop board (DPO batch + KMB stop-eta)

function BoardPane() {
  const { lang } = useLocale();
  const t = STR[lang];
  const [co, setCo] = useState<"CTB" | "NLB">("CTB");
  const [stopId, setStopId] = useState("");
  const [routes, setRoutes] = useState<{ route?: string; orig_en?: string; dest_en?: string; orig_tc?: string; dest_tc?: string }[] | null>(null);
  const [etas, setEtas] = useState<{ route?: string; eta?: string | null; dest_en?: string; dest_tc?: string; rmk_en?: string; rmk_tc?: string }[]>([]);
  const [kmbEtas, setKmbEtas] = useState<KmbEta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  const go = async (stop: string, company: "CTB" | "NLB", l: typeof lang) => {
    const id = stop.trim();
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const [r, e] = await Promise.all([getBatchStopRoutes(company, id, l), getBatchStopEtas(company, id, l)]);
      setRoutes(r);
      setEtas(e);
      try {
        setKmbEtas(await getKmbStopEtas(id, l));
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
    getBatchStopEtas(co, stopId.trim(), lang).then((e) => setEtas(e)).catch(() => undefined);
    getKmbStopEtas(stopId.trim(), lang).then((e) => setKmbEtas(e)).catch(() => undefined);
  }, [tick, co, stopId, lang]);
  useEffect(() => {
    const tm = setInterval(() => setTick((x) => x + 1), ETA_POLL);
    return () => clearInterval(tm);
  }, []);

  return (
    <div className="p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <span className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">{t.company}</span>
          <div className="mt-1"><ChipRow options={["CTB", "NLB"] as ("CTB" | "NLB")[]} value={co} onChange={setCo} /></div>
        </div>
        <label className="min-w-48 flex-1">
          <span className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">{t.stopIdLabel}</span>
          <input value={stopId} onChange={(e) => setStopId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go(stopId, co, lang)} placeholder={t.boardPlaceholder} className={`${inputCls()} mt-1`} />
        </label>
        <button onClick={() => go(stopId, co, lang)} disabled={busy || !stopId.trim()} className="border-2 border-ink bg-signal px-4 py-1.5 font-display text-lg font-bold uppercase text-paper shadow-[3px_3px_0_var(--color-ink)] disabled:opacity-40 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
          {busy ? "…" : t.board}
        </button>
      </div>
      {error && <ErrorBox message={error} />}
      {routes !== null && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="border-2 border-ink">
            <p className="border-b-2 border-ink bg-paper-dim px-3 py-1 font-display text-sm font-bold uppercase tracking-wide">{t.routesServing(routes.length)}</p>
            {routes.length === 0 ? (
              <p className="px-3 py-2 font-readout text-xs text-muted">{t.noRoutes}</p>
            ) : (
              <ul className="max-h-64 overflow-y-auto">
                {routes.map((r, i) => (
                  <li key={`${r.route}-${i}`} className="border-b border-line px-3 py-1.5 font-readout text-xs last:border-b-0">
                    <span className="font-bold">{r.route ?? "—"}</span>
                    <span className="ml-2 text-ink-soft">{[dispOrig(r, lang), dispDest(r, lang)].filter(Boolean).join(" → ")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-2 border-ink">
            <p className="border-b-2 border-ink bg-paper-dim px-3 py-1 font-display text-sm font-bold uppercase tracking-wide">{t.etasTitle(etas.length + kmbEtas.length)}</p>
            {etas.length === 0 && kmbEtas.length === 0 ? (
              <p className="px-3 py-2 font-readout text-xs text-muted">{t.noBoardEtas}</p>
            ) : (
              <ul>
                {etas.slice(0, 12).map((e, i) => (
                  <EtaLine key={`b-${i}`} dest={`${e.route ?? ""} → ${dispDest(e, lang)}`} eta={e.eta ?? null} remark={dispRemark(e, lang) || undefined} />
                ))}
                {kmbEtas.slice(0, 8).map((e, i) => (
                  <EtaLine key={`k-${i}`} dest={`${e.route} → ${dispDest(e, lang)}`} eta={e.eta} remark={dispRemark(e, lang) || "KMB"} seq={e.seq} />
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
  const { lang } = useLocale();
  const t = STR[lang];
  return (
    <SectionShell
      kicker={t.kicker}
      title={t.title}
      sub={t.sub}
      right={<ChipRow options={OPS} value={op} onChange={setOp} labels={t.ops} />}
    >
      <div className="border-t-2 border-ink">
        {op === "kmb" && <KmbPane />}
        {op === "ctb" && <CtbPane />}
        {op === "gmb" && <GmbPane />}
        {op === "nlb" && <NlbPane />}
        {op === "board" && <BoardPane />}
      </div>
      <p className="border-t border-line px-4 py-2 font-readout text-[11px] text-muted">
        {t.footnote}
      </p>
    </SectionShell>
  );
}
