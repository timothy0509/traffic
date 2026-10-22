import { Activity, Car, Gauge, OctagonAlert } from "lucide-react";

export default function StatsBar({ online, total, avgSpeed, totalVol, congested }: { online: number; total: number; avgSpeed: number | null; totalVol: number; congested: number }) {
  const cards = [
    { icon: Activity, label: "Detectors live", value: `${online}/${total}`, sub: "last 30s window" },
    { icon: Gauge, label: "Network avg speed", value: avgSpeed === null ? "—" : `${avgSpeed.toFixed(0)} km/h`, sub: "valid lanes only" },
    { icon: Car, label: "Vehicles counted", value: String(totalVol), sub: "per 30s period" },
    { icon: OctagonAlert, label: "Congested", value: String(congested), sub: "<15 km/h or occ ≥60%" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-400">
            <c.icon size={14} />
            {c.label}
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{c.value}</div>
          <div className="text-xs text-slate-500">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}
