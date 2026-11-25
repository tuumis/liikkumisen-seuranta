// Sekuntikello (25.11.2026): käynnissä olevat kellot näkyvät aina (puhelimessa yläpalkissa, PC:llä
// sivupalkissa). Lopeta pysäyttää kellon ja avaa kirjauksen, jossa kesto on valmiina; jos kirjauksen
// sulkee tallentamatta, kello jää tauolle eikä aika katoa.

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { repo } from '../../db/repositories';
import { elapsedSec, formatClock, formatTimed, isPaused, pauseStopwatch, resumeStopwatch, timedMinutes, type Stopwatch } from '../../domain/stopwatch';
import { today } from '../../ui/today';
import { useToast } from '../../ui/Toast';
import { playSound } from '../../ui/sound';
import type { Profile } from '../../domain/types';
import { Avatar } from '../../ui/Avatar';
import { IconClock, IconClose, IconPause, IconPlay } from '../../ui/icons';
import { TypeGlyph } from '../../ui/TypeGlyph';
import { QuickAdd } from '../quick-add/QuickAdd';

const SAVE_EVENT = 'stopwatch-save';

/** Avaa kellon kirjauksen (yksi kirjauspaneeli koko sovelluksessa, StopwatchHost). */
function requestSave(profileId: string) {
  window.dispatchEvent(new CustomEvent(SAVE_EVENT, { detail: profileId }));
}

export function useStopwatches(): Stopwatch[] {
  return useLiveQuery(() => repo.listStopwatches(), []) ?? [];
}

/** Nykyhetki sekunnin välein, kun jokin kello käy (myös heti näkymään palatessa). */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [active]);
  return active ? now : Date.now();
}

