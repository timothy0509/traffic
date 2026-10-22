import { useEffect, useMemo, useState } from "react";
import { SectionShell, ErrorBox, LoadingLine } from "../ui";
import { oneStopInfo, spsJoined, wkcda, type OneStopCarpark, type SpsSite, type WkcdaCarpark } from "../../lib/feeds/parking";

const RELAY_NOTE = "Needs relay host: this source has no CORS headers, so it loads on Vercel (/api/relay) but not on plain static hosting.";

function fmtUpload(iso: string | null): string {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-HK", { hour12: false, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function DirectoryDetail({ c }: { c: OneStopCarpark }) {
  const hours = (c.openingHours ?? []).slice(0, 3);
  const hourly = c.privateCar?.hourlyCharges?.slice(0, 3) ?? [];
  const night = c.privateCar?.dayNightParks?.slice(0, 2) ?? [];
  return (
    <article className="border-2 border-ink bg-paper p-4">
      <p className="font-readout text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Static record · {c.park_Id}</p>
      <h3 className="font-display text-2xl font-bold uppercase leading-none">{c.name}</h3>
      <p className="mt-1 font-readout text-xs text-ink-soft">{c.displayAddress ?? ""}</p>
      <p className="mt-1 font-readout text-xs text-ink-soft">
        {[c.district, c.opening_status].filter(Boolean).join(" · ")}
        {typeof c.privateCar?.space === "number" ? ` · ${c.privateCar.space} spaces` : ""}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="font-display text-sm font-bold uppercase tracking-wide">Opening hours</p>
          {hours.length === 0 && <p className="font-readout text-xs text-muted">Not listed.</p>}
          {hours.map((h, i) => (
            <p key={i} className="font-readout text-xs tabular-nums text-ink-soft">
              {h.weekdays.join("/")} {h.periodStart}-{h.periodEnd}
            </p>
          ))}
          <p className="mt-2 font-display text-sm font-bold uppercase tracking-wide">Hourly charges</p>
          {hourly.length === 0 && <p className="font-readout text-xs text-muted">Not listed.</p>}
          {hourly.map((r, i) => (
            <p key={i} className="font-readout text-xs tabular-nums text-ink-soft">
              ${r.price}{r.type ? ` ${r.type}` : ""} · {(r.weekdays ?? []).join("/")} {r.periodStart}-{r.periodEnd}
            </p>
          ))}
          {night.map((r, i) => (
            <p key={`n${i}`} className="font-readout text-xs tabular-nums text-ink-soft">
              ${r.price} {r.type ?? ""} · {(r.weekdays ?? []).join("/")} {r.periodStart}-{r.periodEnd}
            </p>
          ))}
        </div>
        <div>
          <p className="font-display text-sm font-bold uppercase tracking-wide">Spaces</p>
          <p className="font-readout text-xs tabular-nums text-ink-soft">
            Total {c.privateCar?.space ?? "--"} · EV {c.privateCar?.spaceEV ?? "--"} · Accessible {c.privateCar?.spaceDIS ?? "--"}
          </p>
          <p className="mt-2 font-display text-sm font-bold uppercase tracking-wide">Facilities</p>
          <p className="font-readout text-xs text-ink-soft">{(c.facilities ?? []).join(", ") || "Not listed."}</p>
          <p className="mt-2 font-display text-sm font-bold uppercase tracking-wide">Payment</p>
          <p className="font-readout text-xs text-ink-soft">{(c.paymentMethods ?? []).join(", ") || "Not listed."}</p>
          {(c.heightLimits ?? []).length > 0 && (
            <p className="mt-2 font-readout text-xs text-ink-soft">
              Height limit: {(c.heightLimits ?? []).map((h) => `${h.height}m`).join(", ")}
            </p>
          )}
          {c.contactNo && <p className="mt-1 font-readout text-xs text-ink-soft">Tel: {c.contactNo}</p>}
        </div>
      </div>
    </article>
  );
}

