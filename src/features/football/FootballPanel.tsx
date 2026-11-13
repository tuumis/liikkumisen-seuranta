// Jalkapallon lisätietopaneeli (SPEC 8). Kaikki valinnaisia; "Myöhemmin" ohittaa, ja kerta on silti tallessa (D3).
// Viihtyminen ennen suoritusarviota: liikkumisen ilo on pysyvien tottumusten perusta.

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { ActivityType, FieldPosition, FocusTag, GameFormat, GameLevel, GameResult, PlayedState, Session } from '../../domain/types';
import { DEFAULT_GAME_WARMUP_MIN, DEFAULT_PLAY_SHARE } from '../../domain/intensity';
import { goalsLabel } from '../../ui/labels';
import { GAME_FORMATS, LEVEL_LABEL, POSITION_LABEL, POSITIONS } from '../../domain/football';
import { repo, type FootballDetailsInput } from '../../db/repositories';
import { Button, Field, inputClass } from '../../ui/components';
import { Segmented, ToggleChip } from '../../ui/controls';
import { dayLabel } from '../../ui/format';
import { ENJOYMENT_LABEL, FOCUS_TAG_LABEL, RATING_LABEL } from '../../ui/labels';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { TeamNameFields, useTeamNameSuggestions } from '../games/TeamNameFields';

const PLAYED_PICKS = [10, 15, 20, 30, 40, 50, 60];

type GameDraft = { opponent: string; goalsFor: string; goalsAgainst: string; playedMin: string; played: PlayedState | ''; playerGoals: string; time?: string; location?: string; note: string };

/** Pelasiko: Ei / Osan / Koko pelin (uudelleen painallus poistaa valinnan). */
function PlayedChips({ value, onChange, label, shareText }: { value: PlayedState | ''; onChange: (v: PlayedState | '') => void; label: string; shareText: string }) {
  const opts: { v: PlayedState; l: string }[] = [
    { v: 'none', l: 'Ei pelannut' },
    { v: 'part', l: `Osan (${shareText})` },
    { v: 'full', l: 'Koko pelin' },
  ];
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {opts.map((o) => (
        <ToggleChip key={o.v} on={value === o.v} onChange={() => onChange(value === o.v ? '' : o.v)}>
          {o.l}
        </ToggleChip>
      ))}
    </div>
  );
}

/** Oman lapsen maalit: nopea − / + -valitsin (tyhjä = ei kirjattu). */
function GoalStepper({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const n = value === '' ? undefined : Number(value);
  const btn = 'press flex size-11 items-center justify-center rounded-xl bg-[var(--surface-raised)] text-xl font-semibold text-slate-800 shadow-xs ring-1 ring-slate-300 active:bg-slate-100 disabled:opacity-40';
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" className={btn} aria-label="Vähemmän" disabled={n === undefined} onClick={() => onChange(n === undefined || n <= 0 ? '' : String(n - 1))}>
        −
      </button>
      <span className="min-w-12 text-center text-2xl font-semibold tabular-nums text-slate-900" aria-live="polite">
        {n === undefined ? <span className="text-base font-normal text-slate-400">–</span> : n}
      </span>
      <button type="button" className={btn} aria-label="Enemmän" onClick={() => onChange(String((n ?? -1) + 1))}>
        +
      </button>
    </div>
  );
}
const toNum = (s: string) => (s.trim() === '' ? undefined : Number.isInteger(Number(s)) && Number(s) >= 0 ? Number(s) : NaN);
const str = (n?: number) => (n === undefined ? '' : String(n));

