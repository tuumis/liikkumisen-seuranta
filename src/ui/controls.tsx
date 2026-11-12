import type { ReactNode } from 'react';
import type { Effort } from '../domain/types';

/** Vaihtoehtorivi (segmented control). */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-[var(--surface-sunk)] p-1 shadow-[inset_0_0_0_1px_var(--line)]">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`press min-h-10 rounded-xl px-2 text-sm font-semibold ${value === o.value ? 'bg-[var(--surface-raised)] text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const EFFORT_OPTIONS: { value: Effort; label: string }[] = [
  { value: -1, label: 'Kevyempi' },
  { value: 0, label: 'Tavallinen' },
  { value: 1, label: 'Kovempi' },
];

/** Päälle/pois-siru (esim. lihas, luusto). */
export function ToggleChip({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={`press inline-flex min-h-10 items-center gap-1 rounded-full px-3.5 text-sm font-semibold ${
        on ? 'bg-green-700 text-white shadow-[0_4px_12px_-4px_rgb(var(--accent-rgb)/0.5)]' : 'bg-[var(--surface-sunk)] text-slate-700 shadow-[inset_0_0_0_1px_var(--line)] hover:text-slate-900'
      }`}
    >
      {on && (
        <svg viewBox="0 0 24 24" className="anim-pop size-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m5 12.5 4.2 4.2L19 7" />
        </svg>
      )}
      {children}
    </button>
  );
}
