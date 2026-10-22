import { useEffect, useMemo, useState } from "react";
import PointsMap, { HK_CENTER } from "../PointsMap";
import { ChipRow, ErrorBox, LoadingLine, SectionShell } from "../ui";
import {
  PANEL_IDS,
  blacksiteList,
  cameraImageUrl,
  cameraIndex,
  corridorTimes,
  panelUrl,
  rlcList,
  roadworkList,
  type Blacksite,
  type CorridorTime,
  type PanelLang,
  type RlcSite,
  type Roadwork,
  type TrafficCamera,
} from "../../lib/feeds/roadextra";

type Tab = "cameras" | "corridors" | "panels" | "roadworks" | "lists";

const TABS: Tab[] = ["cameras", "corridors", "panels", "roadworks", "lists"];
const TAB_LABELS: Record<Tab, string> = {
  cameras: "Cameras",
  corridors: "Corridors",
  panels: "Panels",
  roadworks: "Roadworks",
  lists: "Lists",
};

const CORRIDOR_STYLE: Record<number, { bg: string; label: string }> = {
  1: { bg: "bg-go", label: "smooth" },
  2: { bg: "bg-vms", label: "slow" },
  3: { bg: "bg-signal", label: "congested" },
  0: { bg: "bg-muted", label: "n/a" },
};

function havKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = 6371;
  const dLa = ((bLat - aLat) * Math.PI) / 180;
  const dLo = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLa / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLo / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(s));
}

function FilterInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border-2 border-ink bg-paper px-2 py-1 font-readout text-xs outline-none placeholder:text-muted"
    />
  );
}

