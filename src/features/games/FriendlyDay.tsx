// Harjoituspelin pikakirjaus (24.11.2026, käyttäjän toive): harjoituspelipäivänä ei aina tiedetä etukäteen,
// montako peliä pelataan ja kuinka pitkä yksi peli on. Kortissa pelien määrä, yhteinen pelin pituus ja
// lämmittely (kesto = lämmittely + pelit × pituus) sekä jokaisen pelin vastustaja ja tulos. Vastustaja
// valitaan kalenterin vastustajista (vuorotellen esivalittuna) tai kirjoitetaan.

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { defaultGameLength } from '../../domain/tournamentTime';
import type { GameResult, ISODate, Profile, UUID } from '../../domain/types';
import { displayTeamName } from '../../domain/opponent';
import { repo } from '../../db/repositories';
import { Button, inputClass } from '../../ui/components';
import { ToggleChip } from '../../ui/controls';
import { InfoLink } from '../../ui/InfoLink';
import { useToast } from '../../ui/Toast';
import { GoalStepper } from '../football/FootballPanel';

export interface FriendlyEntryData {
  key: string;
  target: { planId: UUID } | { sessionId: UUID };
  /** Kalenterin vastustajat. */
  opponents: string[];
  games: GameResult[];
  gamesCount?: number;
  gameLengthMin?: number;
  warmupMin?: number;
  /** Pelin pituuden oletus (pelimuodosta). */
  defaultLength: number;
  durationMin: number;
  link?: string;
}

const FRIENDLY = 't:football_friendly';
const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x?.trim()))];

/** Tämän päivän harjoituspelit: kuittaamattomat kalenterista ja kirjatut kerrat. */
export function useTodayFriendlies(profileId: UUID, today: ISODate): FriendlyEntryData[] | undefined {
  return useLiveQuery(async () => {
    const types = await repo.listActivityTypes({ includeArchived: true });
    const friendlyIds = new Set(types.filter((t) => t.footballKind === 'friendly').map((t) => t.id));
    const fixtures = await repo.listFixtures(profileId, today, today);
    const fixtureOf = new Map(fixtures.map((f) => [f.plan.id, f.fixture]));
    const sessions = (await repo.sessionsInRange(profileId, today, today)).filter((s) => !s.deletedAt && friendlyIds.has(s.activityTypeId));
    const details = await repo.footballDetailsFor(sessions.map((s) => s.id));
    const out: FriendlyEntryData[] = sessions.map((s) => {
      const fd = details.get(s.id);
      const fx = s.plannedSessionId ? fixtureOf.get(s.plannedSessionId) : undefined;
      return {
        // Sama avain kuin kuittaamattomalla suunnitelmalla: kortti ei käynnisty uudelleen kesken tallennuksen.
        key: s.plannedSessionId ?? s.id,
        target: { sessionId: s.id },
        opponents: uniq([...(fx?.games ?? []).map((g) => g.opponent), ...(fd?.games ?? []).map((g) => g.opponent)]),
        games: fd?.games ?? [],
        gamesCount: fd?.gamesCount,
        gameLengthMin: fd?.gameLengthMin,
        warmupMin: fd?.warmupMin,
        defaultLength: defaultGameLength(fd?.format ?? fx?.format),
        durationMin: s.durationMin,
        link: fd?.link,
      };
    });
    for (const { plan, fixture } of fixtures) {
      if (plan.activityTypeId !== FRIENDLY || plan.status !== 'open') continue;
      const opponents = uniq((fixture?.games ?? []).map((g) => g.opponent));
      out.push({ key: plan.id, target: { planId: plan.id }, opponents, games: [], defaultLength: defaultGameLength(fixture?.format), durationMin: plan.durationMin, link: fixture?.link });
    }
    return out;
  }, [profileId, today]);
}

const hasResult = (g?: GameResult) => g?.goalsFor !== undefined && g?.goalsAgainst !== undefined;
const str = (n?: number) => (n === undefined ? '' : String(n));
const num = (s: string) => (s === '' ? undefined : Number(s));

