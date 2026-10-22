import { useEffect, useMemo, useState } from "react";
import { SectionShell, ErrorBox, LoadingLine } from "../ui";
import { useLocale } from "../../lib/locale";
import { oneStopInfo, spsJoined, wkcda, type OneStopCarpark, type SpsSite, type WkcdaCarpark } from "../../lib/feeds/parking";

const STR = {
  en: {
    kicker: "Parking",
    title: "Carparks",
    sub: "Directory plus live vacancy where it exists",
    staticDir: "Static directory",
    infoOnly: "· info only, no live counts",
    live: "Live",
    liveSrc: "· Kowloon East SPS + WKCDA",
    dirSearch: "Directory search",
    sites: (n: number) => `${n} sites`,
    loading: "loading",
    filterPh: "Filter by name, district, street",
    dirErr: "Directory unreachable",
    loadingDir: "Loading directory…",
    noMatches: "No matches.",
    onestopNote: "One-stop source: api.data.gov.hk carpark-info-vacancy. Payload carries no live vacancy, shown as directory only.",
    pickOne: "Pick a carpark.",
    staticRec: "Static record",
    openingHours: "Opening hours",
    notListed: "Not listed.",
    hourly: "Hourly charges",
    spaces: "Spaces",
    spacesLine: (t: string, ev: string, dis: string) => `Total ${t} · EV ${ev} · Accessible ${dis}`,
    spacesSuffix: (n: number) => ` · ${n} spaces`,
    facilities: "Facilities",
    payment: "Payment",
    heightLimit: "Height limit",
    tel: "Tel",
    spsTitle: "Kowloon East SPS",
    spsLoading: "Loading SPS vacancy…",
    relayNote: "Needs relay host: this source has no CORS headers, so it loads on Vercel (/api/relay) but not on plain static hosting.",
    thSite: "Site",
    thCars: "Cars free",
    thEV: "EV",
    thAcc: "Acc.",
    thMoto: "Moto",
    thUpdated: "Updated",
    closed: "[CLOSED] ",
    spacesOf: (n: number) => ` / ${n} spaces`,
    wkTitle: "West Kowloon Cultural District",
    carparks: (n: number) => `${n} carparks`,
    wkLoading: "Loading WKCDA…",
    noVacRows: "No vacancy rows",
    free: (hourly: number) => `${hourly} free`,
    omitted: "Omitted: HKSTP carparks (endpoints return empty bodies as probed) and TD/GPA metered/non-metered/GPA sets (CSDI viewer pages only, not fetchable; covered by the Places section).",
    dash: "--",
  },
  tc: {
    kicker: "泊車",
    title: "停車場",
    sub: "停車場名錄及現有實時空位（如有）",
    staticDir: "靜態名錄",
    infoOnly: "· 僅供參考，無實時數據",
    live: "實時",
    liveSrc: "· 九龍東 SPS + 西九文化區",
    dirSearch: "搜尋名錄",
    sites: (n: number) => `${n} 個場地`,
    loading: "載入中",
    filterPh: "按名稱、地區、街道篩選",
    dirErr: "名錄未能載入",
    loadingDir: "正在載入名錄…",
    noMatches: "沒有符合的結果。",
    onestopNote: "資料來源：api.data.gov.hk carpark-info-vacancy。該數據不含實時空位，僅作名錄顯示。",
    pickOne: "請選擇一個停車場。",
    staticRec: "靜態記錄",
    openingHours: "開放時間",
    notListed: "未有列出。",
    hourly: "時租收費",
    spaces: "車位",
    spacesLine: (t: string, ev: string, dis: string) => `合共 ${t} · 電動車 ${ev} · 無障礙 ${dis}`,
    spacesSuffix: (n: number) => ` · ${n} 個車位`,
    facilities: "設施",
    payment: "付款方式",
    heightLimit: "高度限制",
    tel: "電話",
    spsTitle: "九龍東 SPS",
    spsLoading: "正在載入 SPS 空位…",
    relayNote: "需要中轉主機：此來源沒有 CORS 標頭，只能在 Vercel（/api/relay）載入，純靜態託管無法載入。",
    thSite: "車場",
    thCars: "空車位",
    thEV: "電動車",
    thAcc: "無障礙",
    thMoto: "電單車",
    thUpdated: "更新時間",
    closed: "[已關閉] ",
    spacesOf: (n: number) => ` / ${n} 個車位`,
    wkTitle: "西九文化區",
    carparks: (n: number) => `${n} 個停車場`,
    wkLoading: "正在載入西九文化區…",
    noVacRows: "暫無空位數據",
    free: (hourly: number) => `${hourly} 個空位`,
    omitted: "未收錄：HKSTP 停車場（探測顯示端點回傳空內容）及運輸署錶位／非錶位／政府產業署車位（僅 CSDI 檢視器頁面，無法擷取；見「地點」部分）。",
    dash: "--",
  },
};

