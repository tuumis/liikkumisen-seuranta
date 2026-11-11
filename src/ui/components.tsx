import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Card({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-green-700 text-white active:bg-green-800 disabled:bg-slate-300',
  secondary: 'bg-slate-100 text-slate-900 ring-1 ring-slate-300 active:bg-slate-200',
  ghost: 'text-green-800 active:bg-green-50',
};

export function Button({
  variant = 'primary',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`min-h-11 rounded-xl px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed ${VARIANT[variant]} ${className}`}
      {...rest}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'block w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-700/30';

/** Merkintä tehomallin tuottamille luvuille (SPEC 5, D4). */
export function EstimateBadge() {
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900" title="Sovelluksen oma arvio, ei virallinen luku">
      arvio
    </span>
  );
}
