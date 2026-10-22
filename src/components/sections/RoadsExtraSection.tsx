import { useEffect, useMemo, useState } from "react";
import PointsMap, { HK_CENTER } from "../PointsMap";
import { ChipRow, ErrorBox, LoadingLine, SectionShell } from "../ui";
import { useLocale, type Locale } from "../../lib/locale";
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

const STR = {
  en: {
    kicker: "Transport Department · road extras",
    title: "Road Extras",
    sub: "CCTV snapshots · journey-time corridors · speed-map panels · roadworks · static lists",
    tabs: { cameras: "Cameras", corridors: "Corridors", panels: "Panels", roadworks: "Roadworks", lists: "Lists" } as Record<Tab, string>,
    state: ["n/a", "smooth", "slow", "congested"],
    all: "All",
    region: "Region",
    district: "District",
    searchCam: "Search key / description",
    camPh: "e.g. H429F or Aberdeen",
    camLine: (f: number, t: number) =>
      `${f} of ${t} cameras · snapshot refreshes every 2 min · map shows cameras within 3 km of selection`,
    noCam: "No camera",
    snapNA: (k: string) => `Snapshot unavailable for ${k} right now.`,
    updated: (t: string) => `updated ${t} HKT`,
    andMoreCam: (n: number) => `…and ${n} more — narrow the filters.`,
    andMoreWorks: (n: number) => `…and ${n} more — pick a district.`,
    tuning: "Tuning in to journey-time feed…",
    corridorsLine: (n: number, cap: string) =>
      `${n} corridors · colours as published · polls every 2 min${cap ? ` · capture ${cap}` : ""}`,
    panelsLine: (n: number) => `${n} verified panels · snapshots refresh with the 2-min CCTV tick`,
    districtN: (n: number) => `District (${n})`,
    worksLine: (n: number, d: string, all: string) => `${n} roadworks${d !== all ? ` in ${d}` : ""}`,
    detail: "Detail",
    road: "Road",
    location: "Location",
    works: "Works",
    boundLane: "Bound / lane",
    period: "Period",
    districtWord: "District",
    pickPin: "Pick a pin or row.",
    blackH: "Junction blacksites",
    blackSub: (f: number, t: number) => `HK1980 grid coords — table only, no map · ${f} of ${t}`,
    blackNote: "",
    blackPh: "Search junctions…",
    blackHead: ["Type", "Junction", "Easting", "Northing", "Note"],
    show200: (n: number) => `Showing 200 of ${n} — narrow the search.`,
    rlcH: "Red-light-camera junctions",
    rlcSub: (f: number, t: number) => `Address only, no coordinates — list only · ${f} of ${t}`,
    rlcPh: "Search sites…",
    rlcHead: ["No.", "Site (EN)", "Site (TC)"],
    errCam: (e: string) => `Camera index unreachable (${e}).`,
    errCor: (e: string) => `Journey-time feed unreachable (${e}).`,
    errWorks: (e: string) => `Roadworks feed unreachable (${e}).`,
    errLists: (e: string) => `Static lists unreachable (${e}).`,
  },
  tc: {
    kicker: "運輸署 · 道路其他資訊",
    title: "道路資訊",
    sub: "閉路電視快拍 · 行車時間走廊 · 車速圖 · 道路工程 · 靜態名單",
    tabs: { cameras: "攝影機", corridors: "走廊", panels: "車速圖", roadworks: "道路工程", lists: "名單" } as Record<Tab, string>,
    state: ["不適用", "暢順", "緩慢", "擠塞"],
    all: "全部",
    region: "區域",
    district: "地區",
    searchCam: "搜尋編號 / 描述",
    camPh: "例如 H429F 或 Aberdeen",
    camLine: (f: number, t: number) =>
      `共 ${t} 部攝影機，顯示 ${f} 部 · 快拍每 2 分鐘更新 · 地圖顯示所選 3 公里內的攝影機`,
    noCam: "沒有攝影機",
    snapNA: (k: string) => `暫時無法取得 ${k} 的快拍。`,
    updated: (t: string) => `更新於 ${t} 香港時間`,
    andMoreCam: (n: number) => `…還有 ${n} 部 — 請收窄篩選。`,
    andMoreWorks: (n: number) => `…還有 ${n} 宗 — 請選擇地區。`,
    tuning: "正在接收行車時間資訊…",
    corridorsLine: (n: number, cap: string) =>
      `共 ${n} 條走廊 · 顏色按官方公布 · 每 2 分鐘更新${cap ? ` · 擷取 ${cap}` : ""}`,
    panelsLine: (n: number) => `共 ${n} 幅已核實車速圖 · 快拍與 2 分鐘閉路電視節拍同步更新`,
    districtN: (n: number) => `地區 (${n})`,
    worksLine: (n: number, d: string, all: string) => `共 ${n} 宗道路工程${d !== all ? ` · ${d}` : ""}`,
    detail: "詳情",
    road: "道路",
    location: "位置",
    works: "工程類別",
    boundLane: "方向 / 行車線",
    period: "期間",
    districtWord: "地區",
    pickPin: "點選地圖圖釘或列表。",
    blackH: "路口交通黑點",
    blackSub: (f: number, t: number) => `HK1980 格網座標 — 只設表格，不設地圖 · ${f} / ${t}`,
    blackNote: "官方暫無中文檔案 — 以下為英文原文。",
    blackPh: "搜尋路口…",
    blackHead: ["類別", "路口", "東距", "北距", "備註"],
    show200: (n: number) => `僅顯示 200 項，共 ${n} 項 — 請收窄搜尋。`,
    rlcH: "衝紅燈攝影機路口",
    rlcSub: (f: number, t: number) => `只有地址，沒有座標 — 只設列表 · ${f} / ${t}`,
    rlcPh: "搜尋地點…",
    rlcHead: ["編號", "地點（英文）", "地點（中文）"],
    errCam: (e: string) => `無法取得攝影機索引 (${e})。`,
    errCor: (e: string) => `無法取得行車時間資訊 (${e})。`,
    errWorks: (e: string) => `無法取得道路工程資訊 (${e})。`,
    errLists: (e: string) => `無法取得靜態名單 (${e})。`,
  },
};

