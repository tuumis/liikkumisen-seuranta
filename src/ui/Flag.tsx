// Maalippu SVG:nä (ks. flags.ts) ja maan valinta (14.11.2026).

import { COUNTRIES, countryOf, FLAG_VIEWBOX } from './flags';
import type { Club } from '../domain/types';
import { inputClass } from './components';

export function Flag({ code, className = 'h-3.5', title }: { code: string | undefined; className?: string; title?: string }) {
  const c = countryOf(code);
  if (!c) return null;
  return (
    <svg viewBox={FLAG_VIEWBOX} className={`inline-block aspect-[3/2] shrink-0 rounded-[2px] align-[-0.15em] ring-1 ring-black/15 ${className}`} role="img" aria-label={title ?? c.name}>
      {c.shapes.map((s, i) =>
        'r' in s ? (
          <rect key={i} x={s.r[0]} y={s.r[1]} width={s.r[2]} height={s.r[3]} fill={s.c} />
        ) : 'o' in s ? (
          <circle key={i} cx={s.o[0]} cy={s.o[1]} r={s.o[2]} fill={s.c} />
        ) : (
          <polygon key={i} points={s.p.join(' ')} fill={s.c} />
        ),
      )}
    </svg>
  );
}

/** Maan valinta: lippu valinnan vieressä (valikon riveissä ei voi näyttää kuvaa). */
export function CountrySelect({ value, onChange, label = 'Maa' }: { value: string | undefined; onChange: (code: string | undefined) => void; label?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex w-8 shrink-0 justify-center">{value ? <Flag code={value} className="h-5" /> : <span className="text-slate-400">–</span>}</span>
      <select className={inputClass} value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} aria-label={label}>
        <option value="">Ei valittu</option>
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Seuran lippu ja kotipaikkakunta pienellä (tyhjä, jos kumpaakaan ei ole). */
export function ClubOrigin({ club, className = '' }: { club: Pick<Club, 'country' | 'city'> | undefined; className?: string }) {
  if (!club?.country && !club?.city) return null;
  return (
    <span className={`inline-flex min-w-0 items-center gap-1 ${className}`}>
      <Flag code={club.country} className="h-3" />
      {club.city && <span className="truncate">{club.city}</span>}
    </span>
  );
}

/** Seuran kotimaa ja paikkakunta (seurakohtaiset: näkyvät kaikissa seuran joukkueissa ja kuvissa). */
export function OriginFields({
  country,
  city,
  onCountry,
  onCity,
  onCityDone,
}: {
  country: string | undefined;
  city: string;
  onCountry: (code: string | undefined) => void;
  onCity: (city: string) => void;
  /** Paikkakunnan kentästä poistuttaessa (esim. tallennus heti). */
  onCityDone?: (city: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Maa</span>
        <CountrySelect value={country} onChange={onCountry} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Kotipaikkakunta</span>
        <input
          className={inputClass}
          value={city}
          maxLength={60}
          placeholder="esim. Espoo"
          onChange={(e) => onCity(e.target.value)}
          onBlur={(e) => onCityDone?.(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onCityDone) {
              e.preventDefault();
              onCityDone(e.currentTarget.value);
            }
          }}
        />
      </label>
    </div>
  );
}
