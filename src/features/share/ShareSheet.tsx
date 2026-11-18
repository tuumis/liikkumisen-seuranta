// Jakokuvan yhteinen paneeli (tuloskuva ja otteluennakko): esikatselu, muoto, tyyli, väri sekä
// jako tai tallennus. Väri muistetaan oman joukkueen seuralle (synkronoituu); muoto ja tyyli laitteelle.
// Kuva syntyy laitteella; mitään ei lähetetä ennen kuin käyttäjä valitsee "Jaa".

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { clubKey } from '../../domain/opponent';
import type { Team, UUID } from '../../domain/types';
import { repo } from '../../db/repositories';
import { db } from '../../db/schema';
import { OriginFields } from '../../ui/Flag';
import { Button } from '../../ui/components';
import { Segmented, ToggleChip } from '../../ui/controls';
import { hasTeamDetails, SHOW_ALL_DETAILS, type TeamDetailPrefs } from '../../domain/shareNames';
import { Sheet } from '../../ui/Sheet';
import { clubFor, clubNameOf, useClubs } from '../../ui/TeamLogo';
import { useToast } from '../../ui/Toast';
import { isShareStyle, SHARE_STYLE_LABEL, type LayerMark, type ShareSize, type ShareStyle } from './drawResult';
import { isHexColor, isLightColor, mix, SHARE_COLORS } from './shareColors';
import { useVideoShare } from './VideoShare';
import { IconCheck } from '../../ui/icons';

const PREFS = 'resultSharePrefs';
type Prefs = { size: ShareSize; style: ShareStyle };
const DEFAULT_STYLES: readonly ShareStyle[] = ['theme', 'sport'];
function readPrefs(key: string, styles: readonly ShareStyle[]): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(key) ?? '{}') as Partial<Prefs>;
    return { size: p.size === 'post' ? 'post' : 'story', style: isShareStyle(p.style) && styles.includes(p.style) ? p.style : 'theme' };
  } catch {
    return { size: 'story', style: 'theme' };
  }
}

export interface RenderOptions extends Prefs {
  color?: string;
  /** Videon kerrokset (vain ennakkovideossa). */
  mark?: LayerMark;
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
  styles = DEFAULT_STYLES,
  prefsKey = PREFS,
  video = false,
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
  /** Tarjottavat tyylit (ennakkokuvassa enemmän kuin tuloskuvassa). */
  styles?: readonly ShareStyle[];
  /** Muodon ja tyylin muistipaikka laitteella. */
  prefsKey?: string;
  /** Kuva | Video -valinta (otteluennakko, 19.11.2026); kuva on aina oletus. */
  video?: boolean;
}) {
  const toast = useToast();
  const clubs = useClubs();
  const [prefs, setPrefs] = useState<Prefs>(() => readPrefs(prefsKey, styles));
  const saved = clubFor(clubs, teamName)?.shareColor;
  const [color, setColor] = useState<string | undefined>(saved);
  const [src, setSrc] = useState<string>();
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [media, setMedia] = useState<'image' | 'video'>('image');
  const vid = useVideoShare({
    active: open && video && media === 'video',
    render,
    options: { ...prefs, color },
    deps: `${renderKey}|${prefs.size}|${prefs.style}|${color ?? ''}`,
    fileName,
    alt,
  });
  useEffect(() => {
    if (!open) setMedia('image');
  }, [open]);
  const isVideo = video && media === 'video';

  // Joukkueen tallennettu väri, kun paneeli avataan tai tieto tulee synkronoinnista.
  useEffect(() => setColor(saved), [saved, teamName, open]);

  const setPref = (patch: Partial<Prefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(prefsKey, JSON.stringify(next));
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
          {video && (
            <Segmented<'image' | 'video'>
              label="Jaa kuvana tai videona"
              value={media}
              onChange={setMedia}
              options={[
                { value: 'image', label: 'Kuva' },
                { value: 'video', label: 'Video' },
              ]}
            />
          )}
          <div className="flex justify-center rounded-2xl bg-[var(--surface-sunk)] p-3">
            {isVideo ? (
              vid.preview
            ) : src ? (
              <img src={src} alt={alt} className={`h-auto w-auto rounded-xl shadow-lg ${prefs.size === 'story' ? 'max-h-[52dvh]' : 'max-h-[46dvh]'} max-w-full`} />
            ) : (
              <div className={`${prefs.size === 'story' ? 'aspect-[9/16]' : 'aspect-[4/5]'} h-[40dvh] animate-pulse rounded-xl bg-slate-200`} />
            )}
          </div>
          {styles.length > 2 ? (
            <>
              <Segmented<ShareSize>
                label="Kuvan muoto"
                value={prefs.size}
                onChange={(size) => setPref({ size })}
                options={[
                  { value: 'story', label: 'Tarina 9:16' },
                  { value: 'post', label: 'Julkaisu 4:5' },
                ]}
              />
              <StylePicker styles={styles} value={prefs.style} onChange={(style) => setPref({ style })} />
            </>
          ) : (
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
              <Segmented<ShareStyle> label="Kuvan tyyli" value={prefs.style} onChange={(style) => setPref({ style })} options={styles.map((v) => ({ value: v, label: SHARE_STYLE_LABEL[v] }))} />
            </div>
          )}
          <ColorPicker value={color} onChange={pickColor} team={clubNameOf(teamName)} />
          {children}
          {isVideo ? (
            vid.actions
          ) : (
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
          )}
        </div>
      ) : (
        children
      )}
    </Sheet>
  );
}