function TableShell({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto border-2 border-ink">
      <table className="w-full border-collapse font-readout text-xs">
        <thead>
          <tr className="bg-ink text-paper">
            {head.map((h) => (
              <th key={h} className="px-2 py-1 text-left font-bold uppercase tracking-widest">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default function RoadsExtraSection() {
  const [tab, setTab] = useState<Tab>("cameras");

  const [cameras, setCameras] = useState<TrafficCamera[] | null>(null);
  const [camErr, setCamErr] = useState<string | null>(null);
  const [corridors, setCorridors] = useState<CorridorTime[] | null>(null);
  const [corErr, setCorErr] = useState<string | null>(null);
  const [works, setWorks] = useState<Roadwork[] | null>(null);
  const [worksErr, setWorksErr] = useState<string | null>(null);
  const [blacksites, setBlacksites] = useState<Blacksite[] | null>(null);
  const [rlc, setRlc] = useState<RlcSite[] | null>(null);
  const [listErr, setListErr] = useState<string | null>(null);

  const [region, setRegion] = useState("All");
  const [district, setDistrict] = useState("All");
  const [camQuery, setCamQuery] = useState("");
  const [selKey, setSelKey] = useState<string | null>(null);
  const [imgTick, setImgTick] = useState(() => Date.now());
  const [imgBroken, setImgBroken] = useState(false);

  const [workDistrict, setWorkDistrict] = useState("All");
  const [workId, setWorkId] = useState<string | null>(null);

  const [panelLang, setPanelLang] = useState<PanelLang>("en");
  const [blackQuery, setBlackQuery] = useState("");
  const [rlcQuery, setRlcQuery] = useState("");

  useEffect(() => {
    let dead = false;
    cameraIndex()
      .then((c) => dead || (setCameras(c), setSelKey((k) => k ?? c[0]?.key ?? null)))
      .catch((e) => dead || setCamErr(`Camera index unreachable (${String(e)}).`));
    const loadCor = () =>
      corridorTimes()
        .then((c) => dead || setCorridors(c))
        .catch((e) => dead || setCorErr(`Journey-time feed unreachable (${String(e)}).`));
    loadCor();
    const corT = setInterval(loadCor, 120_000);
    roadworkList()
      .then((w) => dead || setWorks(w))
      .catch((e) => dead || setWorksErr(`Roadworks feed unreachable (${String(e)}).`));
    Promise.all([blacksiteList(), rlcList()])
      .then(([b, r]) => dead || (setBlacksites(b), setRlc(r)))
      .catch((e) => dead || setListErr(`Static lists unreachable (${String(e)}).`));
    const imgT = setInterval(() => setImgTick(Date.now()), 120_000);
    return () => {
      dead = true;
      clearInterval(corT);
      clearInterval(imgT);
    };
  }, []);

  useEffect(() => {
    setImgBroken(false);
  }, [selKey, imgTick]);

  const regions = useMemo(
    () => ["All", ...Array.from(new Set((cameras ?? []).map((c) => c.region))).sort()],
    [cameras]
  );
  const districts = useMemo(() => {
    const pool = (cameras ?? []).filter((c) => region === "All" || c.region === region);
    return ["All", ...Array.from(new Set(pool.map((c) => c.district))).sort()];
  }, [cameras, region]);

  const filteredCams = useMemo(() => {
    const q = camQuery.trim().toLowerCase();
    return (cameras ?? []).filter(
      (c) =>
        (region === "All" || c.region === region) &&
        (district === "All" || c.district === district) &&
        (!q || c.key.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
    );
  }, [cameras, region, district, camQuery]);

  const selected = useMemo(
    () => (cameras ?? []).find((c) => c.key === selKey) ?? filteredCams[0] ?? null,
    [cameras, selKey, filteredCams]
  );

  const camPins = useMemo(() => {
    if (!selected) return filteredCams.slice(0, 400).map((c) => ({ id: c.key, lat: c.lat, lng: c.lng, tip: `${c.key} ${c.description}`, color: c.key === selKey ? "#ffb000" : "#c8102e" }));
    const near = (cameras ?? [])
      .map((c) => ({ c, d: havKm(selected.lat, selected.lng, c.lat, c.lng) }))
      .filter((x) => x.d < 3)
      .sort((a, b) => a.d - b.d)
      .slice(0, 80)
      .map((x) => x.c);
    const ids = new Set(near.map((c) => c.key));
    const pins = near.map((c) => ({ id: c.key, lat: c.lat, lng: c.lng, tip: `${c.key} ${c.description}`, color: c.key === selected.key ? "#ffb000" : "#c8102e" }));
    if (!ids.has(selected.key))
      pins.unshift({ id: selected.key, lat: selected.lat, lng: selected.lng, tip: `${selected.key} ${selected.description}`, color: "#ffb000" });
    return pins;
  }, [cameras, filteredCams, selected, selKey]);

  const workDistricts = useMemo(
    () => ["All", ...Array.from(new Set((works ?? []).map((w) => w.district))).sort()],
    [works]
  );
  const filteredWorks = useMemo(
    () => (works ?? []).filter((w) => workDistrict === "All" || w.district === workDistrict),
    [works, workDistrict]
  );
  const pickedWork = useMemo(
    () => (works ?? []).find((w) => w.id === workId) ?? filteredWorks[0] ?? null,
    [works, workId, filteredWorks]
  );
  const workPins = useMemo(
    () =>
      filteredWorks.slice(0, 1000).map((w) => ({
        id: w.id,
        lat: w.lat,
        lng: w.lng,
        tip: `${w.road} — ${w.loc}`,
        color: w.id === pickedWork?.id ? "#ffb000" : "#1a7f4b",
      })),
    [filteredWorks, pickedWork]
  );

  const filteredBlack = useMemo(() => {
    const q = blackQuery.trim().toLowerCase();
    if (!q) return blacksites ?? [];
    return (blacksites ?? []).filter(
      (b) => b.junction.toLowerCase().includes(q) || b.type.toLowerCase().includes(q) || b.note.toLowerCase().includes(q)
    );
  }, [blacksites, blackQuery]);

  const filteredRlc = useMemo(() => {
    const q = rlcQuery.trim().toLowerCase();
    if (!q) return rlc ?? [];
    return (rlc ?? []).filter((r) => r.en.toLowerCase().includes(q) || r.tc.includes(rlcQuery.trim()));
  }, [rlc, rlcQuery]);

  return (
    <SectionShell
      kicker="Transport Department · road extras"
      title="Road Extras"
      sub="CCTV snapshots · journey-time corridors · speed-map panels · roadworks · static lists"
      right={
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`border-2 border-ink px-3 py-1 font-display text-base font-bold uppercase tracking-wide ${tab === t ? "bg-ink text-paper" : "bg-paper hover:bg-paper-dim"}`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      }
    >
      {tab === "cameras" && (
        <div className="px-4 py-3">
          {camErr && <ErrorBox message={camErr} />}
          {!cameras ? (
            <LoadingLine />
          ) : (
            <>
              <div className="grid gap-2 md:grid-cols-4">
                <label className="font-readout text-xs uppercase tracking-widest text-ink-soft">
                  Region
                  <select value={region} onChange={(e) => { setRegion(e.target.value); setDistrict("All"); }} className="mt-1 w-full border-2 border-ink bg-paper px-2 py-1 font-readout text-xs">
                    {regions.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
                <label className="font-readout text-xs uppercase tracking-widest text-ink-soft">
                  District
                  <select value={district} onChange={(e) => setDistrict(e.target.value)} className="mt-1 w-full border-2 border-ink bg-paper px-2 py-1 font-readout text-xs">
                    {districts.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>
                <div className="md:col-span-2">
                  <span className="font-readout text-xs uppercase tracking-widest text-ink-soft">Search key / description</span>
                  <div className="mt-1">
                    <FilterInput value={camQuery} onChange={setCamQuery} placeholder="e.g. H429F or Aberdeen" />
                  </div>
                </div>
              </div>
              <p className="mt-2 font-readout text-xs text-ink-soft">
                {filteredCams.length} of {cameras.length} cameras · snapshot refreshes every 2 min · map shows cameras within 3 km of selection
              </p>
              <div className="mt-2 grid gap-3 lg:grid-cols-5">
                <div className="border-2 border-ink lg:col-span-3">
                  <div className="border-b-2 border-ink bg-ink px-2 py-1 font-readout text-xs font-bold uppercase tracking-widest text-paper">
                    {selected ? `${selected.key} — ${selected.description}` : "No camera"}
                  </div>
                  {selected &&
                    (imgBroken ? (
                      <p className="px-3 py-8 font-readout text-xs text-signal">Snapshot unavailable for {selected.key} right now.</p>
                    ) : (
                      <img
                        key={`${selected.key}-${imgTick}`}
                        src={`${cameraImageUrl(selected.key)}?t=${imgTick}`}
                        alt={`Traffic snapshot ${selected.key}`}
                        className="block aspect-video w-full bg-paper-dim object-contain"
                        onError={() => setImgBroken(true)}
                      />
                    ))}
                  {selected && (
                    <p className="border-t-2 border-ink px-2 py-1 font-readout text-[11px] uppercase tracking-widest text-ink-soft">
                      {selected.region} · {selected.district} · {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)} · updated {new Date(imgTick).toLocaleTimeString("en-HK", { hour12: false })} HKT
                    </p>
                  )}
                </div>
                <div className="lg:col-span-2">
                  <PointsMap
                    points={camPins}
                    center={selected ? [selected.lat, selected.lng] : HK_CENTER}
                    zoom={selected ? 14 : 11}
                    heightClass="h-[320px]"
                    onPick={setSelKey}
                  />
                </div>
              </div>
              <div className="mt-2 max-h-56 overflow-y-auto border-2 border-ink">
                {filteredCams.slice(0, 120).map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setSelKey(c.key)}
                    className={`block w-full border-b border-line px-2 py-1 text-left font-readout text-xs ${c.key === selected?.key ? "bg-ink text-paper" : "hover:bg-paper-dim"}`}
                  >
                    <span className="font-bold">{c.key}</span> · {c.description}
                  </button>
                ))}
                {filteredCams.length > 120 && (
                  <p className="px-2 py-1 font-readout text-[11px] text-ink-soft">…and {filteredCams.length - 120} more — narrow the filters.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "corridors" && (
        <div className="px-4 py-3">
          {corErr && <ErrorBox message={corErr} />}
          {!corridors ? (
            <LoadingLine text="Tuning in to journey-time feed…" />
          ) : (
            <>
              <p className="font-readout text-xs uppercase tracking-widest text-ink-soft">
                {corridors.length} corridors · colours as published · polls every 2 min
                {corridors[0]?.captureDate ? ` · capture ${corridors[0].captureDate}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {corridors.map((c) => {
                  const st = CORRIDOR_STYLE[c.colour] ?? CORRIDOR_STYLE[0];
                  return (
                    <span key={`${c.from}-${c.to}`} title={`${st.label} · capture ${c.captureDate}`} className="flex items-center gap-1.5 border-2 border-ink bg-paper px-2 py-1 font-readout text-xs font-bold shadow-[2px_2px_0_var(--color-ink)]">
                      <span className={`inline-block h-2.5 w-2.5 border border-ink ${st.bg}`} />
                      {c.from}→{c.to} · {c.minutes} min
                    </span>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "panels" && (
        <div className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <ChipRow<PanelLang> options={["en", "tc"]} value={panelLang} onChange={setPanelLang} labels={{ en: "EN", tc: "繁" }} />
            <p className="font-readout text-xs uppercase tracking-widest text-ink-soft">{PANEL_IDS.length} verified panels · snapshots refresh with the 2-min CCTV tick</p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {PANEL_IDS.map((id) => (
              <figure key={id} className="border-2 border-ink bg-paper">
                <figcaption className="border-b-2 border-ink bg-ink px-2 py-1 font-readout text-xs font-bold uppercase tracking-widest text-paper">
                  {id}.{panelLang}
                </figcaption>
                <img key={`${id}-${panelLang}-${imgTick}`} src={`${panelUrl(id, panelLang)}?t=${imgTick}`} alt={`Speed map panel ${id} (${panelLang})`} loading="lazy" className="block w-full object-contain" />
              </figure>
            ))}
          </div>
        </div>
      )}

      {tab === "roadworks" && (
        <div className="px-4 py-3">
          {worksErr && <ErrorBox message={worksErr} />}
          {!works ? (
            <LoadingLine />
          ) : (
            <>
              <div className="grid gap-2 md:grid-cols-3">
                <label className="font-readout text-xs uppercase tracking-widest text-ink-soft">
                  District ({workDistricts.length - 1})
                  <select value={workDistrict} onChange={(e) => { setWorkDistrict(e.target.value); setWorkId(null); }} className="mt-1 w-full border-2 border-ink bg-paper px-2 py-1 font-readout text-xs">
                    {workDistricts.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>
                <p className="self-end font-readout text-xs text-ink-soft md:col-span-2">{filteredWorks.length} roadworks{workDistrict !== "All" ? ` in ${workDistrict}` : ""}</p>
              </div>
              <div className="mt-2 grid gap-3 lg:grid-cols-5">
                <div className="lg:col-span-3">
                  <PointsMap points={workPins} center={pickedWork ? [pickedWork.lat, pickedWork.lng] : HK_CENTER} zoom={pickedWork ? 14 : 11} heightClass="h-[360px]" onPick={setWorkId} />
                </div>
                <div className="border-2 border-ink lg:col-span-2">
                  <div className="border-b-2 border-ink bg-ink px-2 py-1 font-readout text-xs font-bold uppercase tracking-widest text-paper">Detail</div>
                  {pickedWork ? (
                    <dl className="space-y-1 px-3 py-2 font-readout text-xs">
                      <div><dt className="uppercase tracking-widest text-ink-soft">Road</dt><dd className="font-bold">{pickedWork.road}</dd></div>
                      <div><dt className="uppercase tracking-widest text-ink-soft">Location</dt><dd>{pickedWork.loc}</dd></div>
                      <div><dt className="uppercase tracking-widest text-ink-soft">Works</dt><dd>{pickedWork.worksType} · {pickedWork.status}</dd></div>
                      <div><dt className="uppercase tracking-widest text-ink-soft">Bound / lane</dt><dd>{pickedWork.bound}{pickedWork.lane ? ` · ${pickedWork.lane}` : ""}</dd></div>
                      <div><dt className="uppercase tracking-widest text-ink-soft">Period</dt><dd>{pickedWork.start} → {pickedWork.end}</dd></div>
                      <div><dt className="uppercase tracking-widest text-ink-soft">District</dt><dd>{pickedWork.district} · {pickedWork.lat.toFixed(5)}, {pickedWork.lng.toFixed(5)}</dd></div>
                    </dl>
                  ) : (
                    <p className="px-3 py-6 font-readout text-xs text-ink-soft">Pick a pin or row.</p>
                  )}
                </div>
              </div>
              <div className="mt-2 max-h-56 overflow-y-auto border-2 border-ink">
                {filteredWorks.slice(0, 150).map((w) => (
                  <button key={w.id} onClick={() => setWorkId(w.id)} className={`block w-full border-b border-line px-2 py-1 text-left font-readout text-xs ${w.id === pickedWork?.id ? "bg-ink text-paper" : "hover:bg-paper-dim"}`}>
                    <span className="font-bold">{w.road}</span> · {w.loc} · {w.status}
                  </button>
                ))}
                {filteredWorks.length > 150 && (
                  <p className="px-2 py-1 font-readout text-[11px] text-ink-soft">…and {filteredWorks.length - 150} more — pick a district.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "lists" && (
        <div className="space-y-4 px-4 py-3">
          {listErr && <ErrorBox message={listErr} />}
          <div>
            <h3 className="font-display text-xl font-bold uppercase">Junction blacksites</h3>
            <p className="font-readout text-[11px] uppercase tracking-widest text-ink-soft">HK1980 grid coords — table only, no map · {filteredBlack.length} of {blacksites?.length ?? 0}</p>
            <div className="mt-1 max-w-md">
              <FilterInput value={blackQuery} onChange={setBlackQuery} placeholder="Search junctions…" />
            </div>
            {!blacksites ? (
              <LoadingLine />
            ) : (
              <div className="mt-2">
                <TableShell head={["Type", "Junction", "Easting", "Northing", "Note"]}>
                  {filteredBlack.slice(0, 200).map((b, i) => (
                    <tr key={`${b.junction}-${i}`} className="border-b border-line odd:bg-paper-dim">
                      <td className="px-2 py-1 font-bold">{b.type}</td>
                      <td className="px-2 py-1">{b.junction}</td>
                      <td className="px-2 py-1 tabular-nums">{b.easting}</td>
                      <td className="px-2 py-1 tabular-nums">{b.northing}</td>
                      <td className="px-2 py-1">{b.note}</td>
                    </tr>
                  ))}
                </TableShell>
                {filteredBlack.length > 200 && (
                  <p className="mt-1 font-readout text-[11px] text-ink-soft">Showing 200 of {filteredBlack.length} — narrow the search.</p>
                )}
              </div>
            )}
          </div>
          <div>
            <h3 className="font-display text-xl font-bold uppercase">Red-light-camera junctions</h3>
            <p className="font-readout text-[11px] uppercase tracking-widest text-ink-soft">Address only, no coordinates — list only · {filteredRlc.length} of {rlc?.length ?? 0}</p>
            <div className="mt-1 max-w-md">
              <FilterInput value={rlcQuery} onChange={setRlcQuery} placeholder="Search sites…" />
            </div>
            {!rlc ? (
              <LoadingLine />
            ) : (
              <div className="mt-2">
                <TableShell head={["No.", "Site (EN)", "Site (TC)"]}>
                  {filteredRlc.slice(0, 200).map((r) => (
                    <tr key={r.no} className="border-b border-line odd:bg-paper-dim">
                      <td className="px-2 py-1 font-bold tabular-nums">{r.no}</td>
                      <td className="px-2 py-1">{r.en}</td>
                      <td className="px-2 py-1">{r.tc}</td>
                    </tr>
                  ))}
                </TableShell>
                {filteredRlc.length > 200 && (
                  <p className="mt-1 font-readout text-[11px] text-ink-soft">Showing 200 of {filteredRlc.length} — narrow the search.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </SectionShell>
  );
}
