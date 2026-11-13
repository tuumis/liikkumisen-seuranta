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

/** Kuvahaun osoite seuran logolle (avataan selaimessa käyttäjän painalluksesta; sovellus ei itse hae mitään). */
export function logoSearchUrl(teamName: string): string {
  const club = parseTeamName(teamName).club || teamName.trim();
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${club} jalkapallo logo`)}`;
}

const btn = 'press min-h-11 rounded-xl bg-[var(--surface-raised)] px-3 text-sm font-semibold text-slate-800 shadow-xs ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50';

/**
 * Logon valinta: tiedosto, leikepöytä (Liitä kuva / Ctrl+V) tai raahaus. Kuva pienennetään
 * laitteella kokonaisena (ei rajausta). "Hae logo" avaa kuvahaun selaimeen uuteen välilehteen.
 */
export function LogoPicker({
  name,
  value,
  onChange,
  label = 'Seuran logo',
  hideCompactLogo,
}: {
  name: string;
  value?: string;
  onChange: (logo: string | undefined) => void;
  label?: string;
  /** Tiivis tila ilman logoa (logo näkyy jo muualla näkymässä). */
  hideCompactLogo?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const zone = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [hint, setHint] = useState<string>();
  const [over, setOver] = useState(false);
  // Kun logo on jo annettu, valinta on piilossa painikkeen takana (vähemmän tilaa ja ohjetekstiä).
  const [open, setOpen] = useState(!value);
  const canRead = typeof navigator !== 'undefined' && typeof navigator.clipboard?.read === 'function';
  const hasName = !!parseTeamName(name).club;

  async function pick(file: Blob | undefined | null) {
    if (!file) return;
    setBusy(true);
    setError(undefined);
    setHint(undefined);
    try {
      onChange(await resizeLogo(file));
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  const NO_IMAGE = 'Leikepöydällä ei ole kuvaa. Valitse kuvan kohdalla "Kopioi kuva" (ei "Kopioi kuvan osoite") ja liitä uudelleen.';

  async function pasteFromClipboard() {
    setError(undefined);
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type) return void (await pick(await item.getType(type)));
      }
      setError(NO_IMAGE);
    } catch {
      // Lupa evätty tai selain ei salli: tavallinen liittäminen (Ctrl+V / pitkä painallus) toimii.
      setHint('Selain ei antanut lukea leikepöytää. Napauta logoaluetta ja liitä kuva (Ctrl+V tai pitkä painallus → Liitä).');
      zone.current?.focus();
    }
  }

  const fromTransfer = (dt: DataTransfer | null): File | undefined => [...(dt?.files ?? [])].find((f) => f.type.startsWith('image/'));

  if (value && !open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        {!hideCompactLogo && <TeamLogo logo={value} name={name} size="md" />}
        <span className="min-w-0 flex-1 text-sm font-medium text-slate-700">{label} annettu</span>
        <button type="button" onClick={() => setOpen(true)} className={btn}>
          Vaihda logo
        </button>
      </div>
    );
  }

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label} (valinnainen)</span>
      <div
        ref={zone}
        tabIndex={-1}
        className={`flex flex-wrap items-center gap-3 rounded-2xl p-1 outline-none transition-[box-shadow,background-color] focus-visible:ring-2 focus-visible:ring-[var(--focus)] ${over ? 'bg-[color-mix(in_oklab,var(--focus)_12%,transparent)] ring-2 ring-[var(--focus)]' : ''}`}
        onPaste={(e) => {
          const f = fromTransfer(e.clipboardData);
          if (f) {
            e.preventDefault();
            void pick(f);
          } else if (e.clipboardData?.types.length) setError(NO_IMAGE);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = fromTransfer(e.dataTransfer);
          if (f) void pick(f);
          else setError('Raahattu kohde ei ollut kuvatiedosto. Kopioi kuva ja käytä "Liitä kuva" tai tallenna kuva ensin laitteelle.');
        }}
      >
        <TeamLogo logo={value} name={name} size="lg" />
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          {hasName && (
            <a href={logoSearchUrl(name)} target="_blank" rel="noopener noreferrer" className={`${btn} inline-flex items-center`}>
              Hae logo ↗
            </a>
          )}
          {canRead && (
            <button type="button" disabled={busy} onClick={() => void pasteFromClipboard()} className={btn}>
              Liitä kuva
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className={btn}>
            {busy ? 'Käsitellään…' : value ? 'Vaihda tiedostosta' : 'Valitse tiedosto'}
          </button>
          {value && (
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-[var(--surface-sunk)]">
              Valmis
            </button>
          )}
          {value && (
            <button type="button" onClick={() => onChange(undefined)} className="min-h-11 rounded-xl px-3 text-sm font-medium text-red-700 hover:bg-red-50">
              Poista logo
            </button>
          )}
        </div>
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} aria-label={`${label}: valitse tiedosto`} />
      </div>
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
      {hint && !error && <p className="mt-1 text-sm text-slate-700">{hint}</p>}
      <p className="mt-1 text-xs text-slate-500">
        {hasName ? '"Hae logo" avaa kuvahaun selaimeen. Kopioi sieltä kuva ("Kopioi kuva") ja paina "Liitä kuva", tai raahaa kuvatiedosto tähän. ' : ''}
        Logo näytetään kokonaisena. Kuva pienennetään ja tallennetaan vain omille laitteillesi ja varmuuskopioihin.
      </p>
    </div>
  );
}