/** Tyylit pieninä näytteinä (6 tyyliä ei mahdu yhteen segmenttiriviin puhelimella). */
const STYLE_SAMPLE: Record<ShareStyle, string> = {
  theme: 'linear-gradient(135deg,var(--hero-from),var(--hero-to))',
  sport: 'repeating-linear-gradient(-24deg,#0b1220 0 9px,#141e33 9px 14px)',
  field: 'repeating-linear-gradient(180deg,#2d6a31 0 7px,#367a3a 7px 14px)',
  poster: 'linear-gradient(135deg,#b42318 0 58%,#facc15 58% 70%,#b42318 70%)',
  clean: 'linear-gradient(180deg,#1f5137 0 5px,#f4f7f5 5px)',
  scoreboard: 'radial-gradient(circle,#fbbf24 1.2px,transparent 1.6px) 0 0/7px 7px,#0b0b0c',
};

function StylePicker({ styles, value, onChange }: { styles: readonly ShareStyle[]; value: ShareStyle; onChange: (v: ShareStyle) => void }) {
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium text-slate-700">Kuvan tyyli</div>
      <div role="radiogroup" aria-label="Kuvan tyyli" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {styles.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={value === s}
            onClick={() => onChange(s)}
            className={`press flex min-h-11 flex-col items-center gap-1 rounded-xl p-1.5 text-xs font-semibold ${value === s ? 'bg-[var(--surface-raised)] text-slate-900 outline outline-2 outline-[var(--focus)]' : 'bg-[var(--surface-sunk)] text-slate-600 hover:text-slate-900'}`}
          >
            <span aria-hidden className="h-6 w-full rounded-md ring-1 ring-black/10" style={{ background: STYLE_SAMPLE[s] }} />
            {SHARE_STYLE_LABEL[s]}
          </button>
        ))}
      </div>
    </div>
  );
}

const swatch = 'press relative flex size-10 shrink-0 items-center justify-center rounded-full ring-1 ring-black/15';

/** Väriteemat pyöreinä näytteinä ja oma väri (selaimen värivalitsin). */
function ColorPicker({ value, onChange, team }: { value: string | undefined; onChange: (v: string | undefined) => void; team?: string }) {
  const own = isHexColor(value) ? value : undefined;
  const sel = (on: boolean) => (on ? 'outline outline-2 outline-offset-2 outline-[var(--focus)]' : '');
  const check = (base: string) => (
    <span aria-hidden className={`text-sm font-bold ${isLightColor(base) ? 'text-slate-900' : 'text-white'}`}>
      <IconCheck size="1rem" strokeWidth={3} />
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

/**
 * Oma joukkue kuvaa varten: tapahtuman joukkue tai profiilin joukkue samalla nimellä. Joukkueen oma kuva
 * (`Team.photo`) on logon varalla: vanhemmissa joukkueissa logo on tallennettu joukkueen kuvaksi.
 */
export async function findOwnTeam(profileId: UUID, teamId: UUID | undefined, name: string | undefined): Promise<Team | undefined> {
  const byId = teamId ? await db.teams.get(teamId) : undefined;
  if (byId && !byId.deletedAt) return byId;
  if (!name?.trim()) return undefined;
  const key = clubKey(name);
  return (await repo.listTeams(profileId, { includeArchived: true })).find((t) => clubKey(t.name) === key);
}

/**
 * Puuttuvat tiedot jakopaneelissa: oman joukkueen maa ja kotipaikkakunta annetaan suoraan tässä
 * (tallentuvat seuralle kuten Joukkueet-kohdassa); logot ja vastustajien tiedot Joukkueet-kohdassa.
 */
export function MissingTeamInfo({ teamName, teamLogo, opponentsMissing }: { teamName?: string; teamLogo: boolean; opponentsMissing: number }) {
  const toast = useToast();
  const clubs = useClubs();
  const club = clubNameOf(teamName);
  const info = clubFor(clubs, teamName);
  const [city, setCity] = useState(info?.city ?? '');
  useEffect(() => setCity(info?.city ?? ''), [info?.city]);
  // Kenttä pysyy näkyvissä, kunnes paneeli suljetaan (ei katoa kesken kirjoittamisen).
  const [needOrigin] = useState(() => !!club && (!info?.country || !info?.city));
  const save = (patch: { country?: string; city?: string }) => {
    if (!club) return;
    if ('city' in patch && (patch.city ?? '').trim() === (info?.city ?? '')) return;
    repo.saveClub(club, patch).catch((e: unknown) => toast(e instanceof Error ? e.message : String(e)));
  };
  const notes: string[] = [];
  if (club && !teamLogo) notes.push(`${club}: logo puuttuu, joten kuvassa näkyvät nimikirjaimet. Logo lisätään Jalkapallo → Joukkueet → Omat joukkueet.`);
  if (opponentsMissing > 0)
    notes.push(`${opponentsMissing} vastustajalta puuttuu logo, maa tai paikkakunta. Ne lisätään Jalkapallo → Joukkueet → Vastustajat.`);
  if (!needOrigin && !notes.length) return null;
  return (
    <div className="space-y-2">
      {needOrigin && (
        <div className="space-y-2 rounded-2xl bg-[var(--surface-sunk)] p-3">
          <div className="text-sm font-medium text-slate-800">{club}: maa ja kotipaikkakunta kuvaan</div>
          <OriginFields country={info?.country} city={city} onCountry={(v) => save({ country: v })} onCity={setCity} onCityDone={(v) => save({ city: v })} />
        </div>
      )}
      {notes.map((n) => (
        <p key={n} className="text-xs text-slate-500">
          {n}
        </p>
      ))}
    </div>
  );
}

// ---------- ryhmä ja ikäluokka kuvassa (17.11.2026) ----------

const DETAILS_KEY = 'shareTeamDetails';
function readDetailPrefs(): TeamDetailPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(DETAILS_KEY) ?? 'null') as Partial<TeamDetailPrefs> | null;
    return { team: v?.team !== false, opponents: v?.opponents !== false };
  } catch {
    return SHOW_ALL_DETAILS;
  }
}

