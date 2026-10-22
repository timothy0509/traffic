import { useEffect, useMemo, useState } from "react";
import { SectionShell, ChipRow, ErrorBox, LoadingLine } from "../ui";
import { useLocale } from "../../lib/locale";
import {
  MTR_BUS_EXAMPLES,
  MTR_LINES,
  MTR_STATIONS,
  LRT_STATIONS,
  HKKF_ROUTES,
  SUNFERRY_ROUTES,
  fetchHkkfEta,
  fetchHkkfRoutes,
  fetchLrtSchedule,
  fetchMtrBusSchedule,
  fetchMtrSchedule,
  fetchSunFerry,
  countdownLabel,
  hkkfRouteName,
  minutesUntil,
  type HkkfDirection,
  type HkkfRoute,
  type LrtPlatform,
  type MtrBusStop,
  type MtrLineCode,
  type MtrSchedule,
  type MtrTrain,
  type SunFerrySailing,
} from "../../lib/feeds/railsea";

type Mode = "mtr" | "lrt" | "bus" | "ferry";
type FerryOp = "hkkf" | "sun";

const STR = {
  en: {
    kicker: "MTR · Light Rail · Ferries",
    title: "Rail + Sea",
    sub: "Next trains, light rail, MTR buses and harbour sailings",
    modes: { mtr: "MTR", lrt: "Light Rail", bus: "MTR Bus", ferry: "Ferries" } as Record<Mode, string>,
    ops: { hkkf: "HKKF", sun: "Sun Ferry" } as Record<FerryOp, string>,
    line: "Line",
    station: "Station",
    auto15: "auto 15s",
    sys: "sys",
    up: "UP",
    down: "DOWN",
    noDep: "No departures reported.",
    errMtr: "Next-train feed unreachable",
    stop: "Stop",
    orId: "Or numeric id",
    exId: "e.g. 010",
    platform: "Platform",
    noRoutes: "No routes reported.",
    noPlatforms: "No platforms reported for this stop.",
    errLrt: "Light Rail feed unreachable",
    routeName: "Route name",
    lookup: "Look up",
    postNote: "POST feed · auto 30s",
    stopHead: "Stop",
    scheduled: "scheduled",
    live: "live",
    noStopsFor: (route: string) => `No stops returned for route ${route}.`,
    errBus: "MTR bus feed unreachable",
    hkkfRoute: "HKKF route",
    routeN: (id: string) => `Route ${id}`,
    direction: "Direction",
    dirs: { outbound: "outbound", inbound: "inbound" } as Record<HkkfDirection, string>,
    auto30: "auto 30s",
    noSailingsOffhours: "No sailings reported — empty off-hours is normal.",
    errHkkf: "HKKF feed unreachable",
    offhoursNormal: "Empty boards off-hours are normal.",
    sunRoute: "Sun Ferry route",
    noSailings: "No sailings reported.",
    departs: "Departs",
    eta: "ETA",
    vesselAt: "Vessel",
    vesselDash: "Vessel —",
    errSun: "Sun Ferry feed unreachable",
    ferryNote: "Note: Fortune Ferry and Water Taxi are omitted — the operator blocks automated access (Cloudflare challenge, no CORS).",
    plat: "Plat",
    stopFallback: (id: string) => `Stop ${id}`,
  },
  tc: {
    kicker: "港鐵 · 輕鐵 · 渡輪",
    title: "鐵路＋海上交通",
    sub: "下班列車、輕鐵、港鐵巴士及渡輪航班",
    modes: { mtr: "港鐵", lrt: "輕鐵", bus: "港鐵巴士", ferry: "渡輪" } as Record<Mode, string>,
    ops: { hkkf: "HKKF", sun: "新渡輪" } as Record<FerryOp, string>,
    line: "路線",
    station: "車站",
    auto15: "每15秒更新",
    sys: "系統",
    up: "上行",
    down: "下行",
    noDep: "暫無班次資料。",
    errMtr: "下班列車資訊未能載入",
    stop: "車站",
    orId: "或輸入車站編號",
    exId: "例如 010",
    platform: "月台",
    noRoutes: "暫無路線資料。",
    noPlatforms: "此車站暫無月台資料。",
    errLrt: "輕鐵資訊未能載入",
    routeName: "路線名稱",
    lookup: "搜尋",
    postNote: "POST 來源 · 每30秒更新",
    stopHead: "車站",
    scheduled: "已編定",
    live: "實時",
    noStopsFor: (route: string) => `路線 ${route} 沒有回報車站。`,
    errBus: "港鐵巴士資訊未能載入",
    hkkfRoute: "HKKF 航線",
    routeN: (id: string) => `路線 ${id}`,
    direction: "方向",
    dirs: { outbound: "去程", inbound: "回程" } as Record<HkkfDirection, string>,
    auto30: "每30秒更新",
    noSailingsOffhours: "暫無航班資料——非服務時間沒有航班屬正常。",
    errHkkf: "HKKF 資訊未能載入",
    offhoursNormal: "非服務時間沒有資料屬正常。",
    sunRoute: "新渡輪航線",
    noSailings: "暫無航班資料。",
    departs: "開出",
    eta: "預計到達",
    vesselAt: "船隻位置",
    vesselDash: "船隻 —",
    errSun: "新渡輪資訊未能載入",
    ferryNote: "註：富裕小輪及水上的士未有收錄——營辦商阻擋自動存取（Cloudflare 驗證、無 CORS）。",
    plat: "月台",
    stopFallback: (id: string) => `車站 ${id}`,
  },
};