function fmtUpload(iso: string | null, lang: "en" | "tc"): string {
  if (!iso) return STR[lang].dash;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(lang === "tc" ? "zh-HK" : "en-HK", { hour12: false, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function DirectoryDetail({ c }: { c: OneStopCarpark }) {
  const { lang } = useLocale();
  const s = STR[lang];
  const hours = (c.openingHours ?? []).slice(0, 3);
  const hourly = c.privateCar?.hourlyCharges?.slice(0, 3) ?? [];
  const night = c.privateCar?.dayNightParks?.slice(0, 2) ?? [];
  return (
    <article className="border-2 border-ink bg-paper p-4">
      <p className="font-readout text-[11px] font-bold uppercase tracking-[0.2em] text-muted">{s.staticRec} · {c.park_Id}</p>
      <h3 className="font-display text-2xl font-bold uppercase leading-none">{c.name}</h3>
      <p className="mt-1 font-readout text-xs text-ink-soft">{c.displayAddress ?? ""}</p>
      <p className="mt-1 font-readout text-xs text-ink-soft">
        {[c.district, c.opening_status].filter(Boolean).join(" · ")}
        {typeof c.privateCar?.space === "number" ? s.spacesSuffix(c.privateCar.space) : ""}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="font-display text-sm font-bold uppercase tracking-wide">{s.openingHours}</p>
          {hours.length === 0 && <p className="font-readout text-xs text-muted">{s.notListed}</p>}
          {hours.map((h, i) => (
            <p key={i} className="font-readout text-xs tabular-nums text-ink-soft">
              {h.weekdays.join("/")} {h.periodStart}-{h.periodEnd}
            </p>
          ))}
          <p className="mt-2 font-display text-sm font-bold uppercase tracking-wide">{s.hourly}</p>
          {hourly.length === 0 && <p className="font-readout text-xs text-muted">{s.notListed}</p>}
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
          <p className="font-display text-sm font-bold uppercase tracking-wide">{s.spaces}</p>
          <p className="font-readout text-xs tabular-nums text-ink-soft">
            {s.spacesLine(
              c.privateCar?.space != null ? String(c.privateCar.space) : s.dash,
              c.privateCar?.spaceEV != null ? String(c.privateCar.spaceEV) : s.dash,
              c.privateCar?.spaceDIS != null ? String(c.privateCar.spaceDIS) : s.dash,
            )}
          </p>
          <p className="mt-2 font-display text-sm font-bold uppercase tracking-wide">{s.facilities}</p>
          <p className="font-readout text-xs text-ink-soft">{(c.facilities ?? []).join(", ") || s.notListed}</p>
          <p className="mt-2 font-display text-sm font-bold uppercase tracking-wide">{s.payment}</p>
          <p className="font-readout text-xs text-ink-soft">{(c.paymentMethods ?? []).join(", ") || s.notListed}</p>
          {(c.heightLimits ?? []).length > 0 && (
            <p className="mt-2 font-readout text-xs text-ink-soft">
              {s.heightLimit}: {(c.heightLimits ?? []).map((h) => `${h.height}m`).join(", ")}
            </p>
          )}
          {c.contactNo && <p className="mt-1 font-readout text-xs text-ink-soft">{s.tel}: {c.contactNo}</p>}
        </div>
      </div>
    </article>
  );
}

export default function ParkingSection() {
  const { lang } = useLocale();
  const s = STR[lang];
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
    return () => { live = false; };
  }, []);

  useEffect(() => {
    let live = true;
    setWk(null);
    setWkRelayFail(false);
    wkcda(lang).then((r) => { if (live) setWk(r); }).catch(() => { if (live) setWkRelayFail(true); });
    return () => { live = false; };
  }, [lang]);

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
      kicker={s.kicker}
      title={s.title}
      sub={s.sub}
    >
      <div className="border-b-2 border-ink bg-paper-dim px-4 py-2 font-readout text-[11px] font-bold uppercase tracking-[0.18em]">
        {s.staticDir} <span className="text-muted">{s.infoOnly}</span>
        <span className="mx-2 text-muted">/</span>
        <span className="text-signal">{s.live}</span> <span className="text-muted">{s.liveSrc}</span>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <div>
          <p className="font-display text-lg font-bold uppercase tracking-wide">{s.dirSearch} · {dir ? s.sites(dir.length) : s.loading}</p>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={s.filterPh}
            className="mt-2 w-full border-2 border-ink bg-paper px-3 py-1.5 font-readout text-sm"
          />
          {dirErr && <ErrorBox message={`${s.dirErr} (${dirErr}).`} />}
          {!dir && !dirErr && <LoadingLine text={s.loadingDir} />}
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
            {dir && filtered.length === 0 && <li className="px-3 py-3 font-readout text-xs text-muted">{s.noMatches}</li>}
          </ul>
          <p className="mt-1 font-readout text-[11px] text-muted">{s.onestopNote}</p>
        </div>
        <div>{selected ? <DirectoryDetail c={selected} /> : <p className="border-2 border-dashed border-muted p-6 font-readout text-xs text-muted">{s.pickOne}</p>}</div>
      </div>

      <div className="lane-rule mx-4" />
      <div className="p-4">
        <p className="font-display text-lg font-bold uppercase tracking-wide">
          {s.spsTitle} <span className="text-signal">· {s.live}</span> · {sps ? s.sites(sps.length) : s.loading}
        </p>
        {spsRelayFail && <p className="mt-1 font-readout text-xs text-muted">{s.relayNote}</p>}
        {!sps && !spsRelayFail && <LoadingLine text={s.spsLoading} />}
        {sps && (
          <div className="mt-2 overflow-auto border-2 border-ink">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b-2 border-ink font-display text-xs font-bold uppercase tracking-[0.15em] text-ink-soft">
                  <th className="px-3 py-1 text-left">{s.thSite}</th>
                  <th className="px-2 py-1 text-right">{s.thCars}</th>
                  <th className="px-2 py-1 text-right">{s.thEV}</th>
                  <th className="px-2 py-1 text-right">{s.thAcc}</th>
                  <th className="px-2 py-1 text-right">{s.thMoto}</th>
                  <th className="px-3 py-1 text-right">{s.thUpdated}</th>
                </tr>
              </thead>
              <tbody className="font-readout text-xs tabular-nums">
                {sps.map((site) => (
                  <tr key={site.id} className="border-b border-line last:border-b-0">
                    <td className="px-3 py-1.5">
                      <span className="font-bold">{site.closed ? s.closed : ""}{site.name}</span>
                      {site.carSpaces !== null && <span className="text-muted">{s.spacesOf(site.carSpaces)}</span>}
                    </td>
                    <td className={`px-2 py-1.5 text-right font-bold ${site.carVacancy === 0 ? "text-signal" : ""}`}>
                      {site.carVacancy ?? s.dash}
                    </td>
                    <td className="px-2 py-1.5 text-right">{site.carVacancyEV ?? s.dash}</td>
                    <td className="px-2 py-1.5 text-right">{site.carVacancyDIS ?? s.dash}</td>
                    <td className="px-2 py-1.5 text-right">{site.motoVacancy ?? s.dash}</td>
                    <td className="px-3 py-1.5 text-right text-ink-soft">{fmtUpload(site.lastUpload, lang)}</td>
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
          {s.wkTitle} <span className="text-signal">· {s.live}</span> · {wk ? s.carparks(wk.length) : s.loading}
        </p>
        {wkRelayFail && <p className="mt-1 font-readout text-xs text-muted">{s.relayNote}</p>}
        {!wk && !wkRelayFail && <LoadingLine text={s.wkLoading} />}
        {wk && (
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {wk.map((c) => (
              <article key={c.id} className="border-2 border-ink bg-paper p-3">
                <h3 className="font-display text-lg font-bold uppercase leading-tight">{c.name}</h3>
                <p className="font-readout text-[11px] text-ink-soft">{c.address}</p>
                <p className="mt-1 font-readout text-xs tabular-nums">
                  {c.vacancies.map((v) => `${v.vehicleType}: ${s.free(v.hourly)}`).join(" · ") || s.noVacRows}
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
          {s.omitted}
        </p>
      </div>
    </SectionShell>
  );
}