export default function ParkingSection() {
  const [dir, setDir] = useState<OneStopCarpark[] | null>(null);
  const [dirErr, setDirErr] = useState<string | null>(null);
  const [sps, setSps] = useState<SpsSite[] | null>(null);
  const [spsRelayFail, setSpsRelayFail] = useState(false);
  const [wk, setWk] = useState<WkcdaCarpark[] | null>(null);
  const [wkRelayFail, setWkRelayFail] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    oneStopInfo().then((r) => { if (live) setDir(r); }).catch((e) => { if (live) setDirErr(String(e)); });
    spsJoined().then((r) => { if (live) setSps(r); }).catch(() => { if (live) setSpsRelayFail(true); });
    wkcda().then((r) => { if (live) setWk(r); }).catch(() => { if (live) setWkRelayFail(true); });
    return () => { live = false; };
  }, []);

  const filtered = useMemo(() => {
    if (!dir) return [];
    const q = query.trim().toLowerCase();
    if (!q) return dir.slice(0, 80);
    return dir.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.district ?? "").toLowerCase().includes(q) ||
      (c.displayAddress ?? "").toLowerCase().includes(q),
    ).slice(0, 80);
  }, [dir, query]);

  const selected: OneStopCarpark | null = useMemo(() => {
    if (!dir) return null;
    if (selectedId) return dir.find((c) => c.park_Id === selectedId) ?? null;
    return filtered[0] ?? null;
  }, [dir, selectedId, filtered]);

  return (
    <SectionShell
      kicker="Parking"
      title="Carparks"
      sub="Directory plus live vacancy where it exists"
    >
      <div className="border-b-2 border-ink bg-paper-dim px-4 py-2 font-readout text-[11px] font-bold uppercase tracking-[0.18em]">
        Static directory <span className="text-muted">· info only, no live counts</span>
        <span className="mx-2 text-muted">/</span>
        <span className="text-signal">Live</span> <span className="text-muted">· Kowloon East SPS + WKCDA</span>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <div>
          <p className="font-display text-lg font-bold uppercase tracking-wide">Directory search · {dir ? `${dir.length} sites` : "loading"}</p>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, district, street"
            className="mt-2 w-full border-2 border-ink bg-paper px-3 py-1.5 font-readout text-sm"
          />
          {dirErr && <ErrorBox message={`Directory unreachable (${dirErr}).`} />}
          {!dir && !dirErr && <LoadingLine text="Loading directory…" />}
          <ul className="mt-2 max-h-72 overflow-auto border-2 border-ink">
            {filtered.map((c) => (
              <li key={c.park_Id}>
                <button
                  onClick={() => setSelectedId(c.park_Id)}
                  className={`block w-full border-b border-line px-3 py-1.5 text-left font-readout text-xs ${selected?.park_Id === c.park_Id ? "bg-ink text-paper" : "bg-paper hover:bg-paper-dim"}`}
                >
                  <span className="font-bold">{c.name}</span>
                  <span className="text-muted"> · {c.district ?? ""}</span>
                </button>
              </li>
            ))}
            {dir && filtered.length === 0 && <li className="px-3 py-3 font-readout text-xs text-muted">No matches.</li>}
          </ul>
          <p className="mt-1 font-readout text-[11px] text-muted">One-stop source: api.data.gov.hk carpark-info-vacancy. Payload carries no live vacancy, shown as directory only.</p>
        </div>
        <div>{selected ? <DirectoryDetail c={selected} /> : <p className="border-2 border-dashed border-muted p-6 font-readout text-xs text-muted">Pick a carpark.</p>}</div>
      </div>

      <div className="lane-rule mx-4" />
      <div className="p-4">
        <p className="font-display text-lg font-bold uppercase tracking-wide">
          Kowloon East SPS <span className="text-signal">· live</span> · {sps ? `${sps.length} sites` : "loading"}
        </p>
        {spsRelayFail && <p className="mt-1 font-readout text-xs text-muted">{RELAY_NOTE}</p>}
        {!sps && !spsRelayFail && <LoadingLine text="Loading SPS vacancy…" />}
        {sps && (
          <div className="mt-2 overflow-auto border-2 border-ink">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b-2 border-ink font-display text-xs font-bold uppercase tracking-[0.15em] text-ink-soft">
                  <th className="px-3 py-1 text-left">Site</th>
                  <th className="px-2 py-1 text-right">Cars free</th>
                  <th className="px-2 py-1 text-right">EV</th>
                  <th className="px-2 py-1 text-right">Acc.</th>
                  <th className="px-2 py-1 text-right">Moto</th>
                  <th className="px-3 py-1 text-right">Updated</th>
                </tr>
              </thead>
              <tbody className="font-readout text-xs tabular-nums">
                {sps.map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-b-0">
                    <td className="px-3 py-1.5">
                      <span className="font-bold">{s.closed ? "[CLOSED] " : ""}{s.name}</span>
                      {s.carSpaces !== null && <span className="text-muted"> / {s.carSpaces} spaces</span>}
                    </td>
                    <td className={`px-2 py-1.5 text-right font-bold ${s.carVacancy === 0 ? "text-signal" : ""}`}>
                      {s.carVacancy ?? "--"}
                    </td>
                    <td className="px-2 py-1.5 text-right">{s.carVacancyEV ?? "--"}</td>
                    <td className="px-2 py-1.5 text-right">{s.carVacancyDIS ?? "--"}</td>
                    <td className="px-2 py-1.5 text-right">{s.motoVacancy ?? "--"}</td>
                    <td className="px-3 py-1.5 text-right text-ink-soft">{fmtUpload(s.lastUpload)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="lane-rule mx-4" />
      <div className="p-4">
        <p className="font-display text-lg font-bold uppercase tracking-wide">
          West Kowloon Cultural District <span className="text-signal">· live</span> · {wk ? `${wk.length} carparks` : "loading"}
        </p>
        {wkRelayFail && <p className="mt-1 font-readout text-xs text-muted">{RELAY_NOTE}</p>}
        {!wk && !wkRelayFail && <LoadingLine text="Loading WKCDA…" />}
        {wk && (
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {wk.map((c) => (
              <article key={c.id} className="border-2 border-ink bg-paper p-3">
                <h3 className="font-display text-lg font-bold uppercase leading-tight">{c.nameEn}</h3>
                <p className="font-readout text-[11px] text-ink-soft">{c.addressEn}</p>
                <p className="mt-1 font-readout text-xs tabular-nums">
                  {c.vacancies.map((v) => `${v.vehicleType}: ${v.hourly} free`).join(" · ") || "No vacancy rows"}
                </p>
                <p className="mt-1 font-readout text-[11px] text-muted">
                  {c.hourlyWeekday} · {c.hourlyWeekend} · {c.openingHours}
                  {c.timestamp ? ` · ${c.timestamp}` : ""}
                </p>
              </article>
            ))}
          </div>
        )}
        <p className="mt-3 font-readout text-[11px] leading-relaxed text-muted">
          Omitted: HKSTP carparks (endpoints return empty bodies as probed) and TD/GPA metered/non-metered/GPA sets (CSDI viewer pages only, not fetchable; covered by the Places section).
        </p>
      </div>
    </SectionShell>
  );
}