function StopwatchRow({ sw, profile, showName, now, variant }: { sw: Stopwatch; profile?: Profile; showName: boolean; now: number; variant: 'header' | 'sidebar' }) {
  const type = useLiveQuery(() => (sw.activityTypeId ? repo.getActivityType(sw.activityTypeId).catch(() => undefined) : undefined), [sw.activityTypeId]);
  const [discarding, setDiscarding] = useState(false);
  const paused = isPaused(sw);
  const side = variant === 'sidebar';
  const title = type?.name ?? 'Kello';
  const btn = side
    ? 'press flex min-h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold'
    : 'press flex min-h-10 items-center justify-center gap-1.5 rounded-full px-3.5 text-sm font-semibold';
  const soft = side ? 'bg-white/10 text-[var(--side-ink)] hover:bg-white/15' : 'bg-[var(--surface-sunk)] text-slate-800 ring-1 ring-[var(--line)] hover:bg-slate-100';
  const strong = side ? 'bg-[var(--hero-accent)] text-[var(--side-from)] hover:brightness-105' : 'bg-green-700 text-white hover:bg-green-800';

  if (discarding) {
    return (
      <div className={side ? 'space-y-2' : 'flex flex-wrap items-center gap-2'}>
        <p className={`flex-1 text-sm ${side ? 'text-[var(--side-ink)]' : 'text-slate-800'}`}>Poistetaanko kello ({formatClock(elapsedSec(sw, now))})? Aikaa ei kirjata.</p>
        <div className="flex gap-2">
          <button type="button" className={`${btn} ${soft}`} onClick={() => setDiscarding(false)}>
            Peru
          </button>
          <button type="button" className={`${btn} bg-red-700 text-white hover:bg-red-800`} onClick={() => void repo.removeStopwatch(sw.profileId)}>
            Poista
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={side ? 'space-y-2.5' : 'flex items-center gap-2.5'}>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {showName && profile ? (
          <Avatar name={profile.name} photo={profile.photo} color={profile.color} size="sm" />
        ) : (
          <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-lg ${side ? 'bg-white/10' : 'bg-[var(--surface-sage)]'}`} aria-hidden>
            {type ? <TypeGlyph t={type} /> : <IconClock size="1.1rem" />}
          </span>
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <div className={`truncate text-xs font-semibold ${side ? 'text-[var(--side-ink-soft)]' : 'text-slate-600'}`}>
            {showName && profile ? `${profile.name} · ` : ''}
            {title}
            {paused ? ' · tauolla' : ''}
          </div>
          <div
            className={`stat text-xl font-bold tabular-nums ${paused ? (side ? 'text-[var(--side-ink-soft)]' : 'text-slate-500') : side ? 'text-[var(--side-ink)]' : 'text-slate-900'}`}
            role="timer"
            aria-label={`${title}: ${formatClock(elapsedSec(sw, now))}`}
          >
            {formatClock(elapsedSec(sw, now))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDiscarding(true)}
          className={`press hit flex size-8 shrink-0 items-center justify-center rounded-full ${side ? 'text-[var(--side-muted)] hover:bg-white/10 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
          aria-label="Poista kello"
        >
          <IconClose size="1rem" />
        </button>
      </div>
      <div className="flex shrink-0 gap-2">
        {paused ? (
          <button
            type="button"
            className={`${btn} ${soft} ${side ? 'flex-1' : 'w-10 px-0'}`}
            onClick={() => void repo.saveStopwatch(resumeStopwatch(sw, Date.now()))}
            aria-label="Jatka"
          >
            <IconPlay size="0.95rem" />
            {side && 'Jatka'}
          </button>
        ) : (
          <button
            type="button"
            className={`${btn} ${soft} ${side ? 'flex-1' : 'w-10 px-0'}`}
            onClick={() => void repo.saveStopwatch(pauseStopwatch(sw, Date.now()))}
            aria-label="Tauko"
          >
            <IconPause size="0.95rem" />
            {side && 'Tauko'}
          </button>
        )}
        <button
          type="button"
          className={`${btn} ${strong} ${side ? 'flex-1' : ''}`}
          onClick={async () => {
            if (!paused) await repo.saveStopwatch(pauseStopwatch(sw, Date.now()));
            requestSave(sw.profileId);
          }}
        >
          {paused ? 'Tallenna' : 'Lopeta'}
        </button>
      </div>
    </div>
  );
}

/** Käynnissä olevat kellot: puhelimen yläpalkki (header) tai PC:n sivupalkki (sidebar). */
export function StopwatchBar({ variant, profiles }: { variant: 'header' | 'sidebar'; profiles: Profile[] | null }) {
  const list = useStopwatches();
  const now = useNow(list.some((sw) => !isPaused(sw)));
  const visible = list.filter((sw) => profiles?.some((p) => p.id === sw.profileId));
  if (!visible.length) return null;
  const showName = (profiles?.length ?? 0) > 1;
  return (
    <section
      aria-label="Sekuntikello"
      className={
        variant === 'sidebar'
          ? 'space-y-3 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10'
          : 'mx-auto mt-2 max-w-xl space-y-2 rounded-2xl bg-[var(--surface)] p-2.5 shadow-sm ring-1 ring-[var(--line)] md:max-w-2xl'
      }
    >
      {visible.map((sw, i) => (
        <div key={sw.profileId} className={i > 0 ? (variant === 'sidebar' ? 'border-t border-white/10 pt-3' : 'border-t border-[var(--line)] pt-2') : ''}>
          <StopwatchRow sw={sw} profile={profiles?.find((p) => p.id === sw.profileId)} showName={showName} now={now} variant={variant} />
        </div>
      ))}
    </section>
  );
}

/**
 * Suunnitellun kerran kello (vaihe 2): Lopeta kuittaa kerran kellotetulla ajalla ilman lisäkysymyksiä.
 * Palauttaa false, jos kertaa ei voi kuitata (poistettu tai jo kuitattu); silloin aukeaa tavallinen kirjaus.
 */
async function confirmTimedPlan(sw: Stopwatch, toast: ReturnType<typeof useToast>): Promise<boolean> {
  if (!sw.plannedSessionId) return false;
  const sec = elapsedSec(sw, sw.pausedAt ?? Date.now());
  try {
    const r = await repo.confirmPlanned(sw.plannedSessionId, today(), { durationMin: timedMinutes(sec), timedSec: sec, startTime: sw.startTime });
    if (!r.created) return false;
    await repo.removeStopwatch(sw.profileId);
    playSound('confirm');
    const type = await repo.getActivityType(r.session.activityTypeId).catch(() => undefined);
    toast(
      `Kuitattu: ${r.session.label ?? type?.name ?? 'kerta'} ${r.session.durationMin} min (kellotettu ${formatTimed(sec)})`,
      {
        label: 'Kumoa',
        run: async () => {
          await repo.undoConfirm([r.session.id]);
          await repo.saveStopwatch(sw);
        },
      },
      'success',
    );
    return true;
  } catch {
    return false;
  }
}

/** Kellon kirjauspaneeli (yksi koko sovelluksessa): avautuu Lopeta- tai Tallenna-painikkeesta. */
export function StopwatchHost({ profiles }: { profiles: Profile[] | null }) {
  const list = useStopwatches();
  const toast = useToast();
  const [profileId, setProfileId] = useState<string | null>(null);
  useEffect(() => {
    const onSave = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      void (async () => {
        const sw = (await repo.listStopwatches()).find((x) => x.profileId === id);
        if (sw && (await confirmTimedPlan(sw, toast))) return;
        setProfileId(id);
      })();
    };
    window.addEventListener(SAVE_EVENT, onSave);
    return () => window.removeEventListener(SAVE_EVENT, onSave);
  }, [toast]);
  const sw = list.find((x) => x.profileId === profileId);
  const profile = profiles?.find((p) => p.id === profileId);
  // Kirjauspaneeli pysyy auki tallennuksen ajan, vaikka kello poistuu listalta.
  const [held, setHeld] = useState<{ sw: Stopwatch; profile: Profile } | null>(null);
  if (sw && profile && sw.pausedAt !== undefined && held?.sw !== sw) setHeld({ sw, profile });
  const open = !!profileId && !!held && held.sw.profileId === profileId;
  if (!held) return null;
  return (
    <QuickAdd
      open={open}
      onClose={() => setProfileId(null)}
      profile={held.profile}
      timer={{ stopwatch: held.sw, seconds: elapsedSec(held.sw, held.sw.pausedAt ?? Date.now()) }}
    />
  );
}
