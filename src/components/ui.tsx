import type { ReactNode } from "react";

// Shared bulletin chrome so every section looks like one paper.
export function SectionShell({ kicker, title, sub, right, children }: { kicker: string; title: string; sub?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-2 border-ink bg-paper">
      <header className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-ink px-4 py-3">
        <div>
          <p className="font-readout text-[11px] font-bold uppercase tracking-[0.28em] text-signal">{kicker}</p>
          <h2 className="font-display text-3xl font-bold uppercase leading-none">{title}</h2>
          {sub && <p className="mt-1 font-display text-lg text-ink-soft">{sub}</p>}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return <p className="border-t-2 border-signal px-4 py-2 font-readout text-xs text-signal">{message}</p>;
}

export function LoadingLine({ text = "Tuning in to feed…" }: { text?: string }) {
  return <p className="px-4 py-6 font-readout text-sm text-ink-soft">{text}</p>;
}

export function ChipRow<T extends string>({ options, value, onChange, labels }: { options: T[]; value: T; onChange: (v: T) => void; labels?: Partial<Record<T, string>> }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} className={`border-2 border-ink px-2 py-1 font-readout text-xs font-bold ${value === o ? "bg-ink text-paper" : "bg-paper"}`}>
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  );
}