export function FootballPanel({ session, type, onClose }: { session: Session | null; type?: ActivityType; onClose: () => void }) {
  const toast = useToast();
  const kind = type?.footballKind;
  const names = useLiveQuery(() => (session ? repo.footballNameSuggestions(session.profileId) : undefined), [session?.profileId]);
  const teamNames = useTeamNameSuggestions(session?.profileId);
  const playerName = useLiveQuery(
    async () => (session ? (await repo.listProfiles({ includeArchived: true })).find((p) => p.id === session.profileId)?.name : undefined),
    [session?.profileId],
  );

  const [attendance, setAttendance] = useState<'full' | 'partial'>('full');
  const [enjoyment, setEnjoyment] = useState<1 | 2 | 3 | undefined>();
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5 | undefined>();
  const [tags, setTags] = useState<FocusTag[]>([]);
  const [note, setNote] = useState('');
  const [team, setTeam] = useState('');
  const [teamId, setTeamId] = useState('');
  const [level, setLevel] = useState<GameLevel | ''>('');
  const teams = useLiveQuery(() => (session ? repo.listTeams(session.profileId) : undefined), [session?.profileId]);
  const [opponent, setOpponent] = useState('');
  const [gf, setGf] = useState('');
  const [ga, setGa] = useState('');
  const [played, setPlayed] = useState('');
  const [gamePlayed, setGamePlayed] = useState<PlayedState | ''>('');
  const [eventName, setEventName] = useState('');
  const [gamesCount, setGamesCount] = useState('');
  const [games, setGames] = useState<GameDraft[]>([]);
  const [playerGoals, setPlayerGoals] = useState('');
  const [format, setFormat] = useState<GameFormat | ''>('');
  const [positions, setPositions] = useState<FieldPosition[]>([]);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  // Avattaessa: olemassa olevat tiedot tai oletukset (oma joukkue = viimeksi käytetty).
  const existing = useLiveQuery(async () => (session ? (await repo.getFootballDetails(session.id)) ?? null : undefined), [session?.id]);
  useEffect(() => {
    if (!session || existing === undefined) return;
    const d = existing ?? undefined;
    setAttendance(d?.attendance ?? 'full');
    setEnjoyment(d?.enjoyment);
    setRating(d?.parentRating);
    setTags(d?.focusTags ?? []);
    setNote(d?.ratingNote ?? '');
    setTeam(d?.team ?? '');
    setTeamId(d?.teamId ?? '');
    setLevel(d?.level ?? '');
    setOpponent(d?.opponent ?? '');
    setGf(str(d?.goalsFor));
    setGa(str(d?.goalsAgainst));
    setPlayed(d?.played ? '' : str(session.playedMin));
    setGamePlayed(d?.played ?? '');
    setEventName(d?.eventName ?? '');
    setGamesCount(str(d?.games?.length ? undefined : d?.gamesCount));
    setGames(
      (d?.games ?? []).map((g) => ({
        opponent: g.opponent ?? '',
        goalsFor: str(g.goalsFor),
        goalsAgainst: str(g.goalsAgainst),
        playedMin: str(g.playedMin),
        played: g.played ?? '',
        playerGoals: str(g.playerGoals),
        time: g.time,
        location: g.location,
        note: g.note ?? '',
      })),
    );
    setPlayerGoals(str(d?.games?.length ? undefined : d?.playerGoals));
    setFormat(d?.format ?? '');
    setPositions(d?.positions ?? []);
    setError(undefined);
  }, [session, existing]);

  // Uudelle kerralle ehdotetaan viimeksi käytettyä omaa joukkuetta.
  useEffect(() => {
    if (existing === null && names?.teams[0] && kind !== 'training') setTeam((t) => t || names.teams[0]);
    // Uudelle kerralle oma joukkue, jos niitä on vain yksi (taso joukkueen sarjatasosta).
    if (existing === null && teams?.length === 1 && kind !== 'training') {
      setTeamId((t) => t || teams[0].id);
      setLevel((l) => l || teams[0].level);
      setFormat((f) => f || teams[0].format || '');
    }
  }, [existing, names, kind, teams]);

  if (!session || !type) return null;
  const warmupMin = session.warmupMin ?? DEFAULT_GAME_WARMUP_MIN;
  const shareText = `~${Math.round((session.playShare ?? DEFAULT_PLAY_SHARE) * 100)} %`;
  const goals = goalsLabel(playerName);

  async function save() {
    const nums = { gf: toNum(gf), ga: toNum(ga), played: toNum(played), count: toNum(gamesCount), own: toNum(playerGoals) };
    const rows: GameResult[] = games.map((g) => ({
      opponent: g.opponent,
      goalsFor: toNum(g.goalsFor),
      goalsAgainst: toNum(g.goalsAgainst),
      playedMin: toNum(g.playedMin),
      played: g.played || undefined,
      playerGoals: toNum(g.playerGoals),
      time: g.time,
      location: g.location,
      note: g.note,
    }));
    const bad = [...Object.values(nums), ...rows.flatMap((r) => [r.goalsFor, r.goalsAgainst, r.playedMin, r.playerGoals])].some((n) => Number.isNaN(n));
    if (bad) return setError('Anna luvut kokonaislukuina');
    if (nums.played !== undefined && nums.played > session!.durationMin) return setError('Pelatut minuutit eivät voi ylittää kestoa');
    // Peli: tarkat minuutit, muuten Ei = 0, Koko pelin = kesto − lämmittely, Osan = peliaika-arvio (ei minuutteja).
    const gamePlayedMin =
      kind !== 'game'
        ? nums.played
        : nums.played !== undefined
          ? nums.played
          : gamePlayed === 'none'
            ? 0
            : gamePlayed === 'full'
              ? Math.max(0, session!.durationMin - warmupMin)
              : undefined;
    const input: FootballDetailsInput = {
      attendance,
      focusTags: tags,
      parentRating: rating,
      enjoyment,
      ratingNote: note,
      team,
      teamId: teamId || undefined,
      level: level || undefined,
      opponent,
      goalsFor: nums.gf,
      goalsAgainst: nums.ga,
      playedMin: gamePlayedMin,
      played: kind === 'game' ? gamePlayed || undefined : undefined,
      eventName,
      gamesCount: nums.count,
      games: rows,
      playerGoals: nums.own,
      format: format || undefined,
      positions,
    };
    setSaving(true);
    try {
      await repo.saveFootballDetails(session!.id, input);
      toast('Lisätiedot tallennettu', undefined, 'success');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const list = (id: string, values?: string[]) => (
    <datalist id={id}>
      {values?.map((v) => (
        <option key={v} value={v} />
      ))}
    </datalist>
  );

  return (
    <Sheet open onClose={onClose} title={`${type.icon} ${type.name} · ${dayLabel(session.date)}`}>
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <p className="text-xs text-slate-500">Kaikki tiedot ovat valinnaisia. Kerta on jo tallennettu.</p>

        <div>
          <div className="mb-1 text-sm font-medium text-slate-700">Viihtyminen</div>
          <Segmented<0 | 1 | 2 | 3>
            label="Viihtyminen"
            value={enjoyment ?? 0}
            onChange={(v) => setEnjoyment(v === 0 || v === enjoyment ? undefined : v)}
            options={([1, 2, 3] as const).map((v) => ({ value: v, label: ENJOYMENT_LABEL[v] }))}
          />
        </div>

        <div>
          <div className="mb-1 text-sm font-medium text-slate-700">Suoritus suhteessa omaan tavalliseen tasoon</div>
          <div className="flex gap-1" role="radiogroup" aria-label="Suoritusarvio">
            {([1, 2, 3, 4, 5] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={rating === v}
                aria-label={`${v}: ${RATING_LABEL[v]}`}
                onClick={() => setRating(rating === v ? undefined : v)}
                className={`flex min-h-11 flex-1 items-center justify-center rounded-xl text-2xl ${rating !== undefined && v <= rating ? 'text-amber-500' : 'text-slate-300'} active:bg-slate-100`}
              >
                ★
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-600">{rating ? `${rating} – ${RATING_LABEL[rating]}` : 'Ei arviota. 3 = tavallinen oma taso.'}</p>
          <p className="text-xs text-slate-400">Vanhemman arvio, ei mittaus. Ei vertailua muihin pelaajiin.</p>
        </div>

        {kind === 'training' && (
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Treenin sisältö</div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(FOCUS_TAG_LABEL) as FocusTag[]).map((t) => (
                <ToggleChip key={t} on={tags.includes(t)} onChange={(on) => setTags((cur) => (on ? [...cur, t] : cur.filter((x) => x !== t)))}>
                  {FOCUS_TAG_LABEL[t]}
                </ToggleChip>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mb-1 text-sm font-medium text-slate-700">Osallistuminen</div>
          <Segmented
            label="Osallistuminen"
            value={attendance}
            onChange={setAttendance}
            options={[
              { value: 'full', label: 'Kokonaan' },
              { value: 'partial', label: 'Osittain' },
            ]}
          />
        </div>

        {(kind === 'game' || kind === 'tournament') && (
          <>
            {teams && teams.length > 0 ? (
              <Field label="Oma joukkue">
                <select
                  className={inputClass}
                  value={teamId}
                  onChange={(e) => {
                    const t = teams.find((x) => x.id === e.target.value);
                    setTeamId(e.target.value);
                    if (t) {
                      setTeam(t.name);
                      setLevel(t.level);
                      if (t.format) setFormat(t.format);
                    }
                  }}
                >
                  <option value="">– muu joukkue –</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({LEVEL_LABEL[t.level]})
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            {!teamId && (
              <Field label={teams && teams.length > 0 ? 'Muu joukkue' : 'Oma joukkue'}>
                <input className={inputClass} value={team} onChange={(e) => setTeam(e.target.value)} list="fb-teams" placeholder="esim. P2018 Valkoinen" maxLength={60} />
                {list('fb-teams', names?.teams)}
              </Field>
            )}
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Taso</div>
              <div className="flex flex-wrap gap-2">
                {(['elite', 'kilpa', 'haaste'] as GameLevel[]).map((l) => (
                  <ToggleChip key={l} on={level === l} onChange={() => setLevel(level === l ? '' : l)}>
                    {LEVEL_LABEL[l]}
                  </ToggleChip>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-500">Taso säätää tehoarviota: Elite = kovempi, Kilpa = tavallinen, Haaste = kevyempi.</p>
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Pelimuoto</div>
              <div className="flex flex-wrap gap-2">
                {GAME_FORMATS.map((f) => (
                  <ToggleChip key={f} on={format === f} onChange={() => setFormat(format === f ? '' : f)}>
                    {f}
                  </ToggleChip>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Pelipaikka</div>
              <div className="flex flex-wrap gap-2">
                {POSITIONS.map((p) => (
                  <ToggleChip key={p} on={positions.includes(p)} onChange={(on) => setPositions((cur) => (on ? [...cur, p] : cur.filter((x) => x !== p)))}>
                    {POSITION_LABEL[p]}
                  </ToggleChip>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-500">Valitse kaikki paikat, joilla pelasi.</p>
            </div>
          </>
        )}

        {kind === 'game' && (
          <>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Pelasiko?</div>
              <PlayedChips
                value={gamePlayed}
                onChange={(v) => {
                  setGamePlayed(v);
                  if (v) setPlayed('');
                }}
                label="Pelasiko"
                shareText={shareText}
              />
              <div className="mb-1 mt-3 text-xs font-medium text-slate-600">tai tarkat pelatut minuutit</div>
              <div className="flex flex-wrap gap-2">
                {PLAYED_PICKS.filter((m) => m <= session.durationMin).map((m) => (
                  <ToggleChip
                    key={m}
                    on={played === String(m)}
                    onChange={(on) => {
                      setPlayed(on ? String(m) : '');
                      if (on) setGamePlayed('');
                    }}
                  >
                    {m}
                  </ToggleChip>
                ))}
                <input
                  className="field-shell min-h-10 w-20 rounded-full border-0 px-3 text-sm"
                  inputMode="numeric"
                  value={played}
                  onChange={(e) => {
                    setPlayed(e.target.value);
                    if (e.target.value) setGamePlayed('');
                  }}
                  aria-label="Pelatut minuutit"
                  placeholder="muu"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Arvio: lämmittely {warmupMin} min treenin teholla, pelattu aika pelin teholla, vaihtopenkki ei kerrytä liikuntaa. Ilman valintaa käytetään peliaika-arviota ({shareText}).
              </p>
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Vastustaja</div>
              <TeamNameFields value={opponent} onChange={setOpponent} suggestions={teamNames} label="Vastustaja" />
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Tulos (oma joukkue – vastustaja)</div>
              <div className="flex items-center gap-2">
                <input className={`${inputClass} w-20 text-center`} inputMode="numeric" value={gf} onChange={(e) => setGf(e.target.value)} aria-label="Tehdyt maalit" />
                <span className="text-slate-500">–</span>
                <input className={`${inputClass} w-20 text-center`} inputMode="numeric" value={ga} onChange={(e) => setGa(e.target.value)} aria-label="Päästetyt maalit" />
              </div>
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">{goals} ⚽</div>
              <GoalStepper value={playerGoals} onChange={setPlayerGoals} label={goals} />
            </div>
          </>
        )}

        {kind === 'tournament' && (
          <>
            <Field label="Turnauksen nimi">
              <input className={inputClass} value={eventName} onChange={(e) => setEventName(e.target.value)} list="fb-events" maxLength={60} />
              {list('fb-events', names?.events)}
            </Field>
            {games.length === 0 && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Pelien määrä">
                  <input className={inputClass} inputMode="numeric" value={gamesCount} onChange={(e) => setGamesCount(e.target.value)} />
                </Field>
                <Field label="Pelatut min yhteensä">
                  <input className={inputClass} inputMode="numeric" value={played} onChange={(e) => setPlayed(e.target.value)} />
                </Field>
                <div className="col-span-2">
                  <div className="mb-1 text-sm font-medium text-slate-700">{goals} yhteensä ⚽</div>
                  <GoalStepper value={playerGoals} onChange={setPlayerGoals} label={`${goals} yhteensä`} />
                </div>
              </div>
            )}
            {games.map((g, i) => (
              <div key={i} className="space-y-2 card-sunk p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800">
                    Peli {i + 1}
                    {g.time && <span className="font-normal text-slate-500"> · klo {g.time}</span>}
                    {g.location && <span className="font-normal text-slate-500"> · {g.location}</span>}
                  </span>
                  <button type="button" className="min-h-9 px-2 text-sm text-red-700" onClick={() => setGames((cur) => cur.filter((_, j) => j !== i))}>
                    Poista
                  </button>
                </div>
                <TeamNameFields
                  compact
                  value={g.opponent}
                  suggestions={teamNames}
                  label={`Peli ${i + 1}: vastustaja`}
                  onChange={(v) => setGames((cur) => cur.map((x, j) => (j === i ? { ...x, opponent: v } : x)))}
                />
                <PlayedChips
                  value={g.played}
                  onChange={(v) => setGames((cur) => cur.map((x, j) => (j === i ? { ...x, played: v, playedMin: v ? '' : x.playedMin } : x)))}
                  label={`Peli ${i + 1}: pelasiko`}
                  shareText={shareText}
                />
                <div className="flex items-center gap-2">
                  {(['goalsFor', 'goalsAgainst'] as const).map((k, idx) => (
                    <span key={k} className="contents">
                      {idx === 1 && <span className="text-slate-500">–</span>}
                      <input
                        className={`${inputClass} w-14 px-1 text-center`}
                        inputMode="numeric"
                        value={g[k]}
                        aria-label={`Peli ${i + 1}: ${k === 'goalsFor' ? 'tehdyt' : 'päästetyt'}`}
                        onChange={(e) => setGames((cur) => cur.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))}
                      />
                    </span>
                  ))}
                  <input
                    className={`${inputClass} ml-auto w-16 px-1 text-center`}
                    inputMode="numeric"
                    value={g.playerGoals}
                    placeholder="⚽ maalit"
                    aria-label={`Peli ${i + 1}: ${goals}`}
                    onChange={(e) => setGames((cur) => cur.map((x, j) => (j === i ? { ...x, playerGoals: e.target.value } : x)))}
                  />
                  <input
                    className={`${inputClass} w-20 px-2`}
                    inputMode="numeric"
                    value={g.playedMin}
                    placeholder="tarkat min"
                    aria-label={`Peli ${i + 1}: tarkat pelatut minuutit`}
                    onChange={(e) => setGames((cur) => cur.map((x, j) => (j === i ? { ...x, playedMin: e.target.value, played: e.target.value ? '' : x.played } : x)))}
                  />
                </div>
                <input
                  className={inputClass}
                  value={g.note}
                  maxLength={500}
                  placeholder="Kommentti pelistä"
                  aria-label={`Peli ${i + 1}: kommentti`}
                  onChange={(e) => setGames((cur) => cur.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))}
                />
              </div>
            ))}
            <Button variant="secondary" className="w-full" onClick={() => setGames((cur) => [...cur, { opponent: '', goalsFor: '', goalsAgainst: '', playedMin: '', played: '', playerGoals: '', note: '' }])}>
              + peli
            </Button>
            {games.length > 0 && (
              <p className="text-xs text-slate-500">
                Pelien määrä = rivien määrä. Pelattu aika: Koko pelin = pelin pituus, Osan = peliaika-arvio ({shareText}), Ei pelannut = 0; tarkat minuutit ohittavat valinnan ja merkitsemätön peli lasketaan arviolla. Lämmittely ennen jokaista peliä (~15 min) treenin teholla, vaihtopenkki ei kerrytä liikuntaa.
              </p>
            )}
          </>
        )}

        <Field label="Kommentti (päiväkirja)" hint="Lyhyt muistiinpano treenistä tai pelistä; löytyy myöhemmin Jalkapallo → Päiväkirja.">
          <textarea className={`${inputClass} min-h-20 py-2`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} />
        </Field>

        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={saving} className="flex-1">
            Tallenna
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Myöhemmin
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