const SUNFERRY_LABEL_TC: Record<string, string> = {
  CECC: "中環 → 長洲",
  CCCE: "長洲 → 中環",
  CEMW: "中環 → 梅窩",
  MWCE: "梅窩 → 中環",
  NPHH: "北角 → 紅磡",
  HHNP: "紅磡 → 北角",
  NPKC: "北角 → 九龍城",
  KCNP: "九龍城 → 北角",
};

function useNow(tickMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);
  return now;
}

const selectCls =
  "border-2 border-ink bg-paper px-2 py-1 font-readout text-xs font-bold uppercase tracking-wider";
const btnCls =
  "border-2 border-ink bg-ink px-3 py-1 font-readout text-xs font-bold uppercase tracking-widest text-paper shadow-[3px_3px_0_var(--color-line)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none";
const cardCls = "border-2 border-ink bg-paper";
const labelCls = "font-readout text-[11px] font-bold uppercase tracking-[0.2em] text-ink-soft";

function TrainRow({ t, now }: { t: MtrTrain; now: Date }) {
  const { lang } = useLocale();
  const s = STR[lang];
  const mins = minutesUntil(t.time, now);
  return (
    <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5 last:border-b-0">
      <div>
        <p className="font-readout text-sm font-bold">
          {t.dest} <span className="font-normal text-ink-soft">· {s.plat} {t.plat || "–"}</span>
        </p>
        <p className="font-readout text-[11px] text-ink-soft">{t.time || "—"}</p>
      </div>
      <p className={`font-readout text-sm font-bold ${mins !== null && mins <= 1 ? "text-signal" : ""}`}>
        {countdownLabel(mins, t.ttnt ? `${t.ttnt} min` : t.time, lang)}
      </p>
    </div>
  );
}

function Board({ title, trains, now }: { title: string; trains: MtrTrain[]; now: Date }) {
  const { lang } = useLocale();
  const live = trains.filter((t) => t.valid !== "N");
  return (
    <div className={cardCls}>
      <h4 className="border-b-2 border-ink px-3 py-1.5 font-display text-xl font-bold uppercase">{title}</h4>
      {live.length === 0 ? (
        <p className="px-3 py-3 font-readout text-xs text-ink-soft">{STR[lang].noDep}</p>
      ) : (
        live.map((t) => <TrainRow key={`${t.seq}-${t.dest}-${t.time}`} t={t} now={now} />)
      )}
    </div>
  );
}

