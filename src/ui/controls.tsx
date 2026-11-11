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
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-slate-100 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-10 rounded-lg px-2 text-sm font-medium ${value === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
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
      className={`min-h-10 rounded-full px-3 text-sm font-medium ring-1 ${on ? 'bg-green-700 text-white ring-green-700' : 'bg-white text-slate-700 ring-slate-300'}`}
    >
      {on ? '✓ ' : ''}
      {children}
    </button>
  );
}
