// Perus-UI-komponentit design systemin tokeneilla (src/index.css): kortit, painikkeet, kentät, merkit.

import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Card({
  title,
  children,
  action,
  className = '',
  eyebrow,
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  /** Pieni yläotsikko otsikon yläpuolella (esim. "Tämä viikko"). */
  eyebrow?: string;
}) {
  return (
    <section className={`card p-4 sm:p-5 lg:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{eyebrow}</div>}
            {title && <h2 className="font-display text-lg font-semibold leading-tight text-slate-900">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'soft';

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-green-700 text-white shadow-[0_1px_0_rgb(255_255_255/0.12)_inset,0_6px_16px_-6px_rgb(var(--accent-rgb)/0.55)] hover:bg-green-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none',
  secondary: 'bg-[var(--surface-raised)] text-slate-900 shadow-xs ring-1 ring-slate-200 hover:bg-slate-100',
  ghost: 'text-green-800 hover:bg-green-50',
  soft: 'bg-green-100 text-green-900 hover:bg-green-200',
};

export function Button({
  variant = 'primary',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`press inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed ${VARIANT[variant]} ${className}`}
      {...rest}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-relaxed text-slate-500">{hint}</span>}
    </label>
  );
}

/** Yhtenäinen tekstikenttä: upotettu pinta, fokuksessa nostettu pinta ja metsänvihreä rengas. */
export const inputClass =
  'block w-full min-h-11 rounded-xl border-0 bg-[var(--surface-sunk)] px-3.5 text-base text-slate-900 shadow-[inset_0_0_0_1px_var(--line)] transition-[box-shadow,background-color] placeholder:text-slate-400 focus:bg-[var(--surface-raised)] focus:shadow-[inset_0_0_0_1.5px_var(--focus),0_0_0_4px_color-mix(in_oklab,var(--focus)_18%,transparent)] focus:outline-none';

/** Merkintä tehomallin tuottamille luvuille (SPEC 5, D4). */
export function EstimateBadge() {
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-amber-900" title="Sovelluksen oma arvio, ei virallinen luku">
      arvio
    </span>
  );
}

/** Tyhjä tila: ikoni, otsikko ja ohje (sekä valinnainen toiminto). */
export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      {icon && <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-green-100 text-green-800">{icon}</div>}
      <div className="font-display text-base font-semibold text-slate-900">{title}</div>
      {children && <div className="mt-1 max-w-sm text-sm text-slate-600">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Pieni otsikkorivi korttien sisällä ja osioiden välissä. */
export function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h3 className={`text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 ${className}`}>{children}</h3>;
}