function MtrPane() {
  const { lang } = useLocale();
  const s = STR[lang];
  const [line, setLine] = useState<MtrLineCode>("TML");
  const stations = MTR_STATIONS[line];
  const [sta, setSta] = useState(stations[0].code);
  const [data, setData] = useState<MtrSchedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const now = useNow(15_000);

  useEffect(() => {
    setSta(MTR_STATIONS[line][0].code);
  }, [line]);

  useEffect(() => {
    let dead = false;
    setLoading(true);
    const load = async () => {
      try {
        const d = await fetchMtrSchedule(line, sta);
        if (dead) return;
        setData(d);
        setError(null);
      } catch (e) {
        if (dead) return;
        setError(`${s.errMtr} (${String(e)}).`);
      } finally {
        if (!dead) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 15_000);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, [line, sta, s.errMtr]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className={labelCls}>{s.line}</span>
          <select className={selectCls} value={line} onChange={(e) => setLine(e.target.value as MtrLineCode)}>
            {MTR_LINES.map((l) => (
              <option key={l.code} value={l.code}>{l.code} · {l.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>{s.station}</span>
          <select className={selectCls} value={sta} onChange={(e) => setSta(e.target.value)}>
            {stations.map((st) => (
              <option key={st.code} value={st.code}>{st.code} · {st.name}</option>
            ))}
          </select>
        </label>
        <span className="ml-auto font-readout text-[11px] text-ink-soft">
          {data?.sysTime ? `${s.sys} ${data.sysTime}` : ""} · {s.auto15}
        </span>
      </div>
      {loading && !data ? <LoadingLine /> : (
        <div className="grid gap-3 md:grid-cols-2">
          <Board title={s.up} trains={data?.up ?? []} now={now} />
          <Board title={s.down} trains={data?.down ?? []} now={now} />
        </div>
      )}
      {error && <ErrorBox message={error} />}
    </div>
  );
}

function LrtPane() {
  const { lang } = useLocale();
  const s = STR[lang];
  const [id, setId] = useState("010");
  const [custom, setCustom] = useState("");
  const [data, setData] = useState<LrtPlatform[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const activeId = custom.trim() || id;

  useEffect(() => {
    let dead = false;
    setLoading(true);
    const load = async () => {
      try {
        const d = await fetchLrtSchedule(activeId, lang);
        if (dead) return;
        setData(d);
        setError(null);
      } catch (e) {
        if (dead) return;
        setError(`${s.errLrt} (${String(e)}).`);
      } finally {
        if (!dead) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 15_000);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, [activeId, lang, s.errLrt]);

  const name = useMemo(
    () => LRT_STATIONS.find((st) => st.id === activeId)?.name ?? s.stopFallback(activeId),
    [activeId, s],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className={labelCls}>{s.stop}</span>
          <select className={selectCls} value={id} onChange={(e) => { setId(e.target.value); setCustom(""); }}>
            {LRT_STATIONS.map((st) => (
              <option key={st.id} value={st.id}>{st.id} · {st.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>{s.orId}</span>
          <input
            className={`${selectCls} w-28`}
            value={custom}
            inputMode="numeric"
            placeholder={s.exId}
            onChange={(e) => setCustom(e.target.value.replace(/[^0-9]/g, ""))}
          />
        </label>
        <span className="ml-auto font-readout text-[11px] text-ink-soft">{name} · {s.auto15}</span>
      </div>
      {loading && !data ? <LoadingLine /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {(data ?? []).map((p) => (
            <div key={p.platform_id} className={cardCls}>
              <h4 className="border-b-2 border-ink px-3 py-1.5 font-display text-xl font-bold uppercase">
                {s.platform} {p.platform_id}
              </h4>
              {p.route_list.length === 0 ? (
                <p className="px-3 py-3 font-readout text-xs text-ink-soft">{s.noRoutes}</p>
              ) : (
                p.route_list.map((r, i) => (
                  <div key={`${r.route_no}-${i}`} className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5 last:border-b-0">
                    <p className="font-readout text-sm font-bold">
                      {r.route_no} <span className="font-normal text-ink-soft">→ {r.dest || "—"}</span>
                    </p>
                    <p className="font-readout text-sm">{r.time || "—"}</p>
                  </div>
                ))
              )}
            </div>
          ))}
          {data?.length === 0 && (
            <p className="font-readout text-xs text-ink-soft">{s.noPlatforms}</p>
          )}
        </div>
      )}
      {error && <ErrorBox message={error} />}
    </div>
  );
}

function BusPane() {
  const { lang } = useLocale();
  const s = STR[lang];
  const [route, setRoute] = useState("K52");
  const [draft, setDraft] = useState("K52");
  const [data, setData] = useState<MtrBusStop[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let dead = false;
    setLoading(true);
    setData(null);
    const load = async () => {
      try {
        const d = await fetchMtrBusSchedule(route, lang);
        if (dead) return;
        setData(d);
        setError(null);
      } catch (e) {
        if (dead) return;
        setError(`${s.errBus} (${String(e)}).`);
      } finally {
        if (!dead) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, [route, lang, s.errBus]);

  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => { e.preventDefault(); if (draft.trim()) setRoute(draft.trim().toUpperCase()); }}
      >
        <label className="flex flex-col gap-1">
          <span className={labelCls}>{s.routeName}</span>
          <input className={`${selectCls} w-32 uppercase`} value={draft} onChange={(e) => setDraft(e.target.value.toUpperCase())} placeholder="K52" />
        </label>
        <button type="submit" className={btnCls}>{s.lookup}</button>
        <span className="flex flex-wrap gap-1">
          {MTR_BUS_EXAMPLES.map((r) => (
            <button key={r} type="button" onClick={() => { setRoute(r); setDraft(r); }} className="border-2 border-ink bg-paper px-2 py-1 font-readout text-xs font-bold">
              {r}
            </button>
          ))}
        </span>
        <span className="ml-auto font-readout text-[11px] text-ink-soft">{s.postNote}</span>
      </form>
      {loading && !data ? <LoadingLine /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {(data ?? []).map((st, i) => (
            <div key={`${st.busStopId}-${i}`} className={cardCls}>
              <h4 className="border-b-2 border-ink px-3 py-1.5 font-display text-xl font-bold uppercase">
                {s.stopHead} {st.busStopId || `#${i + 1}`}
              </h4>
              {st.bus.length === 0 ? (
                <p className="px-3 py-3 font-readout text-xs text-ink-soft">{s.noDep}</p>
              ) : (
                st.bus.map((b, j) => (
                  <div key={`${b.busId}-${j}`} className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5 last:border-b-0">
                    <p className="font-readout text-sm font-bold">
                      {b.departureTimeText || b.arrivalTimeText || "—"}
                      <span className="ml-2 font-normal text-ink-soft">{b.isScheduled === "1" ? s.scheduled : s.live}</span>
                    </p>
                    <p className="font-readout text-[11px] text-ink-soft">{b.busId || ""}</p>
                  </div>
                ))
              )}
            </div>
          ))}
          {data?.length === 0 && (
            <p className="font-readout text-xs text-ink-soft">{s.noStopsFor(route)}</p>
          )}
        </div>
      )}
      {error && <ErrorBox message={error} />}
    </div>
  );
}

function HkkfPane() {
  const { lang } = useLocale();
  const s = STR[lang];
  const [routeId, setRouteId] = useState("1");
  const [dir, setDir] = useState<HkkfDirection>("outbound");
  const [routes, setRoutes] = useState<HkkfRoute[] | null>(null);
  const [eta, setEta] = useState<unknown[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let dead = false;
    fetchHkkfRoutes().then((r) => { if (!dead) setRoutes(r); }).catch(() => {});
    return () => { dead = true; };
  }, []);

  useEffect(() => {
    let dead = false;
    setLoading(true);
    const load = async () => {
      try {
        const e = await fetchHkkfEta(routeId, dir);
        if (dead) return;
        setEta(e.data ?? []);
        setError(null);
      } catch (err) {
        if (dead) return;
        setError(`${s.errHkkf} (${String(err)}). ${s.offhoursNormal}`);
      } finally {
        if (!dead) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, [routeId, dir, s.errHkkf, s.offhoursNormal]);

  const routeName = (routes ?? []).find(
    (r) => String(r.route_id ?? r.route_no ?? "") === routeId,
  );
  const label = hkkfRouteName(routeName, lang)
    || HKKF_ROUTES.find((r) => r.id === routeId)?.hint
    || s.routeN(routeId);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className={labelCls}>{s.hkkfRoute}</span>
          <select className={selectCls} value={routeId} onChange={(e) => setRouteId(e.target.value)}>
            {HKKF_ROUTES.map((r) => (
              <option key={r.id} value={r.id}>{s.routeN(r.id)}</option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1">
          <span className={labelCls}>{s.direction}</span>
          <ChipRow<HkkfDirection> options={["outbound", "inbound"]} value={dir} onChange={setDir} labels={s.dirs} />
        </div>
        <span className="ml-auto font-readout text-[11px] text-ink-soft">{label} · {s.auto30}</span>
      </div>
      {loading && eta === null ? <LoadingLine /> : (
        (eta ?? []).length === 0 ? (
          <p className="font-readout text-xs text-ink-soft">{s.noSailingsOffhours}</p>
        ) : (
          <div className={cardCls}>
            {(eta ?? []).map((row, i) => (
              <p key={i} className="border-b border-line px-3 py-1.5 font-readout text-xs last:border-b-0">
                {JSON.stringify(row)}
              </p>
            ))}
          </div>
        )
      )}
      {error && <ErrorBox message={error} />}
    </div>
  );
}

function SunPane() {
  const { lang } = useLocale();
  const s = STR[lang];
  const [route, setRoute] = useState("CECC");
  const [data, setData] = useState<SunFerrySailing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let dead = false;
    setLoading(true);
    setData(null);
    const load = async () => {
      try {
        const d = await fetchSunFerry(route, lang);
        if (dead) return;
        setData(d);
        setError(null);
      } catch (e) {
        if (dead) return;
        setError(`${s.errSun} (${String(e)}).`);
      } finally {
        if (!dead) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, [route, lang, s.errSun]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className={labelCls}>{s.sunRoute}</span>
          <select className={selectCls} value={route} onChange={(e) => setRoute(e.target.value)}>
            {SUNFERRY_ROUTES.map((r) => (
              <option key={r.code} value={r.code}>{r.code} · {lang === "tc" ? (SUNFERRY_LABEL_TC[r.code] ?? r.label) : r.label}</option>
            ))}
          </select>
        </label>
        <span className="ml-auto font-readout text-[11px] text-ink-soft">{s.auto30}</span>
      </div>
      {loading && !data ? <LoadingLine /> : (
        (data ?? []).length === 0 ? (
          <p className="font-readout text-xs text-ink-soft">{s.noSailings}</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {(data ?? []).map((sl, i) => (
              <div key={`${sl.vesselcode}-${sl.depart_time}-${i}`} className={cardCls}>
                <h4 className="border-b-2 border-ink px-3 py-1.5 font-display text-xl font-bold uppercase">
                  {sl.vesselcode || s.vesselDash} <span className="text-ink-soft">· {sl.routeName || sl.routecode || route}</span>
                </h4>
                <div className="px-3 py-2 font-readout text-xs">
                  <p>{s.departs} <span className="font-bold">{sl.depart_time || "—"}</span> · {s.eta} <span className="font-bold">{sl.eta || "—"}</span></p>
                  {(sl.lat !== undefined && sl.lat !== "" && sl.lng !== undefined && sl.lng !== "") && (
                    <p className="mt-1 text-ink-soft">{s.vesselAt} {sl.lat}, {sl.lng}</p>
                  )}
                  {sl.remark && (
                    <p className="mt-1 text-ink-soft">{sl.remark}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}
      {error && <ErrorBox message={error} />}
    </div>
  );
}

function FerryPane() {
  const { lang } = useLocale();
  const s = STR[lang];
  const [op, setOp] = useState<FerryOp>("hkkf");
  return (
    <div className="space-y-3">
      <ChipRow<FerryOp>
        options={["hkkf", "sun"]}
        value={op}
        onChange={setOp}
        labels={s.ops}
      />
      {op === "hkkf" ? <HkkfPane /> : <SunPane />}
      <p className="font-readout text-[11px] leading-relaxed text-ink-soft">
        {s.ferryNote}
      </p>
    </div>
  );
}

export default function RailSeaSection() {
  const { lang } = useLocale();
  const s = STR[lang];
  const [mode, setMode] = useState<Mode>("mtr");
  return (
    <SectionShell
      kicker={s.kicker}
      title={s.title}
      sub={s.sub}
    >
      <div className="space-y-3 px-4 py-3">
        <ChipRow<Mode>
          options={["mtr", "lrt", "bus", "ferry"]}
          value={mode}
          onChange={setMode}
          labels={s.modes}
        />
        {mode === "mtr" && <MtrPane />}
        {mode === "lrt" && <LrtPane />}
        {mode === "bus" && <BusPane />}
        {mode === "ferry" && <FerryPane />}
      </div>
    </SectionShell>
  );
}
