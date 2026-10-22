import { useEffect, useMemo, useState } from "react";
import { SectionShell, ChipRow, ErrorBox, LoadingLine } from "../ui";
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
  const mins = minutesUntil(t.time, now);
  return (
    <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5 last:border-b-0">
      <div>
        <p className="font-readout text-sm font-bold">
          {t.dest} <span className="font-normal text-ink-soft">· Plat {t.plat || "–"}</span>
        </p>
        <p className="font-readout text-[11px] text-ink-soft">{t.time || "—"}</p>
      </div>
      <p className={`font-readout text-sm font-bold ${mins !== null && mins <= 1 ? "text-signal" : ""}`}>
        {countdownLabel(mins, t.ttnt ? `${t.ttnt} min` : t.time)}
      </p>
    </div>
  );
}

function Board({ title, trains, now }: { title: string; trains: MtrTrain[]; now: Date }) {
  const live = trains.filter((t) => t.valid !== "N");
  return (
    <div className={cardCls}>
      <h4 className="border-b-2 border-ink px-3 py-1.5 font-display text-xl font-bold uppercase">{title}</h4>
      {live.length === 0 ? (
        <p className="px-3 py-3 font-readout text-xs text-ink-soft">No departures reported.</p>
      ) : (
        live.map((t) => <TrainRow key={`${t.seq}-${t.dest}-${t.time}`} t={t} now={now} />)
      )}
    </div>
  );
}

function MtrPane() {
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
        setError(`Next-train feed unreachable (${String(e)}).`);
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
  }, [line, sta]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Line</span>
          <select className={selectCls} value={line} onChange={(e) => setLine(e.target.value as MtrLineCode)}>
            {MTR_LINES.map((l) => (
              <option key={l.code} value={l.code}>{l.code} · {l.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Station</span>
          <select className={selectCls} value={sta} onChange={(e) => setSta(e.target.value)}>
            {stations.map((s) => (
              <option key={s.code} value={s.code}>{s.code} · {s.name}</option>
            ))}
          </select>
        </label>
        <span className="ml-auto font-readout text-[11px] text-ink-soft">
          {data?.sysTime ? `sys ${data.sysTime}` : ""} · auto 15s
        </span>
      </div>
      {loading && !data ? <LoadingLine /> : (
        <div className="grid gap-3 md:grid-cols-2">
          <Board title="UP" trains={data?.up ?? []} now={now} />
          <Board title="DOWN" trains={data?.down ?? []} now={now} />
        </div>
      )}
      {error && <ErrorBox message={error} />}
    </div>
  );
}

function LrtPane() {
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
        const d = await fetchLrtSchedule(activeId);
        if (dead) return;
        setData(d);
        setError(null);
      } catch (e) {
        if (dead) return;
        setError(`Light Rail feed unreachable (${String(e)}).`);
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
  }, [activeId]);

  const name = useMemo(
    () => LRT_STATIONS.find((s) => s.id === activeId)?.name ?? `Stop ${activeId}`,
    [activeId],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Stop</span>
          <select className={selectCls} value={id} onChange={(e) => { setId(e.target.value); setCustom(""); }}>
            {LRT_STATIONS.map((s) => (
              <option key={s.id} value={s.id}>{s.id} · {s.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Or numeric id</span>
          <input
            className={`${selectCls} w-28`}
            value={custom}
            inputMode="numeric"
            placeholder="e.g. 010"
            onChange={(e) => setCustom(e.target.value.replace(/[^0-9]/g, ""))}
          />
        </label>
        <span className="ml-auto font-readout text-[11px] text-ink-soft">{name} · auto 15s</span>
      </div>
      {loading && !data ? <LoadingLine /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {(data ?? []).map((p) => (
            <div key={p.platform_id} className={cardCls}>
              <h4 className="border-b-2 border-ink px-3 py-1.5 font-display text-xl font-bold uppercase">
                Platform {p.platform_id}
              </h4>
              {p.route_list.length === 0 ? (
                <p className="px-3 py-3 font-readout text-xs text-ink-soft">No routes reported.</p>
              ) : (
                p.route_list.map((r, i) => (
                  <div key={`${r.route_no}-${i}`} className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5 last:border-b-0">
                    <p className="font-readout text-sm font-bold">
                      {r.route_no} <span className="font-normal text-ink-soft">→ {r.dest_en || "—"}</span>
                    </p>
                    <p className="font-readout text-sm">{r.time_en || "—"}</p>
                  </div>
                ))
              )}
            </div>
          ))}
          {data?.length === 0 && (
            <p className="font-readout text-xs text-ink-soft">No platforms reported for this stop.</p>
          )}
        </div>
      )}
      {error && <ErrorBox message={error} />}
    </div>
  );
}

function BusPane() {
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
        const d = await fetchMtrBusSchedule(route);
        if (dead) return;
        setData(d);
        setError(null);
      } catch (e) {
        if (dead) return;
        setError(`MTR bus feed unreachable (${String(e)}).`);
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
  }, [route]);

  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => { e.preventDefault(); if (draft.trim()) setRoute(draft.trim().toUpperCase()); }}
      >
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Route name</span>
          <input className={`${selectCls} w-32 uppercase`} value={draft} onChange={(e) => setDraft(e.target.value.toUpperCase())} placeholder="K52" />
        </label>
        <button type="submit" className={btnCls}>Look up</button>
        <span className="flex flex-wrap gap-1">
          {MTR_BUS_EXAMPLES.map((r) => (
            <button key={r} type="button" onClick={() => { setRoute(r); setDraft(r); }} className="border-2 border-ink bg-paper px-2 py-1 font-readout text-xs font-bold">
              {r}
            </button>
          ))}
        </span>
        <span className="ml-auto font-readout text-[11px] text-ink-soft">POST feed · auto 30s</span>
      </form>
      {loading && !data ? <LoadingLine /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {(data ?? []).map((s, i) => (
            <div key={`${s.busStopId}-${i}`} className={cardCls}>
              <h4 className="border-b-2 border-ink px-3 py-1.5 font-display text-xl font-bold uppercase">
                Stop {s.busStopId || `#${i + 1}`}
              </h4>
              {s.bus.length === 0 ? (
                <p className="px-3 py-3 font-readout text-xs text-ink-soft">No departures reported.</p>
              ) : (
                s.bus.map((b, j) => (
                  <div key={`${b.busId}-${j}`} className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5 last:border-b-0">
                    <p className="font-readout text-sm font-bold">
                      {b.departureTimeText || b.arrivalTimeText || "—"}
                      <span className="ml-2 font-normal text-ink-soft">{b.isScheduled === "1" ? "scheduled" : "live"}</span>
                    </p>
                    <p className="font-readout text-[11px] text-ink-soft">{b.busId || ""}</p>
                  </div>
                ))
              )}
            </div>
          ))}
          {data?.length === 0 && (
            <p className="font-readout text-xs text-ink-soft">No stops returned for route {route}.</p>
          )}
        </div>
      )}
      {error && <ErrorBox message={error} />}
    </div>
  );
}

