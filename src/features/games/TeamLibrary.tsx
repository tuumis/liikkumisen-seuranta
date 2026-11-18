// Joukkuekirjasto (SPEC 16): Vastustajat-osio kokoaa peleihin ja turnauksiin merkityt joukkueet
// seuroittain. Seuran näkymässä logo, ryhmät ja ikäluokat, tulokset, oman pelaajan maalit ja
// pelien kommentit (muokattavissa). Nimien korjaus koskee kaikkia saman ryhmän pelejä.
// Vastustajan voi lisätä myös käsin ennen ensimmäistä peliä, ja seuralle voi tallentaa ryhmiä,
// jotka ovat valittavissa nimeä kirjoitettaessa (17.11.2026).

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { friendlyRows, gameRows, OUTCOME_LABEL, type GameOutcome, type GameRow, type GameSummary } from '../../domain/football';
import { clubKey, displayTeamName, formatTeamName, parseTeamName, squadLabel } from '../../domain/opponent';
import { buildOpponentLibrary, type ClubEntry, type SquadEntry, type UpcomingGame } from '../../domain/opponentLibrary';
import type { Club, Profile } from '../../domain/types';
import { repo } from '../../db/repositories';
import { Button, Card, EmptyState, inputClass } from '../../ui/components';
import { formatDate } from '../../ui/format';
import { Sheet } from '../../ui/Sheet';
import { ClubOrigin, Flag, OriginFields } from '../../ui/Flag';
import { LogoPicker, TeamLogo, useClubLogos, useClubs } from '../../ui/TeamLogo';
import { useToast } from '../../ui/Toast';
import { today as todayFn } from '../../ui/today';
import { useFootball } from '../football/useFootball';
import { TeamNameFields, useTeamNameSuggestions } from './TeamNameFields';
import { IconChevronRight, IconClose, IconPlus } from '../../ui/icons';

const OUTCOME_CLASS: Record<GameOutcome, string> = {
  W: 'bg-green-700 text-white',
  D: 'bg-slate-200 text-slate-800',
  L: 'bg-red-100 text-red-800',
};

function useLibrary(profile: Profile) {
  const data = useFootball(profile.id);
  const clubs = useLiveQuery(() => repo.listClubs(), []);
  const today = todayFn();
  const fixtures = useLiveQuery(() => repo.listFixtures(profile.id, today), [profile.id, today]);
  const notes = useMemo(() => {
    const m = new Map<string, string>();
    for (const [id, d] of data?.details ?? []) if (d.ratingNote) m.set(id, d.ratingNote);
    return m;
  }, [data]);
  const library = useMemo(() => {
    if (!data) return undefined;
    // Harjoituspelit mukana historiana; seuran V–T–H ja pelimäärä lasketaan ilman niitä (summarizeGames).
    const rows = [...gameRows(data.sessions, data.details, data.types), ...friendlyRows(data.sessions, data.details, data.types)];
    const upcoming: UpcomingGame[] = [];
    for (const e of fixtures ?? []) {
      if (e.plan.status !== 'open' || !e.fixture) continue;
      const f = e.fixture;
      for (const o of [f.opponent, ...(f.games ?? []).map((g) => g.opponent)]) if (o?.trim()) upcoming.push({ date: e.plan.date, opponent: o, eventName: f.eventName });
    }
    return buildOpponentLibrary(rows, upcoming, clubs ?? []);
  }, [data, fixtures, clubs]);
  return { library, notes };
}

const friendliesOf = (c: ClubEntry) => c.squads.reduce((a, s) => a + s.rows.filter((r) => r.kind === 'friendly').length, 0);
const record = (s: GameSummary) => `${s.wins}–${s.draws}–${s.losses}`;
const hasResults = (s: GameSummary) => s.wins + s.draws + s.losses > 0;
const gamesText = (n: number) => `${n} ${n === 1 ? 'peli' : 'peliä'}`;

