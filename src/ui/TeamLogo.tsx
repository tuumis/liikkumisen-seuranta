// Seuran logo tai joukkuekuva pyöristetyssä neliössä (SPEC 16): logo näytetään kokonaisena
// (object-contain) vaalealla pohjalla, joten tekstilliset logot eivät jää piiloon.

import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { clubKey, parseTeamName } from '../domain/opponent';
import { repo } from '../db/repositories';
import { isPhotoDataUrl, resizeLogo } from './image';

const SIZES = {
  sm: 'size-8 rounded-lg text-xs',
  md: 'size-12 rounded-xl text-sm',
  lg: 'size-16 rounded-2xl text-lg',
  xl: 'size-24 rounded-[1.4rem] text-2xl',
} as const;
type Size = keyof typeof SIZES;

/** Seurojen logot nimen avaimella (kaikki seurat kerralla; elää tietokannan mukana). */
export function useClubLogos(): Map<string, string> {
  const clubs = useLiveQuery(() => repo.listClubs(), []);
  const map = new Map<string, string>();
  for (const c of clubs ?? []) if (c.logo) map.set(clubKey(c.name), c.logo);
  return map;
}

/** Joukkueen tai vastustajan nimen seuran logo. */
export function logoFor(logos: Map<string, string>, teamName: string | undefined): string | undefined {
  const club = parseTeamName(teamName).club;
  return club ? logos.get(clubKey(club)) : undefined;
}

export function TeamLogo({ logo, name, size = 'md', fallback = '👕', className = '' }: { logo?: string; name?: string; size?: Size; fallback?: string; className?: string }) {
  const base = `${SIZES[size]} shrink-0 overflow-hidden ring-1 ring-slate-200/80 ${className}`;
  if (isPhotoDataUrl(logo))
    return (
      <span className={`${base} inline-flex items-center justify-center bg-white`} aria-hidden>
        <img src={logo} alt="" className="size-[86%] object-contain" />
      </span>
    );
  return (
    <span className={`${base} inline-flex items-center justify-center bg-[var(--surface-sunk)] font-semibold text-slate-600`} aria-hidden>
      {name?.trim() ? (parseTeamName(name).club[0] ?? fallback).toUpperCase() : fallback}
    </span>
  );
}

/** Logon valinta: kuva pienennetään laitteella kokonaisena (ei rajausta). */
export function LogoPicker({ name, value, onChange, label = 'Seuran logo' }: { name: string; value?: string; onChange: (logo: string | undefined) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(undefined);
    try {
      onChange(await resizeLogo(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label} (valinnainen)</span>
      <div className="flex items-center gap-3">
        <TeamLogo logo={value} name={name} size="lg" />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="press min-h-11 rounded-xl bg-[var(--surface-raised)] px-3 text-sm font-semibold text-slate-800 shadow-xs ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50"
          >
            {busy ? 'Käsitellään…' : value ? 'Vaihda logo' : 'Lisää logo'}
          </button>
          {value && (
            <button type="button" onClick={() => onChange(undefined)} className="min-h-11 rounded-xl px-3 text-sm font-medium text-red-700 hover:bg-red-50">
              Poista logo
            </button>
          )}
        </div>
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} aria-label={`${label}: valitse tiedosto`} />
      </div>
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
      <p className="mt-1 text-xs text-slate-500">Logo näytetään kokonaisena. Kuva pienennetään ja tallennetaan vain omille laitteillesi ja varmuuskopioihin.</p>
    </div>
  );
}