function HkkfPane() {
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
        setError(`HKKF feed unreachable (${String(err)}). Empty boards off-hours are normal.`);
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
  }, [routeId, dir]);

  const routeName = (routes ?? []).find(
    (r) => String(r.route_id ?? r.route_no ?? "") === routeId,
  );
  const label = routeName?.name_en
    ?? (typeof routeName?.origin === "string" && typeof routeName?.destination === "string"
      ? `${routeName.origin} – ${routeName.destination}` : null)
    ?? HKKF_ROUTES.find((r) => r.id === routeId)?.hint
    ?? `Route ${routeId}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className={labelCls}>HKKF route</span>
          <select className={selectCls} value={routeId} onChange={(e) => setRouteId(e.target.value)}>
            {HKKF_ROUTES.map((r) => (
              <option key={r.id} value={r.id}>Route {r.id}</option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1">
          <span className={labelCls}>Direction</span>
          <ChipRow<HkkfDirection> options={["outbound", "inbound"]} value={dir} onChange={setDir} />
        </div>
        <span className="ml-auto font-readout text-[11px] text-ink-soft">{label} · auto 30s</span>
      </div>
      {loading && eta === null ? <LoadingLine /> : (
        (eta ?? []).length === 0 ? (
          <p className="font-readout text-xs text-ink-soft">No sailings reported — empty off-hours is normal.</p>
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
        const d = await fetchSunFerry(route);
        if (dead) return;
        setData(d);
        setError(null);
      } catch (e) {
        if (dead) return;
        setError(`Sun Ferry feed unreachable (${String(e)}).`);
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
  }, [route]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Sun Ferry route</span>
          <select className={selectCls} value={route} onChange={(e) => setRoute(e.target.value)}>
            {SUNFERRY_ROUTES.map((r) => (
              <option key={r.code} value={r.code}>{r.code} · {r.label}</option>
            ))}
          </select>
        </label>
        <span className="ml-auto font-readout text-[11px] text-ink-soft">auto 30s</span>
      </div>
      {loading && !data ? <LoadingLine /> : (
        (data ?? []).length === 0 ? (
          <p className="font-readout text-xs text-ink-soft">No sailings reported.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {(data ?? []).map((s, i) => (
              <div key={`${s.vesselcode}-${s.depart_time}-${i}`} className={cardCls}>
                <h4 className="border-b-2 border-ink px-3 py-1.5 font-display text-xl font-bold uppercase">
                  {s.vesselcode || "Vessel —"} <span className="text-ink-soft">· {s.route_en || s.routecode || route}</span>
                </h4>
                <div className="px-3 py-2 font-readout text-xs">
                  <p>Departs <span className="font-bold">{s.depart_time || "—"}</span> · ETA <span className="font-bold">{s.eta || "—"}</span></p>
                  {(s.lat !== undefined && s.lat !== "" && s.lng !== undefined && s.lng !== "") && (
                    <p className="mt-1 text-ink-soft">Vessel {s.lat}, {s.lng}</p>
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
  const [op, setOp] = useState<FerryOp>("hkkf");
  return (
    <div className="space-y-3">
      <ChipRow<FerryOp>
        options={["hkkf", "sun"]}
        value={op}
        onChange={setOp}
        labels={{ hkkf: "HKKF", sun: "Sun Ferry" }}
      />
      {op === "hkkf" ? <HkkfPane /> : <SunPane />}
      <p className="font-readout text-[11px] leading-relaxed text-ink-soft">
        Note: Fortune Ferry and Water Taxi are omitted — the operator blocks automated access (Cloudflare challenge, no CORS).
      </p>
    </div>
  );
}

export default function RailSeaSection() {
  const [mode, setMode] = useState<Mode>("mtr");
  return (
    <SectionShell
      kicker="MTR · Light Rail · Ferries"
      title="Rail + Sea"
      sub="Next trains, light rail, MTR buses and harbour sailings"
    >
      <div className="space-y-3 px-4 py-3">
        <ChipRow<Mode>
          options={["mtr", "lrt", "bus", "ferry"]}
          value={mode}
          onChange={setMode}
          labels={{ mtr: "MTR", lrt: "Light Rail", bus: "MTR Bus", ferry: "Ferries" }}
        />
        {mode === "mtr" && <MtrPane />}
        {mode === "lrt" && <LrtPane />}
        {mode === "bus" && <BusPane />}
        {mode === "ferry" && <FerryPane />}
      </div>
    </SectionShell>
  );
}
