import { useCallback, useEffect, useMemo, useState } from "react";
import PointsMap, { HK_CENTER, type MapPoint } from "../PointsMap";
import { SectionShell, ChipRow, ErrorBox, LoadingLine } from "../ui";
import { fleetStatus, FLEET_COLORS, FLEET_LABELS, type FleetId, type FleetResult } from "../../lib/feeds/taxi";

type Filter = "all" | FleetId;

const FILTERS: Filter[] = ["all", "amigo", "bigboss", "joie"];
const LABELS: Record<Filter, string> = { all: "All", amigo: "Amigo", bigboss: "BBT", joie: "Joie" };
const POLL_MS = 30_000;

export default function TaxiSection() {
  const [fleets, setFleets] = useState<FleetResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [paused, setPaused] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fleetStatus();
      setFleets(r);
      setError(null);
    } catch (e) {
      setError(`Fleet feed unreachable (${String(e)}).`);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load, paused]);

  const newest = useMemo(() => {
    if (!fleets) return null;
    const stamps = fleets.map((f) => f.counts.newest).filter((s): s is string => s !== null);
    return stamps.length ? stamps.sort().reverse()[0] : null;
  }, [fleets]);

  const points: MapPoint[] = useMemo(() => {
    if (!fleets) return [];
    const wanted = filter === "all" ? fleets : fleets.filter((f) => f.fleet === filter);
    const out: MapPoint[] = [];
    for (const f of wanted) {
      for (const v of f.vehicles) {
        if (v.op_status !== "V") continue;
        out.push({
          id: `${f.fleet}:${v.veh_id}`,
          lat: v.lat,
          lng: v.long,
          tip: `${FLEET_LABELS[f.fleet]} ${v.veh_id} · ${v.time_stamp}`,
          color: FLEET_COLORS[f.fleet],
        });
      }
    }
    return out;
  }, [fleets, filter]);

  const vacantCount = points.length;

  return (
    <SectionShell
      kicker="Taxis"
      title="Fleet taxis"
      sub="Live positions from three fleets · map shows vacant cabs only"
      right={
        <button
          onClick={() => setPaused((p) => !p)}
          className="border-2 border-ink bg-paper px-3 py-1.5 font-readout text-xs font-bold uppercase tracking-widest shadow-[3px_3px_0_var(--color-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          {paused ? "Resume 30s poll" : "Pause poll"}
        </button>
      }
    >
      <div className="flex flex-wrap items-center gap-3 border-b-2 border-ink px-4 py-2">
        <ChipRow options={FILTERS} value={filter} onChange={setFilter} labels={LABELS} />
        <p className="font-readout text-[11px] uppercase tracking-widest text-ink-soft">
          {paused ? "Polling paused" : "Auto-refresh 30s"} · newest reading {newest ?? "--"}
        </p>
      </div>

      {!fleets && !error && <LoadingLine text="Hailing fleet feeds…" />}
      {error && <ErrorBox message={error} />}

      {fleets && (
        <>
          <div className="grid gap-px border-b-2 border-ink bg-ink sm:grid-cols-3">
            {fleets.map((f) => (
              <div key={f.fleet} className="bg-paper px-4 py-2">
                <p className="font-display text-lg font-bold uppercase tracking-wide">
                  <span className="mr-2 inline-block h-2.5 w-2.5 border border-ink" style={{ background: FLEET_COLORS[f.fleet] }} />
                  {FLEET_LABELS[f.fleet]}
                </p>
                <p className="font-readout text-xs tabular-nums text-ink-soft">
                  Total {f.counts.total} · <span className="font-bold text-ink">V {f.counts.vacant}</span>
                  {" · "}O {f.counts.occupied} · N {f.counts.nonService}
                </p>
              </div>
            ))}
          </div>
          <PointsMap points={points} center={HK_CENTER} zoom={11} />
          <p className="border-t-2 border-ink px-4 py-2 font-readout text-[11px] uppercase tracking-widest text-ink-soft">
            Plotting {vacantCount} vacant cabs{filter !== "all" ? ` · ${FLEET_LABELS[filter]} only` : ""} · V vacant / O occupied / N non-service · records with null coords skipped
          </p>
        </>
      )}
    </SectionShell>
  );
}
