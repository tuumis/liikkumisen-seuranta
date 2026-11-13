// Turnauspäivän pikakirjaus (SPEC 16): Viikko-näkymässä turnauspäivänä kortti, jolla pelin tulos,
// oman pelaajan maalit ja peliaika kirjataan isoilla painikkeilla heti pelin jälkeen. Ensimmäinen
// tulos kuittaa turnauksen; myöhemmät päivittävät saman kirjauksen pelirivin.

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { OUTCOME_LABEL, outcomeOf } from '../../domain/football';
import { DEFAULT_PLAY_SHARE } from '../../domain/intensity';
import { opponentHistory } from '../../domain/opponentLibrary';
import { displayTeamName } from '../../domain/opponent';
import type { GameResult, ISODate, PlayedState, Profile, UUID } from '../../domain/types';
import { repo } from '../../db/repositories';
import { Button, inputClass } from '../../ui/components';
import { useToast } from '../../ui/Toast';
import { logoFor, TeamLogo, useClubLogos } from '../../ui/TeamLogo';
import { GoalStepper, PlayedChips } from '../football/FootballPanel';
import { historyLine, useGameRows } from './OpponentHistory';

const TOURNAMENT = 't:football_tournament';
const PLAYED_TEXT: Record<PlayedState, string> = { none: 'ei pelannut', part: 'osan', full: 'koko pelin' };

type Target = { planId: UUID } | { sessionId: UUID };
interface Entry {
  key: string;
  target: Target;
  name: string;
  games: GameResult[];
  playShare?: number;
}

/** Tämän päivän turnaukset: kuittaamattomat suunnitelmat (otteluohjelmasta) ja kirjatut kerrat. */
function useTodayTournaments(profileId: UUID, today: ISODate): Entry[] | undefined {
  return useLiveQuery(async () => {
    const types = await repo.listActivityTypes({ includeArchived: true });
    const tournamentIds = new Set(types.filter((t) => t.footballKind === 'tournament').map((t) => t.id));
    const sessions = (await repo.sessionsInRange(profileId, today, today)).filter((s) => !s.deletedAt && tournamentIds.has(s.activityTypeId));
    const details = await repo.footballDetailsFor(sessions.map((s) => s.id));
    const out: Entry[] = sessions.map((s) => {
      const fd = details.get(s.id);
      const n = Math.max(fd?.games?.length ?? 0, fd?.gamesCount ?? 0, 1);
      const games = Array.from({ length: n }, (_, i) => fd?.games?.[i] ?? {});
      return { key: s.id, target: { sessionId: s.id }, name: fd?.eventName ?? s.label ?? 'Turnaus', games, playShare: s.playShare };
    });
    for (const { plan, fixture } of await repo.listFixtures(profileId, today, today)) {
      if (plan.activityTypeId !== TOURNAMENT || plan.status !== 'open') continue;
      const n = Math.max(fixture?.games?.length ?? 0, fixture?.gamesCount ?? 0, 1);
      const games = Array.from({ length: n }, (_, i) => ({ ...(fixture?.games?.[i] ?? {}) }) as GameResult);
      out.push({ key: plan.id, target: { planId: plan.id }, name: fixture?.eventName ?? plan.label ?? 'Turnaus', games });
    }
    return out;
  }, [profileId, today]);
}

const hasResult = (g: GameResult) => g.goalsFor !== undefined && g.goalsAgainst !== undefined;

export function TournamentDayCard({ profile, today }: { profile: Profile; today: ISODate }) {
  const entries = useTodayTournaments(profile.id, today);
  if (!entries?.length) return null;
  return (
    <>
      {entries.map((e) => (
        <TournamentEntry key={e.key} entry={e} profile={profile} today={today} />
      ))}
    </>
  );
}

