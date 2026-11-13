// Joukkuekirjasto (SPEC 16): Vastustajat-osio kokoaa peleihin ja turnauksiin merkityt joukkueet
// seuroittain. Seuran näkymässä logo, ryhmät ja ikäluokat, tulokset, oman pelaajan maalit ja
// pelien kommentit (muokattavissa). Nimien korjaus koskee kaikkia saman ryhmän pelejä.

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { gameRows, OUTCOME_LABEL, type GameOutcome, type GameRow, type GameSummary } from '../../domain/football';
import { clubKey, formatTeamName, parseTeamName, squadLabel } from '../../domain/opponent';
import { buildOpponentLibrary, type ClubEntry, type SquadEntry, type UpcomingGame } from '../../domain/opponentLibrary';
import type { Profile } from '../../domain/types';
import { repo } from '../../db/repositories';
import { Button, Card, EmptyState, inputClass } from '../../ui/components';
import { formatDate } from '../../ui/format';
import { Sheet } from '../../ui/Sheet';
import { LogoPicker, TeamLogo, useClubLogos } from '../../ui/TeamLogo';
import { useToast } from '../../ui/Toast';
import { today as todayFn } from '../../ui/today';
import { useFootball } from '../football/useFootball';
import { TeamNameFields, useTeamNameSuggestions } from './TeamNameFields';

const OUTCOME_CLASS: Record<GameOutcome, string> = {
  W: 'bg-green-700 text-white',
  D: 'bg-slate-200 text-slate-800',
  L: 'bg-red-100 text-red-800',
};

function useLibrary(profile: Profile) {
  const data = useFootball(profile.id);
  const today = todayFn();
  const fixtures = useLiveQuery(() => repo.listFixtures(profile.id, today), [profile.id, today]);
  const notes = useMemo(() => {
    const m = new Map<string, string>();
    for (const [id, d] of data?.details ?? []) if (d.ratingNote) m.set(id, d.ratingNote);
    return m;
  }, [data]);
  const library = useMemo(() => {
    if (!data) return undefined;
    const rows = gameRows(data.sessions, data.details, data.types);
    const upcoming: UpcomingGame[] = [];
    for (const e of fixtures ?? []) {
      if (e.plan.status !== 'open' || !e.fixture) continue;
      const f = e.fixture;
      for (const o of [f.opponent, ...(f.games ?? []).map((g) => g.opponent)]) if (o?.trim()) upcoming.push({ date: e.plan.date, opponent: o, eventName: f.eventName });
    }
    return buildOpponentLibrary(rows, upcoming);
  }, [data, fixtures]);
  return { library, notes };
}

const record = (s: GameSummary) => `${s.wins}–${s.draws}–${s.losses}`;
const hasResults = (s: GameSummary) => s.wins + s.draws + s.losses > 0;
const gamesText = (n: number) => `${n} ${n === 1 ? 'peli' : 'peliä'}`;