/** Pieni −/+ -valitsin luvulle (pelien määrä, minuutit). */
function NumStepper({ value, onChange, min, max, step = 1, label, unit }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; label: string; unit?: string }) {
  const btn = 'press flex size-10 items-center justify-center rounded-xl bg-[var(--surface-raised)] text-lg font-semibold text-slate-800 shadow-xs ring-1 ring-slate-300 active:bg-slate-100 disabled:opacity-40';
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-slate-600">{label}</div>
      <div className="flex items-center gap-1.5" role="group" aria-label={label}>
        <button type="button" className={btn} aria-label={`${label}: vähemmän`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>
          −
        </button>
        <span className="min-w-12 text-center text-lg font-semibold tabular-nums text-slate-900" aria-live="polite">
          {value}
          {unit && <span className="ml-0.5 text-xs font-normal text-slate-500">{unit}</span>}
        </span>
        <button type="button" className={btn} aria-label={`${label}: enemmän`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>
          +
        </button>
      </div>
    </div>
  );
}

export function FriendlyEntry({ entry, profile, today }: { entry: FriendlyEntryData; profile: Profile; today: ISODate }) {
  const toast = useToast();
  const opps = entry.opponents;
  const [count, setCount] = useState(entry.gamesCount ?? Math.max(entry.games.length, opps.length, 1));
  const [length, setLength] = useState(entry.gameLengthMin ?? entry.defaultLength);
  const [warmup, setWarmup] = useState(entry.warmupMin ?? 15);
  // Kesto lasketaan pelien määrästä vasta, kun pituus on annettu (aiemmin tai tässä); muuten kalenterin kesto.
  const [timed, setTimed] = useState(entry.gameLengthMin !== undefined);
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  // Tallennetut arvot (myös toiselta laitteelta) päivittävät valinnat.
  useEffect(() => {
    if (entry.gamesCount !== undefined) setCount(entry.gamesCount);
  }, [entry.gamesCount]);
  useEffect(() => {
    if (entry.gameLengthMin === undefined) return;
    setLength(entry.gameLengthMin);
    setWarmup(entry.warmupMin ?? 0);
    setTimed(true);
  }, [entry.gameLengthMin, entry.warmupMin]);
  const games: GameResult[] = Array.from({ length: count }, (_, i) => ({
    ...(entry.games[i] ?? {}),
    opponent: entry.games[i]?.opponent ?? (opps.length ? opps[i % opps.length] : undefined),
  }));
  const done = games.filter(hasResult).length;
  const computed = warmup + count * length;
  const dirty = count !== (entry.gamesCount ?? Math.max(entry.games.length, opps.length, 1)) || (timed && (computed !== entry.durationMin || entry.gameLengthMin === undefined));

  const change = (f: () => void) => {
    f();
    setTimed(true);
  };

  async function save(rows: GameResult[], msg: string) {
    setBusy(true);
    try {
      const r = await repo.recordFriendlyDay(entry.target, { gamesCount: count, ...(timed ? { gameLengthMin: length, warmupMin: warmup } : {}), games: rows }, today);
      setOpen(null);
      if (r.created) toast(`Harjoituspeli kirjattu · ${msg}`, { label: 'Kumoa', run: () => repo.undoConfirm([r.sessionId]) }, 'success');
      else toast(msg, undefined, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card anim-rise scroll-mt-4 p-4 sm:p-5" aria-label="Harjoituspeli: pikakirjaus">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Harjoituspeli · pikakirjaus</div>
      <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="font-display text-lg font-semibold leading-tight text-slate-900">{opps.length ? opps.map(displayTeamName).join(', ') : 'Harjoituspeli'}</h2>
        <span className="flex items-center gap-2 text-sm tabular-nums text-slate-600">
          {done}/{count} {count === 1 ? 'peli' : 'peliä'} kirjattu
          {entry.link && <InfoLink href={entry.link} />}
        </span>
      </div>

      <div className="mt-3 rounded-2xl bg-[var(--surface-sunk)] p-3">
        <div className="flex flex-wrap gap-x-5 gap-y-3">
          <NumStepper label="Pelejä" value={count} min={1} max={20} onChange={(v) => change(() => setCount(v))} />
          <NumStepper label="Pelin pituus" unit="min" value={length} min={5} max={120} step={5} onChange={(v) => change(() => setLength(v))} />
          <NumStepper label="Lämmittely" unit="min" value={warmup} min={0} max={60} step={5} onChange={(v) => change(() => setWarmup(v))} />
        </div>
        <p className="mt-2 text-sm text-slate-700">
          {timed ? (
            <>
              Kesto: {warmup} + {count} × {length} = <strong>{computed} min</strong>
              {computed !== entry.durationMin && <span className="text-slate-500"> (nyt {entry.durationMin} min)</span>}
            </>
          ) : (
            <>Kesto nyt {entry.durationMin} min kalenterin mukaan. Muuta pelien määrää tai pituutta, niin kesto lasketaan niistä.</>
          )}
        </p>
        {dirty && open === null && (
          <Button variant="secondary" className="mt-2" disabled={busy} onClick={() => void save(games, timed ? `Pelit ja kesto tallennettu (${computed} min)` : 'Pelien määrä tallennettu')}>
            Tallenna pelit ja kesto
          </Button>
        )}
      </div>

      <ol className="mt-3 space-y-2">
        {games.map((g, i) => (
          <li key={i} className="rounded-2xl bg-[var(--surface-sunk)] p-3">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900">
                  Peli {i + 1}
                  {g.opponent && ` · ${displayTeamName(g.opponent)}`}
                </div>
                {hasResult(g) && open !== i && (
                  <div className="mt-0.5 text-base font-semibold tabular-nums text-slate-900">
                    {g.goalsFor}–{g.goalsAgainst}
                    {g.playerGoals ? <span className="ml-2 text-xs font-normal text-slate-600">{profile.name} ⚽ {g.playerGoals}</span> : null}
                  </div>
                )}
              </div>
              {open !== i && (
                <Button variant={hasResult(g) ? 'ghost' : 'secondary'} className="shrink-0 px-3" onClick={() => setOpen(i)}>
                  {hasResult(g) ? 'Muokkaa' : 'Kirjaa'}
                </Button>
              )}
            </div>
            {open === i && (
              <FriendlyGameForm
                key={i}
                game={g}
                opponents={opps}
                profile={profile}
                busy={busy}
                onCancel={() => setOpen(null)}
                onSave={(r) => void save(games.map((x, j) => (j === i ? r : x)), `Peli ${i + 1} tallennettu`)}
              />
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function FriendlyGameForm({ game, opponents, profile, busy, onSave, onCancel }: { game: GameResult; opponents: string[]; profile: Profile; busy: boolean; onSave: (r: GameResult) => void; onCancel: () => void }) {
  const [opponent, setOpponent] = useState(game.opponent ?? '');
  const [gf, setGf] = useState(str(game.goalsFor));
  const [ga, setGa] = useState(str(game.goalsAgainst));
  const [pg, setPg] = useState(str(game.playerGoals));
  const other = !opponents.includes(opponent);
  return (
    <div className="mt-3 max-w-md space-y-3">
      <div>
        <div className="mb-1 text-xs font-semibold text-slate-600">Vastustaja</div>
        {opponents.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {opponents.map((o) => (
              <ToggleChip key={o} on={opponent === o} onChange={() => setOpponent(o)}>
                {displayTeamName(o)}
              </ToggleChip>
            ))}
          </div>
        )}
        <input
          className={inputClass}
          value={other ? opponent : ''}
          onChange={(e) => setOpponent(e.target.value)}
          placeholder={opponents.length ? 'tai muu vastustaja' : 'Vastustaja (valinnainen)'}
          maxLength={80}
          aria-label="Muu vastustaja"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-600">Omat maalit</div>
          <GoalStepper value={gf} onChange={setGf} label="Omat maalit" />
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-600">Vastustajan maalit</div>
          <GoalStepper value={ga} onChange={setGa} label="Vastustajan maalit" />
        </div>
      </div>
      <div>
        <div className="mb-1 text-xs font-semibold text-slate-600">{profile.name}: maalit</div>
        <GoalStepper value={pg} onChange={setPg} label={`${profile.name}: maalit`} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || gf === '' || ga === ''}
          onClick={() =>
            onSave({ ...game, opponent: opponent.trim() || undefined, goalsFor: num(gf), goalsAgainst: num(ga), playerGoals: num(pg) })
          }
        >
          Tallenna tulos
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Sulje
        </Button>
      </div>
    </div>
  );
}