function stringsFor(lang: Locale) {
  return STR[lang];
}

const CORRIDOR_BG: Record<number, string> = {
  1: "bg-go",
  2: "bg-vms",
  3: "bg-signal",
  0: "bg-muted",
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
  const { lang } = useLocale();
  const S = stringsFor(lang);
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

  const [panelLang, setPanelLang] = useState<PanelLang>(lang === "tc" ? "tc" : "en");
  const [blackQuery, setBlackQuery] = useState("");
  const [rlcQuery, setRlcQuery] = useState("");

  useEffect(() => {
    setPanelLang(lang === "tc" ? "tc" : "en");
  }, [lang]);

  useEffect(() => {
    let dead = false;
    setCameras(null);
    setWorks(null);
    setBlacksites(null);
    setRlc(null);
    cameraIndex(lang)
      .then((c) => dead || (setCameras(c), setSelKey((k) => k ?? c[0]?.key ?? null)))
      .catch((e) => dead || setCamErr(S.errCam(String(e))));
    const loadCor = () =>
      corridorTimes(lang)
        .then((c) => dead || setCorridors(c))
        .catch((e) => dead || setCorErr(S.errCor(String(e))));
    loadCor();
    const corT = setInterval(loadCor, 120_000);
    roadworkList(lang)
      .then((w) => dead || setWorks(w))
      .catch((e) => dead || setWorksErr(S.errWorks(String(e))));
    Promise.all([blacksiteList(lang), rlcList(lang)])
      .then(([b, r]) => dead || (setBlacksites(b), setRlc(r)))
      .catch((e) => dead || setListErr(S.errLists(String(e))));
    const imgT = setInterval(() => setImgTick(Date.now()), 120_000);
    return () => {
      dead = true;
      clearInterval(corT);
      clearInterval(imgT);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

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
      kicker={S.kicker}
      title={S.title}
      sub={S.sub}
      right={
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`border-2 border-ink px-3 py-1 font-display text-base font-bold uppercase tracking-wide ${tab === t ? "bg-ink text-paper" : "bg-paper hover:bg-paper-dim"}`}
            >
              {S.tabs[t]}
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
                  {S.region}
                  <select value={region} onChange={(e) => { setRegion(e.target.value); setDistrict("All"); }} className="mt-1 w-full border-2 border-ink bg-paper px-2 py-1 font-readout text-xs">
                    {regions.map((r) => (
                      <option key={r} value={r}>{r === "All" ? S.all : r}</option>
                    ))}
                  </select>
                </label>
                <label className="font-readout text-xs uppercase tracking-widest text-ink-soft">
                  {S.district}
                  <select value={district} onChange={(e) => setDistrict(e.target.value)} className="mt-1 w-full border-2 border-ink bg-paper px-2 py-1 font-readout text-xs">
                    {districts.map((d) => (
                      <option key={d} value={d}>{d === "All" ? S.all : d}</option>
                    ))}
                  </select>
                </label>
                <div className="md:col-span-2">
                  <span className="font-readout text-xs uppercase tracking-widest text-ink-soft">{S.searchCam}</span>
                  <div className="mt-1">
                    <FilterInput value={camQuery} onChange={setCamQuery} placeholder={S.camPh} />
                  </div>
                </div>
              </div>
              <p className="mt-2 font-readout text-xs text-ink-soft">
                {S.camLine(filteredCams.length, cameras.length)}
              </p>
              <div className="mt-2 grid gap-3 lg:grid-cols-5">
                <div className="border-2 border-ink lg:col-span-3">
                  <div className="border-b-2 border-ink bg-ink px-2 py-1 font-readout text-xs font-bold uppercase tracking-widest text-paper">
                    {selected ? `${selected.key} — ${selected.description}` : S.noCam}
                  </div>
                  {selected &&
                    (imgBroken ? (
                      <p className="px-3 py-8 font-readout text-xs text-signal">{S.snapNA(selected.key)}</p>
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
                      {selected.region} · {selected.district} · {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)} · {S.updated(new Date(imgTick).toLocaleTimeString(lang === "tc" ? "zh-HK" : "en-HK", { hour12: false }))}
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
                  <p className="px-2 py-1 font-readout text-[11px] text-ink-soft">{S.andMoreCam(filteredCams.length - 120)}</p>
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
            <LoadingLine text={S.tuning} />
          ) : (
            <>
              <p className="font-readout text-xs uppercase tracking-widest text-ink-soft">
                {S.corridorsLine(corridors.length, corridors[0]?.captureDate ?? "")}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {corridors.map((c) => {
                  const st = S.state[c.colour] ?? S.state[0];
                  const bg = CORRIDOR_BG[c.colour] ?? CORRIDOR_BG[0];
                  return (
                    <span key={`${c.from}-${c.to}`} title={`${st} · ${lang === "tc" ? "擷取" : "capture"} ${c.captureDate}`} className="flex items-center gap-1.5 border-2 border-ink bg-paper px-2 py-1 font-readout text-xs font-bold shadow-[2px_2px_0_var(--color-ink)]">
                      <span className={`inline-block h-2.5 w-2.5 border border-ink ${bg}`} />
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
            <p className="font-readout text-xs uppercase tracking-widest text-ink-soft">{S.panelsLine(PANEL_IDS.length)}</p>
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
                  {S.districtN(workDistricts.length - 1)}
                  <select value={workDistrict} onChange={(e) => { setWorkDistrict(e.target.value); setWorkId(null); }} className="mt-1 w-full border-2 border-ink bg-paper px-2 py-1 font-readout text-xs">
                    {workDistricts.map((d) => (
                      <option key={d} value={d}>{d === "All" ? S.all : d}</option>
                    ))}
                  </select>
                </label>
                <p className="self-end font-readout text-xs text-ink-soft md:col-span-2">{S.worksLine(filteredWorks.length, workDistrict, "All")}</p>
              </div>
              <div className="mt-2 grid gap-3 lg:grid-cols-5">
                <div className="lg:col-span-3">
                  <PointsMap points={workPins} center={pickedWork ? [pickedWork.lat, pickedWork.lng] : HK_CENTER} zoom={pickedWork ? 14 : 11} heightClass="h-[360px]" onPick={setWorkId} />
                </div>
                <div className="border-2 border-ink lg:col-span-2">
                  <div className="border-b-2 border-ink bg-ink px-2 py-1 font-readout text-xs font-bold uppercase tracking-widest text-paper">{S.detail}</div>
                  {pickedWork ? (
                    <dl className="space-y-1 px-3 py-2 font-readout text-xs">
                      <div><dt className="uppercase tracking-widest text-ink-soft">{S.road}</dt><dd className="font-bold">{pickedWork.road}</dd></div>
                      <div><dt className="uppercase tracking-widest text-ink-soft">{S.location}</dt><dd>{pickedWork.loc}</dd></div>
                      <div><dt className="uppercase tracking-widest text-ink-soft">{S.works}</dt><dd>{pickedWork.worksType} · {pickedWork.status}</dd></div>
                      <div><dt className="uppercase tracking-widest text-ink-soft">{S.boundLane}</dt><dd>{pickedWork.bound}{pickedWork.lane ? ` · ${pickedWork.lane}` : ""}</dd></div>
                      <div><dt className="uppercase tracking-widest text-ink-soft">{S.period}</dt><dd>{pickedWork.start} → {pickedWork.end}</dd></div>
                      <div><dt className="uppercase tracking-widest text-ink-soft">{S.districtWord}</dt><dd>{pickedWork.district} · {pickedWork.lat.toFixed(5)}, {pickedWork.lng.toFixed(5)}</dd></div>
                    </dl>
                  ) : (
                    <p className="px-3 py-6 font-readout text-xs text-ink-soft">{S.pickPin}</p>
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
                  <p className="px-2 py-1 font-readout text-[11px] text-ink-soft">{S.andMoreWorks(filteredWorks.length - 150)}</p>
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
            <h3 className="font-display text-xl font-bold uppercase">{S.blackH}</h3>
            <p className="font-readout text-[11px] uppercase tracking-widest text-ink-soft">{S.blackSub(filteredBlack.length, blacksites?.length ?? 0)}</p>
            {S.blackNote && <p className="mt-1 font-readout text-[11px] text-ink-soft">{S.blackNote}</p>}
            <div className="mt-1 max-w-md">
              <FilterInput value={blackQuery} onChange={setBlackQuery} placeholder={S.blackPh} />
            </div>
            {!blacksites ? (
              <LoadingLine />
            ) : (
              <div className="mt-2">
                <TableShell head={S.blackHead}>
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
                  <p className="mt-1 font-readout text-[11px] text-ink-soft">{S.show200(filteredBlack.length)}</p>
                )}
              </div>
            )}
          </div>
          <div>
            <h3 className="font-display text-xl font-bold uppercase">{S.rlcH}</h3>
            <p className="font-readout text-[11px] uppercase tracking-widest text-ink-soft">{S.rlcSub(filteredRlc.length, rlc?.length ?? 0)}</p>
            <div className="mt-1 max-w-md">
              <FilterInput value={rlcQuery} onChange={setRlcQuery} placeholder={S.rlcPh} />
            </div>
            {!rlc ? (
              <LoadingLine />
            ) : (
              <div className="mt-2">
                <TableShell head={S.rlcHead}>
                  {filteredRlc.slice(0, 200).map((r) => (
                    <tr key={r.no} className="border-b border-line odd:bg-paper-dim">
                      <td className="px-2 py-1 font-bold tabular-nums">{r.no}</td>
                      <td className="px-2 py-1">{lang === "tc" ? r.tc || r.en : r.en}</td>
                      <td className="px-2 py-1">{lang === "tc" ? r.en : r.tc}</td>
                    </tr>
                  ))}
                </TableShell>
                {filteredRlc.length > 200 && (
                  <p className="mt-1 font-readout text-[11px] text-ink-soft">{S.show200(filteredRlc.length)}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </SectionShell>
  );
}