export function OpponentLibrary({ profile }: { profile: Profile }) {
  const { library, notes } = useLibrary(profile);
  const logos = useClubLogos();
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('fi');
    return (library ?? []).filter((c) => !q || [c.name, ...c.squads.map((s) => squadLabel(s.parts))].join(' ').toLocaleLowerCase('fi').includes(q));
  }, [library, query]);
  const club = library?.find((c) => c.key === open);

  return (
    <Card title="Vastustajat" eyebrow="Joukkuekirjasto">
      <p className="-mt-1 mb-3 text-sm text-slate-600">Peleihin ja turnauksiin merkityt joukkueet kootaan tähän automaattisesti. Avaa seura nähdäksesi ryhmät, tulokset ja kommentit.</p>
      {library && library.length > 6 && (
        <input className={`${inputClass} mb-3`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Hae seuraa tai ryhmää" aria-label="Hae vastustajaa" />
      )}
      {library?.length === 0 && (
        <EmptyState art="people" title="Ei vielä vastustajia" compact>
          Kun kirjaat pelin tai turnauksen vastustajan, joukkue tulee tähän.
        </EmptyState>
      )}
      <ul className="grid gap-2 sm:grid-cols-2">
        {shown.map((c) => (
          <li key={c.key}>
            <button type="button" onClick={() => setOpen(c.key)} className="press flex w-full items-center gap-3 rounded-2xl bg-[var(--surface-sunk)] p-2.5 text-left hover:brightness-[0.98]">
              <TeamLogo logo={logos.get(c.key)} name={c.name} size="lg" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-slate-900">{c.name}</span>
                <span className="block truncate text-xs text-slate-600">{c.squads.map((s) => squadLabel(s.parts)).join(', ')}</span>
                <span className="mt-0.5 block text-xs tabular-nums text-slate-500">
                  {gamesText(c.summary.games)}
                  {hasResults(c.summary) && ` · V–T–H ${record(c.summary)}`}
                  {c.upcoming > 0 && ` · tulossa ${c.upcoming}`}
                </span>
              </span>
              <span className="text-slate-400" aria-hidden>
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
      <ClubSheet club={club} profile={profile} notes={notes} logo={club ? logos.get(club.key) : undefined} onClose={() => setOpen(null)} onRenamed={(name) => setOpen(clubKey(name))} />
    </Card>
  );
}

function ClubSheet({
  club,
  profile,
  notes,
  logo,
  onClose,
  onRenamed,
}: {
  club?: ClubEntry;
  profile: Profile;
  notes: Map<string, string>;
  logo?: string;
  onClose: () => void;
  onRenamed: (name: string) => void;
}) {
  const toast = useToast();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');

  async function saveLogo(v: string | undefined) {
    if (!club) return;
    try {
      await repo.saveClubLogo(club.name, v);
      toast(v ? 'Logo tallennettu' : 'Logo poistettu', undefined, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    }
  }
  async function rename() {
    if (!club || !name.trim()) return;
    const n = await repo.renameClub(club.name, name);
    setRenaming(false);
    onRenamed(name);
    toast(`Seuran nimi päivitetty (${n} ${n === 1 ? 'nimi' : 'nimeä'})`, undefined, 'success');
  }

  return (
    <Sheet open={!!club} onClose={onClose} title={club?.name ?? 'Seura'}>
      {club && (
        <div className="space-y-5 pb-2">
          <div className="flex flex-wrap items-center gap-4">
            <TeamLogo logo={logo} name={club.name} size="xl" />
            <div className="min-w-0 flex-1">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Pelit" value={String(club.summary.games)} />
                <Stat label="V–T–H" value={record(club.summary)} />
                <Stat label="Maalit" value={`${club.summary.goalsFor}–${club.summary.goalsAgainst}`} />
              </div>
              {club.summary.playerGoalsGames > 0 && (
                <p className="mt-2 text-sm text-slate-700">
                  {profile.name}: <strong>{club.summary.playerGoals}</strong> {club.summary.playerGoals === 1 ? 'maali' : 'maalia'} tätä seuraa vastaan
                </p>
              )}
            </div>
          </div>

          <div className="card-sunk space-y-3 p-3">
            <LogoPicker name={club.name} value={logo} onChange={(v) => void saveLogo(v)} />
            {renaming ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void rename();
                }}
              >
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus aria-label="Seuran nimi" />
                <Button type="submit">Tallenna</Button>
                <Button variant="ghost" onClick={() => setRenaming(false)}>
                  Peruuta
                </Button>
              </form>
            ) : (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setName(club.name);
                  setRenaming(true);
                }}
              >
                Muuta seuran nimeä
              </Button>
            )}
            <p className="text-xs text-slate-500">Nimen muutos koskee kaikkia tämän seuran pelejä. Saman nimen antaminen kahdelle seuralle yhdistää ne.</p>
          </div>

          {club.squads.map((s) => (
            <SquadSection key={s.key} squad={s} profile={profile} notes={notes} />
          ))}
        </div>
      )}
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--surface-sunk)] px-2 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="stat text-lg font-semibold tabular-nums text-slate-900">{value}</div>
    </div>
  );
}