export function OpponentLibrary({ profile }: { profile: Profile }) {
  const { library, notes } = useLibrary(profile);
  const logos = useClubLogos();
  const clubs = useClubs();
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('fi');
    return (library ?? []).filter((c) => !q || [c.name, ...c.squads.map((s) => squadLabel(s.parts))].join(' ').toLocaleLowerCase('fi').includes(q));
  }, [library, query]);
  const club = library?.find((c) => c.key === open);
  // Puuttuvien logojen läpikäynti: seurat kirjaston järjestyksessä, yksi kerrallaan.
  const missing = (library ?? []).filter((c) => !logos.has(c.key));
  const [walking, setWalking] = useState(false);
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const suggestions = useTeamNameSuggestions(profile.id);
  async function addOpponent() {
    try {
      const c = await repo.addOpponent(newName);
      setAdding(false);
      setNewName('');
      setOpen(clubKey(c.name));
      toast(`${c.name} lisätty vastustajiin`, undefined, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    }
  }
  const pending = (after: string | null) => missing.filter((c) => c.key !== after && !skipped.has(c.key));
  function walkNext() {
    const all = library ?? [];
    const skip = new Set(skipped);
    if (open && !logos.has(open)) skip.add(open);
    setSkipped(skip);
    const from = all.findIndex((c) => c.key === open);
    for (let i = 1; i <= all.length; i++) {
      const c = all[(from + i) % all.length];
      if (c.key !== open && !logos.has(c.key) && !skip.has(c.key)) return setOpen(c.key);
    }
    setWalking(false);
    setOpen(null);
    toast(missing.length ? 'Logojen läpikäynti valmis' : 'Kaikilla seuroilla on nyt logo', undefined, 'success');
  }

  return (
    <Card title="Vastustajat" eyebrow="Joukkuekirjasto">
      <p className="-mt-1 mb-3 text-sm text-slate-600">
        Peleihin ja turnauksiin merkityt joukkueet kootaan tähän automaattisesti. Voit lisätä vastustajan myös itse, esim. tulevan sarjan joukkueet. Avaa seura nähdäksesi ryhmät,
        tulokset ja kommentit.
      </p>
      {adding ? (
        <form
          className="card-sunk mb-3 space-y-2 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void addOpponent();
          }}
        >
          <div className="text-sm font-semibold text-slate-800">Uusi vastustaja</div>
          <TeamNameFields value={newName} onChange={setNewName} suggestions={suggestions} label="Uusi vastustaja" />
          <p className="text-xs text-slate-500">Ryhmä ja ikäluokka ovat valinnaisia; ne tallentuvat seuralle valittaviksi. Logon, maan ja paikkakunnan voit lisätä seuraavaksi.</p>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={!parseTeamName(newName).club}>
              Lisää vastustaja
            </Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Peruuta
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" className="mb-3" onClick={() => setAdding(true)}>
          <IconPlus size="1rem" /> Lisää vastustaja
        </Button>
      )}
      {missing.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-[var(--surface-sunk)] px-3 py-2">
          <span className="min-w-0 flex-1 text-sm text-slate-700">
            <strong className="tabular-nums">{missing.length}</strong> {missing.length === 1 ? 'seura ilman logoa' : 'seuraa ilman logoa'}
          </span>
          <Button
            variant="secondary"
            onClick={() => {
              setSkipped(new Set());
              setWalking(true);
              setOpen(missing[0].key);
            }}
          >
            Lisää logot yksi kerrallaan
          </Button>
        </div>
      )}
      {library && library.length > 6 && (
        <input className={`${inputClass} mb-3`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Hae seuraa tai ryhmää" aria-label="Hae vastustajaa" />
      )}
      {library?.length === 0 && (
        <EmptyState art="people" title="Ei vielä vastustajia" compact>
          Kun kirjaat pelin tai turnauksen vastustajan, joukkue tulee tähän. Voit lisätä vastustajan myös itse.
        </EmptyState>
      )}
      <ul className="grid gap-2 sm:grid-cols-2">
        {shown.map((c) => (
          <li key={c.key} className="min-w-0">
            <button type="button" onClick={() => setOpen(c.key)} className="press flex w-full items-center gap-3 rounded-2xl bg-[var(--surface-sunk)] p-2.5 text-left hover:brightness-[0.98]">
              <TeamLogo logo={logos.get(c.key)} name={c.name} size="lg" />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Flag code={clubs.get(c.key)?.country} />
                  <span className="truncate font-semibold text-slate-900">{c.name}</span>
                </span>
                <span className="block truncate text-xs text-slate-600">
                  {clubs.get(c.key)?.city ? `${clubs.get(c.key)?.city} · ` : ''}
                  {c.squads.map((s) => squadLabel(s.parts)).join(', ')}
                </span>
                <span className="mt-0.5 block text-xs tabular-nums text-slate-500">
                  {c.summary.games === 0 && c.upcoming === 0 && !friendliesOf(c) ? 'Ei vielä pelejä' : gamesText(c.summary.games)}
                  {friendliesOf(c) > 0 && ` · harjoituspelejä ${friendliesOf(c)}`}
                  {hasResults(c.summary) && ` · V–T–H ${record(c.summary)}`}
                  {c.upcoming > 0 && ` · tulossa ${c.upcoming}`}
                </span>
              </span>
              <span className="text-slate-400" aria-hidden>
                <IconChevronRight size="1rem" />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {/* key: jokainen seura avautuu omalla tilallaan (keskeneräinen nimen muokkaus ei siirry toiselle seuralle). */}
      <ClubSheet
        key={club?.key ?? 'none'}
        club={club}
        profile={profile}
        notes={notes}
        logo={club ? logos.get(club.key) : undefined}
        info={club ? clubs.get(club.key) : undefined}
        walk={walking && club ? { left: pending(club.key).length, onNext: walkNext, onStop: () => setWalking(false) } : undefined}
        onClose={() => {
          setOpen(null);
          setWalking(false);
        }}
        onRenamed={(name) => setOpen(clubKey(name))}
      />
    </Card>
  );
}

function ClubSheet({
  club,
  profile,
  notes,
  logo,
  info,
  walk,
  onClose,
  onRenamed,
}: {
  club?: ClubEntry;
  profile: Profile;
  notes: Map<string, string>;
  logo?: string;
  /** Tallennettu seura (maa ja kotipaikkakunta). */
  info?: Club;
  /** Puuttuvien logojen läpikäynti käynnissä: jäljellä olevat muut seurat ja siirtymät. */
  walk?: { left: number; onNext: () => void; onStop: () => void };
  onClose: () => void;
  onRenamed: (name: string) => void;
}) {
  const toast = useToast();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [city, setCity] = useState(info?.city ?? '');

  async function saveOrigin(patch: { country?: string; city?: string }) {
    if (!club) return;
    if ('city' in patch && (patch.city ?? '').trim() === (info?.city ?? '')) return;
    try {
      await repo.saveClub(club.name, patch);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    }
  }
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
          {walk && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-[color-mix(in_oklab,var(--focus)_10%,var(--surface-sunk))] px-3 py-2" role="status">
              <span className="min-w-0 flex-1 text-sm text-slate-700">
                {logo ? 'Logo lisätty. ' : ''}
                {walk.left > 0 ? `Vielä ${walk.left} ${walk.left === 1 ? 'muu seura' : 'muuta seuraa'} ilman logoa.` : 'Tämä on viimeinen seura ilman logoa.'}
              </span>
              <Button variant="ghost" onClick={walk.onStop}>
                Lopeta
              </Button>
              <Button onClick={walk.onNext}>{walk.left > 0 ? (logo ? 'Seuraava' : 'Ohita') : 'Valmis'}</Button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <TeamLogo logo={logo} name={club.name} size="xl" />
            <div className="min-w-0 flex-1">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Pelit" value={String(club.summary.games)} />
                <Stat label="V–T–H" value={record(club.summary)} />
                <Stat label="Maalit" value={`${club.summary.goalsFor}–${club.summary.goalsAgainst}`} />
              </div>
              <ClubOrigin club={info} className="mt-2 text-sm text-slate-700" />
              {club.summary.playerGoalsGames > 0 && (
                <p className="mt-2 text-sm text-slate-700">
                  {profile.name}: <strong>{club.summary.playerGoals}</strong> {club.summary.playerGoals === 1 ? 'maali' : 'maalia'} tätä seuraa vastaan
                </p>
              )}
            </div>
          </div>

          <div className="card-sunk space-y-3 p-3">
            <LogoPicker name={club.name} value={logo} onChange={(v) => void saveLogo(v)} hideCompactLogo />
            <OriginFields
              country={info?.country}
              city={city}
              onCountry={(v) => void saveOrigin({ country: v })}
              onCity={setCity}
              onCityDone={(v) => void saveOrigin({ city: v })}
            />
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

          <SavedSquads club={club} info={info} />

          {club.squads.map((s) => (
            <SquadSection key={s.key} squad={s} profile={profile} notes={notes} />
          ))}

          {club.manual && club.summary.games === 0 && club.upcoming === 0 && (
            <Button
              variant="ghost"
              className="w-full text-red-700"
              onClick={async () => {
                await repo.removeOpponentMark(club.name);
                toast(`${club.name} poistettu vastustajista`);
                onClose();
              }}
            >
              Poista vastustajista
            </Button>
          )}
        </div>
      )}
    </Sheet>
  );
}

