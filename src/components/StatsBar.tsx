import { useLocale } from "../lib/locale";

export default function StatsBar({ online, total, avgSpeed, totalVol, congested }: { online: number; total: number; avgSpeed: number | null; totalVol: number; congested: number }) {
  const { lang } = useLocale();
  const figs: [string, string][] = lang === "tc" ? [
    ["上線檢測器", `${online} / ${total}`],
    ["全網平均車速", avgSpeed === null ? "--" : `${avgSpeed.toFixed(0)} 公里/時`],
    ["車輛 / 30 秒", String(totalVol)],
    ["現正擠塞", String(congested)],
  ] : [
    ["Detectors reporting", `${online} / ${total}`],
    ["Network avg speed", avgSpeed === null ? "--" : `${avgSpeed.toFixed(0)} km/h`],
    ["Vehicles / 30 s", String(totalVol)],
    ["Congested now", String(congested)],
  ];
  return (
    <dl className="grid grid-cols-2 border-2 border-ink bg-paper lg:grid-cols-4">
      {figs.map(([label, value], i) => (
        <div key={label} className={`px-4 py-3 ${i > 0 ? "border-ink max-lg:odd:border-l-2 lg:border-l-2" : ""} ${i >= 2 ? "max-lg:border-t-2 max-lg:border-ink" : ""}`}>
          <dt className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-muted">{label}</dt>
          <dd className="font-readout text-3xl font-bold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