function SquadSection({ squad, profile, notes }: { squad: SquadEntry; profile: Profile; notes: Map<string, string> }) {
  const toast = useToast();
  const suggestions = useTeamNameSuggestions(profile.id);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');

  async function save() {
    const to = parseTeamName(value);
    if (!to.club) return toast('Anna seuran nimi');
    const n = await repo.editSquad(squad.parts, to);
    setEditing(false);
    toast(`Joukkueen nimi päivitetty (${n} ${n === 1 ? 'kohta' : 'kohtaa'})`, undefined, 'success');
  }

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-semibold text-slate-900">
          {squadLabel(squad.parts)}
          <span className="ml-2 text-xs font-normal tabular-nums text-slate-500">
            {gamesText(squad.summary.games)}
            {hasResults(squad.summary) && ` · ${record(squad.summary)}`}
          </span>
        </h3>
        {!editing && (
          <button
            type="button"
            className="shrink-0 text-sm font-semibold text-green-800 hover:underline"
            onClick={() => {
              setValue(formatTeamName(squad.parts));
              setEditing(true);
            }}
          >
            Muokkaa nimeä
          </button>
        )}
      </div>
      {editing && (
        <form
          className="card-sunk mb-3 space-y-2 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <TeamNameFields value={value} onChange={setValue} suggestions={suggestions} label="Joukkue" />
          <p className="text-xs text-slate-500">Muutos koskee kaikkia tämän ryhmän pelejä ja tulevia pelejä. Esim. vanha nimi "FC Honka Musta" → seura FC Honka, ryhmä Musta.</p>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              Tallenna
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Peruuta
            </Button>
          </div>
        </form>
      )}
      <ul className="space-y-2">
        {squad.upcoming.map((u, i) => (
          <li key={`u${i}`} className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600">
            <span className="w-20 shrink-0 tabular-nums">{formatDate(u.date, 'EEEEEE d.M.')}</span>
            <span className="min-w-0 flex-1 truncate">Tulossa{u.eventName ? ` · ${u.eventName}` : ''}</span>
          </li>
        ))}
        {squad.rows.map((r) => (
          <GameLine key={`${r.sessionId}-${r.index ?? 0}`} r={r} note={r.index ? r.note : notes.get(r.sessionId)} profile={profile} />
        ))}
      </ul>
    </section>
  );
}

function GameLine({ r, note, profile }: { r: GameRow; note?: string; profile: Profile }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  async function save() {
    await repo.setGameComment(r.sessionId, r.index, text);
    setEditing(false);
    toast('Kommentti tallennettu', undefined, 'success');
  }
  return (
    <li className="rounded-2xl bg-[var(--surface-sunk)] px-3 py-2.5">
      <div className="flex items-center gap-3">
        <span className="w-20 shrink-0 text-sm tabular-nums text-slate-600">{formatDate(r.date, 'EEEEEE d.M.yy')}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
          {r.kind === 'tournament' ? `${r.eventName ?? 'Turnaus'}${r.index ? ` · peli ${r.index}` : ''}` : 'Peli'}
          {r.team && <span className="text-slate-500"> · {r.team}</span>}
        </span>
        {r.playerGoals ? (
          <span className="shrink-0 text-xs font-semibold text-slate-700" title={`${profile.name}: maalit`}>
            ⚽ {r.playerGoals}
          </span>
        ) : null}
        <span className={`shrink-0 text-sm tabular-nums ${r.outcome ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>{r.outcome ? `${r.goalsFor}–${r.goalsAgainst}` : 'ei tulosta'}</span>
        {r.outcome && <span className={`w-6 shrink-0 rounded text-center text-xs font-bold ${OUTCOME_CLASS[r.outcome]}`}>{OUTCOME_LABEL[r.outcome]}</span>}
      </div>
      {editing ? (
        <form
          className="mt-2 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <textarea className={`${inputClass} min-h-16 py-2`} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={2} autoFocus aria-label="Kommentti" />
          <div className="flex gap-2">
            <Button type="submit">Tallenna</Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Peruuta
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-1 flex items-start gap-2">
          {note ? <p className="min-w-0 flex-1 whitespace-pre-line text-sm text-slate-700">{note}</p> : <p className="min-w-0 flex-1 text-sm text-slate-400">Ei kommenttia</p>}
          <button
            type="button"
            className="shrink-0 text-xs font-semibold text-green-800 hover:underline"
            onClick={() => {
              setText(note ?? '');
              setEditing(true);
            }}
          >
            {note ? 'Muokkaa' : 'Lisää kommentti'}
          </button>
        </div>
      )}
    </li>
  );
}