/** Valinta muistetaan laitteelle, ja se on yhteinen ennakko- ja tuloskuville. Oletus: kaikki näkyvissä. */
export function useTeamDetailPrefs(): [TeamDetailPrefs, (next: TeamDetailPrefs) => void] {
  const [prefs, setPrefs] = useState<TeamDetailPrefs>(readDetailPrefs);
  const update = (next: TeamDetailPrefs) => {
    setPrefs(next);
    try {
      localStorage.setItem(DETAILS_KEY, JSON.stringify(next));
    } catch {
      /* ei muistia */
    }
  };
  return [prefs, update];
}

/** Oma valinta omalle joukkueelle ja vastustajille; näytetään vain, kun nimissä on ryhmä tai ikäluokka. */
export function TeamDetailChips({ team, opponents, prefs, onChange }: { team?: string; opponents: (string | undefined)[]; prefs: TeamDetailPrefs; onChange: (next: TeamDetailPrefs) => void }) {
  const ownHas = hasTeamDetails(team);
  const oppHas = opponents.some(hasTeamDetails);
  if (!ownHas && !oppHas) return null;
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium text-slate-700">Ryhmä ja ikäluokka kuvassa</div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Ryhmä ja ikäluokka kuvassa">
        {ownHas && (
          <ToggleChip on={prefs.team} onChange={(on) => onChange({ ...prefs, team: on })}>
            Oma joukkue
          </ToggleChip>
        )}
        {oppHas && (
          <ToggleChip on={prefs.opponents} onChange={(on) => onChange({ ...prefs, opponents: on })}>
            {opponents.filter(Boolean).length > 1 ? 'Vastustajat' : 'Vastustaja'}
          </ToggleChip>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">Pois valittuna kuvassa näkyy pelkkä seura. Tallennettu nimi ei muutu.</p>
    </div>
  );
}

/** Laitteelle muistettava kyllä/ei-valinta jakokuviin (18.11.2026): yhteinen ennakko- ja tuloskuville. */
export { useStoredFlag } from '../../ui/storedPref';

/** Kuvan lisävalinnat: kommentin harmaa tausta ja koti/vieras-merkinnät (vain kun tietoa on). */
export function ShareExtrasChips({ hasComment, hasHomeAway, panel, onPanel, homeAway, onHomeAway }: { hasComment: boolean; hasHomeAway: boolean; panel: boolean; onPanel: (v: boolean) => void; homeAway: boolean; onHomeAway: (v: boolean) => void }) {
  if (!hasComment && !hasHomeAway) return null;
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Kuvan lisävalinnat">
      {hasComment && (
        <ToggleChip on={panel} onChange={onPanel}>
          Kommentti harmaalla taustalla
        </ToggleChip>
      )}
      {hasHomeAway && (
        <ToggleChip on={homeAway} onChange={onHomeAway}>
          Koti/vieras
        </ToggleChip>
      )}
    </div>
  );
}
