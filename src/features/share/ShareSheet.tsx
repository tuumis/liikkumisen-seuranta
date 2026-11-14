// Jakokuvan yhteinen paneeli (tuloskuva ja otteluennakko): esikatselu, muoto, tyyli, väri sekä
// jako tai tallennus. Väri muistetaan oman joukkueen seuralle (synkronoituu); muoto ja tyyli laitteelle.
// Kuva syntyy laitteella; mitään ei lähetetä ennen kuin käyttäjä valitsee "Jaa".

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { repo } from '../../db/repositories';
import { Button } from '../../ui/components';
import { Segmented } from '../../ui/controls';
import { Sheet } from '../../ui/Sheet';
import { clubFor, clubNameOf, useClubs } from '../../ui/TeamLogo';
import { useToast } from '../../ui/Toast';
import type { ShareSize, ShareStyle } from './drawResult';
import { isHexColor, isLightColor, mix, SHARE_COLORS } from './shareColors';

const PREFS = 'resultSharePrefs';
type Prefs = { size: ShareSize; style: ShareStyle };
function readPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) ?? '{}') as Partial<Prefs>;
    return { size: p.size === 'post' ? 'post' : 'story', style: p.style === 'sport' ? 'sport' : 'theme' };
  } catch {
    return { size: 'story', style: 'theme' };
  }
}

export interface RenderOptions extends Prefs {
  color?: string;
}