function TournamentEntry({ entry, profile, today }: { entry: Entry; profile: Profile; today: ISODate }) {
  const toast = useToast();
  const rows = useGameRows(profile.id);
  const logos = useClubLogos();
  const past = useMemo(() => rows?.filter((r) => r.date < today), [rows, today]);
  const firstOpen = entry.games.findIndex((g) => !hasResult(g));
  const [open, setOpen] = useState<number | null>(firstOpen >= 0 ? firstOpen : null);
  const [extra, setExtra] = useState(0);
  const games = [...entry.games, ...Array.from({ length: extra }, () => ({}) as GameResult)];
  const done = games.filter(hasResult).length;
  const share = `~${Math.round((entry.playShare ?? DEFAULT_PLAY_SHARE) * 100)} %`;

  const save = async (index: number, result: GameResult) => {
    const r = await repo.recordTournamentGame(entry.target, index, result, today);
    const next = games.findIndex((g, i) => i > index && !hasResult(g));
    setOpen(next >= 0 ? next : null);
    if (r.created) {
      toast(`${entry.name} kirjattu · peli ${index + 1} tallennettu`, { label: 'Kumoa', run: () => repo.undoConfirm([r.sessionId]) }, 'success');
    } else toast(`Peli ${index + 1} tallennettu`, undefined, 'success');
  };

  return (
    <section className="card anim-rise p-4 sm:p-5" aria-label={`Turnauspäivä: ${entry.name}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Turnauspäivä · pikakirjaus</div>
      <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="font-display text-lg font-semibold leading-tight text-slate-900">{entry.name}</h2>
        <span className="text-sm tabular-nums text-slate-600">
          {done}/{games.length} {games.length === 1 ? 'peli' : 'peliä'} kirjattu
        </span>
      </div>
      <ol className="mt-3 space-y-2">
        {games.map((g, i) => {
          const h = past && g.opponent ? historyLine(opponentHistory(past, g.opponent)) : undefined;
          return (
            <li key={i} className="rounded-2xl bg-[var(--surface-sunk)] p-3">
              <div className="flex items-center gap-2">
                {g.opponent && <TeamLogo logo={logoFor(logos, g.opponent)} name={g.opponent} size="sm" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    Peli {i + 1}
                    {g.opponent && ` · ${displayTeamName(g.opponent)}`}
                  </div>
                  <div className="line-clamp-2 text-xs text-slate-500">
                    {[g.time && `klo ${g.time.replace(':', '.')}`, g.location, !hasResult(g) && h].filter(Boolean).join(' · ') || (hasResult(g) ? '' : 'Ei otteluohjelmaa')}
                  </div>
                  {hasResult(g) && open !== i && <SavedScore g={g} profile={profile} />}
                </div>
                {open !== i && (
                  <Button variant={hasResult(g) ? 'ghost' : 'secondary'} className="shrink-0 px-3" onClick={() => setOpen(i)}>
                    {hasResult(g) ? 'Muokkaa' : 'Kirjaa'}
                  </Button>
                )}
              </div>
              {open === i && <GameForm key={i} game={g} profile={profile} share={share} onSave={(r) => save(i, r)} onCancel={() => setOpen(null)} />}
            </li>
          );
        })}
      </ol>
      <button type="button" onClick={() => {
        setExtra((x) => x + 1);
        setOpen(games.length);
      }} className="mt-2 min-h-10 rounded-xl px-2 text-sm font-semibold text-green-800 hover:bg-green-50">
        + Lisää peli
      </button>
    </section>
  );
}

function SavedScore({ g, profile }: { g: GameResult; profile: Profile }) {
  const o = outcomeOf(g.goalsFor, g.goalsAgainst);
  const extra = [g.playerGoals ? `${profile.name} ⚽ ${g.playerGoals}` : '', g.played ? PLAYED_TEXT[g.played] : ''].filter(Boolean).join(' · ');
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className="text-base font-semibold tabular-nums text-slate-900">
        {g.goalsFor}–{g.goalsAgainst}
      </span>
      {o && <span className="rounded bg-[var(--surface-raised)] px-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200">{OUTCOME_LABEL[o]}</span>}
      {extra && <span className="text-xs text-slate-600">{extra}</span>}
    </div>
  );
}

const str = (n?: number) => (n === undefined ? '' : String(n));
const num = (s: string) => (s === '' ? undefined : Number(s));

function GameForm({ game, profile, share, onSave, onCancel }: { game: GameResult; profile: Profile; share: string; onSave: (r: GameResult) => Promise<void>; onCancel: () => void }) {
  const [gf, setGf] = useState(str(game.goalsFor));
  const [ga, setGa] = useState(str(game.goalsAgainst));
  const [pg, setPg] = useState(str(game.playerGoals));
  const [played, setPlayed] = useState<PlayedState | ''>(game.played ?? '');
  const [opponent, setOpponent] = useState(game.opponent ?? '');
  const [busy, setBusy] = useState(false);
  const ready = gf !== '' && ga !== '';
  const pgTooMany = pg !== '' && gf !== '' && Number(pg) > Number(gf);

  const submit = async () => {
    setBusy(true);
    try {
      await onSave({
        goalsFor: num(gf),
        goalsAgainst: num(ga),
        playerGoals: num(pg),
        played: played || undefined,
        ...(game.opponent ? {} : { opponent: opponent.trim() || undefined }),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 max-w-md space-y-3">
      {!game.opponent && (
        <input className={inputClass} value={opponent} placeholder="Vastustaja (valinnainen)" maxLength={80} onChange={(e) => setOpponent(e.target.value)} aria-label="Vastustaja" />
      )}
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
        {pgTooMany && <p className="mt-1 text-xs text-amber-800">Enemmän kuin joukkueen maalit – tarkista.</p>}
      </div>
      <div>
        <div className="mb-1 text-xs font-semibold text-slate-600">Pelasiko</div>
        <PlayedChips value={played} onChange={setPlayed} label="Pelasiko" shareText={share} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void submit()} disabled={!ready || busy}>
          Tallenna tulos
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Sulje
        </Button>
      </div>
    </div>
  );
}