/**
 * Seuralle tallennetut ryhmät (17.11.2026): valittavissa siruina, kun seuran nimi kirjoitetaan peliin,
 * turnaukseen tai omaan joukkueeseen. Peleistä löytyvät ryhmät ovat valittavissa ilman tallennustakin.
 */
function SavedSquads({ club, info }: { club: ClubEntry; info?: Club }) {
  const toast = useToast();
  const [group, setGroup] = useState('');
  const [age, setAge] = useState('');
  const saved = info?.squads ?? [];
  async function add() {
    try {
      await repo.saveClubSquad(club.name, { group, age });
      setGroup('');
      setAge('');
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <section className="card-sunk space-y-2 p-3" aria-label="Seuran ryhmät">
      <div className="text-sm font-semibold text-slate-800">Tallennetut ryhmät</div>
      {saved.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {saved.map((q) => {
            const text = squadLabel({ club: club.name, ...q });
            return (
              <li key={squadLabel({ club: '', ...q })} className="flex items-center gap-1 rounded-full bg-[var(--surface-raised)] py-0.5 pl-2.5 pr-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-300">
                {text}
                <button
                  type="button"
                  className="flex size-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                  aria-label={`Poista tallennettu ryhmä ${text}`}
                  onClick={() => void repo.removeClubSquad(club.name, q)}
                >
                  <IconClose size="1.1rem" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">Ei tallennettuja ryhmiä. Tallennettu ryhmä on valittavissa, kun kirjoitat seuran nimen peliin tai turnaukseen.</p>
      )}
      <form
        className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Ryhmä</span>
          <input className={inputClass} value={group} onChange={(e) => setGroup(e.target.value)} maxLength={30} placeholder="esim. Musta" aria-label="Uusi ryhmä" />
        </label>
        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Ikäluokka</span>
          <input className={inputClass} value={age} onChange={(e) => setAge(e.target.value)} maxLength={12} placeholder="esim. 2018" aria-label="Uuden ryhmän ikäluokka" />
        </label>
        <Button type="submit" variant="secondary" disabled={!group.trim() && !age.trim()}>
          Tallenna
        </Button>
      </form>
    </section>
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
      {squad.rows.length === 0 && squad.upcoming.length === 0 && <p className="text-sm text-slate-500">Ei vielä pelejä tätä ryhmää vastaan.</p>}
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
          {r.kind === 'tournament' ? `${r.eventName ?? 'Turnaus'}${r.index ? ` · peli ${r.index}` : ''}` : r.kind === 'friendly' ? 'Harjoituspeli' : 'Peli'}
          {r.team && <span className="text-slate-500"> · {displayTeamName(r.team)}</span>}
        </span>
        {r.playerGoals ? (
          <span className="shrink-0 text-xs font-semibold text-slate-700" title={`${profile.name}: maalit`}>
            ⚽ {r.playerGoals}
          </span>
        ) : null}
        <span className={`shrink-0 text-sm tabular-nums ${r.outcome ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>{r.outcome ? `${r.goalsFor}–${r.goalsAgainst}` : 'ei tulosta'}</span>
        {r.outcome && r.kind !== 'friendly' && <span className={`w-6 shrink-0 rounded text-center text-xs font-bold ${OUTCOME_CLASS[r.outcome]}`}>{OUTCOME_LABEL[r.outcome]}</span>}
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