export function ShareImageSheet({
  open,
  onClose,
  title,
  alt,
  teamName,
  render,
  renderKey,
  fileName,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  alt: string;
  /** Oma joukkue: väri muistetaan sen seuralle. */
  teamName?: string;
  /** Piirto; undefined = ei vielä tietoja (tai ei kuvaa). */
  render?: (o: RenderOptions) => Promise<HTMLCanvasElement | undefined>;
  /** Piirron riippuvuudet merkkijonona (tiedot, logot). */
  renderKey: string;
  fileName: string;
  /** Lisävalinnat ja huomautukset (esim. lapsen nimi). */
  children?: ReactNode;
}) {
  const toast = useToast();
  const clubs = useClubs();
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const saved = clubFor(clubs, teamName)?.shareColor;
  const [color, setColor] = useState<string | undefined>(saved);
  const [src, setSrc] = useState<string>();
  const canvas = useRef<HTMLCanvasElement | null>(null);

  // Joukkueen tallennettu väri, kun paneeli avataan tai tieto tulee synkronoinnista.
  useEffect(() => setColor(saved), [saved, teamName, open]);

  const setPref = (patch: Partial<Prefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(PREFS, JSON.stringify(next));
      } catch {
        /* ei muistia */
      }
      return next;
    });

  // Oma väri muuttuu valitsinta vedettäessä jatkuvasti: tallennus vasta, kun valinta on hetken paikallaan.
  const saveTimer = useRef<number | undefined>(undefined);
  function pickColor(v: string | undefined) {
    setColor(v);
    const club = clubNameOf(teamName);
    if (!club) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      repo.saveClub(club, { shareColor: v }).catch((e: unknown) => toast(e instanceof Error ? e.message : String(e)));
    }, 500);
  }
  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  useEffect(() => {
    if (!open || !render) return;
    let cancelled = false;
    void (async () => {
      await document.fonts?.ready;
      const c = await render({ ...prefs, color });
      if (cancelled || !c) return;
      canvas.current = c;
      setSrc(c.toDataURL('image/png'));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, renderKey, prefs.size, prefs.style, color, !!render]);

  useEffect(() => {
    if (!open) {
      setSrc(undefined);
      canvas.current = null;
    }
  }, [open]);

  const blob = () => new Promise<Blob | null>((res) => (canvas.current ? canvas.current.toBlob(res, 'image/png') : res(null)));
  async function save() {
    const b = await blob();
    if (!b) return;
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Kuva tallennettu', undefined, 'success');
  }
  async function share() {
    const b = await blob();
    if (!b) return;
    const file = new File([b], fileName, { type: 'image/png' });
    if (!navigator.canShare?.({ files: [file] })) return save();
    try {
      await navigator.share({ files: [file] });
    } catch {
      /* peruttu */
    }
  }
  const canShare = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {render ? (
        <div className="space-y-4">
          <div className="flex justify-center rounded-2xl bg-[var(--surface-sunk)] p-3">
            {src ? (
              <img src={src} alt={alt} className={`h-auto w-auto rounded-xl shadow-lg ${prefs.size === 'story' ? 'max-h-[52dvh]' : 'max-h-[46dvh]'} max-w-full`} />
            ) : (
              <div className={`${prefs.size === 'story' ? 'aspect-[9/16]' : 'aspect-[4/5]'} h-[40dvh] animate-pulse rounded-xl bg-slate-200`} />
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Segmented<ShareSize>
              label="Kuvan muoto"
              value={prefs.size}
              onChange={(size) => setPref({ size })}
              options={[
                { value: 'story', label: 'Tarina 9:16' },
                { value: 'post', label: 'Julkaisu 4:5' },
              ]}
            />
            <Segmented<ShareStyle>
              label="Kuvan tyyli"
              value={prefs.style}
              onChange={(style) => setPref({ style })}
              options={[
                { value: 'theme', label: 'Pehmeä' },
                { value: 'sport', label: 'Urheilu' },
              ]}
            />
          </div>
          <ColorPicker value={color} onChange={pickColor} team={clubNameOf(teamName)} />
          {children}
          <div className="flex gap-2">
            {canShare && (
              <Button className="flex-1" onClick={() => void share()} disabled={!src}>
                Jaa
              </Button>
            )}
            <Button variant="secondary" className={canShare ? '' : 'flex-1'} onClick={() => void save()} disabled={!src}>
              Tallenna kuva
            </Button>
          </div>
        </div>
      ) : (
        children
      )}
    </Sheet>
  );
}

const swatch = 'press relative flex size-10 shrink-0 items-center justify-center rounded-full ring-1 ring-black/15';

/** Väriteemat pyöreinä näytteinä ja oma väri (selaimen värivalitsin). */
function ColorPicker({ value, onChange, team }: { value: string | undefined; onChange: (v: string | undefined) => void; team?: string }) {
  const own = isHexColor(value) ? value : undefined;
  const sel = (on: boolean) => (on ? 'outline outline-2 outline-offset-2 outline-[var(--focus)]' : '');
  const check = (base: string) => (
    <span aria-hidden className={`text-sm font-bold ${isLightColor(base) ? 'text-slate-900' : 'text-white'}`}>
      ✓
    </span>
  );
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-slate-700">Väri</span>
        {team && <span className="truncate text-xs text-slate-500">Muistetaan joukkueelle {team}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Kuvan väri">
        <button
          type="button"
          role="radio"
          aria-checked={!value}
          aria-label="Sovelluksen värit"
          title="Sovelluksen värit"
          onClick={() => onChange(undefined)}
          className={`${swatch} ${sel(!value)} bg-[linear-gradient(135deg,var(--hero-from),var(--hero-to))]`}
        >
          {!value ? check('#1a3a2d') : <span className="text-[10px] font-semibold text-white/90">Aa</span>}
        </button>
        {SHARE_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={value === c.id}
            aria-label={c.label}
            title={c.label}
            onClick={() => onChange(c.id)}
            className={`${swatch} ${sel(value === c.id)}`}
            style={{ background: `linear-gradient(135deg, ${c.base} 0 62%, ${c.accent ?? mix(c.base, '#ffffff', 0.6)} 62%)` }}
          >
            {value === c.id && check(c.base)}
          </button>
        ))}
        <label
          className={`${swatch} ${sel(!!own)} cursor-pointer overflow-hidden ${own ? '' : 'bg-[conic-gradient(#ef4444,#f59e0b,#84cc16,#06b6d4,#6366f1,#d946ef,#ef4444)]'}`}
          style={own ? { background: own } : undefined}
          title="Oma väri"
        >
          {own ? check(own) : <span className="rounded-full bg-white/85 px-1 text-[10px] font-bold text-slate-800">+</span>}
          <input type="color" className="absolute inset-0 size-full cursor-pointer opacity-0" value={own ?? '#1d4ed8'} onChange={(e) => onChange(e.target.value)} aria-label="Oma väri" />
        </label>
      </div>
    </div>
  );
}
