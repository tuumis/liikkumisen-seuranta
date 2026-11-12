// Tulevan pelin tai turnauksen lisäys ja muokkaus (pelikalenteri).

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { isISODate } from '../../domain/dates';
import { GAME_FORMATS, LEVEL_LABEL } from '../../domain/football';
import { DEFAULT_COOLDOWN_MIN, DEFAULT_WARMUP_MIN, defaultGameLength, tournamentDuration, tournamentEndMin, tournamentStart } from '../../domain/tournamentTime';
import type { GameFormat, GameLevel, Profile } from '../../domain/types';
import { repo, type FixtureEntry, type FixtureInput } from '../../db/repositories';
import { Button, Field, inputClass } from '../../ui/components';
import { TimeField } from '../../ui/TimeField';
import { Segmented, ToggleChip } from '../../ui/controls';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { today as todayFn } from '../../ui/today';

export type FixtureDraft = {
  kind: 'game' | 'tournament';
  entry?: FixtureEntry;
};

const LEVELS: GameLevel[] = ['elite', 'kilpa', 'haaste'];

type ScheduleRow = { time: string; opponent: string; location: string };
const emptyRow = (): ScheduleRow => ({ time: '', opponent: '', location: '' });

export function FixtureSheet({ profile, draft, onClose }: { profile: Profile; draft: FixtureDraft | null; onClose: () => void }) {
  const toast = useToast();
  const teams = useLiveQuery(() => repo.listTeams(profile.id), [profile.id]);
  const names = useLiveQuery(() => repo.footballNameSuggestions(profile.id), [profile.id]);
  const [kind, setKind] = useState<'game' | 'tournament'>('game');
  const [date, setDate] = useState(todayFn());
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('60');
  const [teamId, setTeamId] = useState('');
  const [opponent, setOpponent] = useState('');
  const [eventName, setEventName] = useState('');
  const [gamesCount, setGamesCount] = useState('');
  const [level, setLevel] = useState<GameLevel | ''>('');
  const [format, setFormat] = useState<GameFormat | ''>('');
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  // Turnauksen kesto otteluohjelmasta (aktiivinen aika): pelit × (lämmittely + pelin pituus) + loppuverryttely.
  const [auto, setAuto] = useState(true);
  const [gameLen, setGameLen] = useState(''); // tyhjä = pelimuodon oletus
  const [warmup, setWarmup] = useState(String(DEFAULT_WARMUP_MIN));
  const [cooldown, setCooldown] = useState(String(DEFAULT_COOLDOWN_MIN));
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!draft) return;
    const { plan, fixture: f } = draft.entry ?? {};
    const k = plan ? (plan.activityTypeId === 't:football_tournament' ? 'tournament' : 'game') : draft.kind;
    setKind(k);
    setDate(plan?.date ?? todayFn());
    setTime(plan?.startTime ?? '');
    setDuration(String(plan?.durationMin ?? (k === 'tournament' ? 300 : 60)));
    setTeamId(f?.teamId ?? '');
    setOpponent(f?.opponent ?? '');
    setEventName(f?.eventName ?? '');
    setGamesCount(f?.gamesCount ? String(f.gamesCount) : '');
    setLevel(f?.level ?? '');
    setFormat(f?.format ?? '');
    setLocation(f?.location ?? '');
    setNote(f?.note ?? '');
    setSchedule(
      (f?.games ?? []).map((g) => ({
        time: g.time ?? '',
        opponent: g.opponent ?? '',
        location: g.location ?? '',
      })),
    );
    setAuto(!f?.durationManual);
    setGameLen(f?.gameLengthMin !== undefined ? String(f.gameLengthMin) : '');
    setWarmup(String(f?.warmupMin ?? DEFAULT_WARMUP_MIN));
    setCooldown(String(f?.cooldownMin ?? DEFAULT_COOLDOWN_MIN));
    setError(undefined);
    setConfirmDelete(false);
  }, [draft]);

  // Uudelle tapahtumalle oletusjoukkue, jos joukkueita on vain yksi.
  useEffect(() => {
    if (draft && !draft.entry && teams?.length === 1) setTeamId((t) => t || teams[0].id);
  }, [draft, teams]);

  if (!draft) return null;
  const team = teams?.find((t) => t.id === teamId);
  const editing = !!draft.entry;

  const rowsNow = schedule.filter((g) => g.time || g.opponent.trim() || g.location.trim());
  const gamesN = rowsNow.length || (/^\d+$/.test(gamesCount.trim()) ? Number(gamesCount) : 0);
  const num = (s: string, d: number) => (/^\d{1,3}$/.test(s.trim()) ? Number(s) : d);
  const effFormat = format || team?.format || undefined;
  const timing = {
    games: gamesN,
    gameLengthMin: num(gameLen, defaultGameLength(effFormat)),
    warmupMin: num(warmup, DEFAULT_WARMUP_MIN),
    cooldownMin: num(cooldown, DEFAULT_COOLDOWN_MIN),
  };
  const autoOn = kind === 'tournament' && auto && gamesN > 0;
  const autoDuration = tournamentDuration(timing);
  const autoStart = autoOn ? tournamentStart(rowsNow, timing.warmupMin) : undefined;
  const autoEnd = autoOn ? tournamentEndMin(rowsNow, timing.gameLengthMin, timing.cooldownMin) : undefined;
  const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  async function save() {
    const dur = autoOn ? autoDuration : Number(duration);
    if (!isISODate(date)) return setError('Valitse päivä');
    if (!Number.isInteger(dur) || dur < 1 || dur > 1440) return setError('Tarkista kesto (min)');
    const rows = schedule.filter((g) => g.time || g.opponent.trim() || g.location.trim());
    const gc = rows.length ? rows.length : gamesCount.trim() === '' ? undefined : Number(gamesCount);
    if (gc !== undefined && (!Number.isInteger(gc) || gc < 1 || gc > 20)) return setError('Tarkista pelien määrä');
    const input: FixtureInput = {
      kind,
      date,
      startTime: autoStart ?? (time || undefined),
      durationMin: dur,
      gameLengthMin: gameLen.trim() === '' ? undefined : timing.gameLengthMin,
      warmupMin: timing.warmupMin,
      cooldownMin: timing.cooldownMin,
      durationManual: kind === 'tournament' && !auto ? true : undefined,
      teamId: teamId || undefined,
      opponent: kind === 'game' ? opponent : undefined,
      eventName: kind === 'tournament' ? eventName : undefined,
      gamesCount: kind === 'tournament' ? gc : undefined,
      games:
        kind === 'tournament'
          ? rows.map((g) => ({
              time: g.time || undefined,
              opponent: g.opponent,
              location: g.location,
            }))
          : undefined,
      level: level || undefined,
      format: format || undefined,
      location,
      note,
    };
    try {
      if (draft!.entry) await repo.updateFixture(draft!.entry.plan.id, input);
      else await repo.createFixture(profile.id, input);
      toast(editing ? 'Muutokset tallennettu' : kind === 'game' ? 'Peli lisätty kalenteriin' : 'Turnaus lisätty kalenteriin');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove() {
    if (!draft?.entry) return;
    if (!confirmDelete) return setConfirmDelete(true);
    try {
      await repo.deleteFixture(draft.entry.plan.id);
      toast('Poistettu kalenterista');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Sheet open onClose={onClose} title={editing ? 'Muokkaa' : kind === 'game' ? 'Uusi peli' : 'Uusi turnaus'}>
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Segmented
          label="Tyyppi"
          value={kind}
          onChange={(k) => {
            setKind(k);
            if (!editing) setDuration(k === 'tournament' ? '300' : '60');
          }}
          options={[
            { value: 'game', label: '🥅 Peli' },
            { value: 'tournament', label: '🏆 Turnaus' },
          ]}
        />
        <div className="grid grid-cols-3 gap-2">
          <Field label="Päivä">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={autoStart ? 'Saapuminen' : 'Kello'}>
            {autoStart ? (
              <div className="field-shell flex min-h-11 items-center justify-center text-base tabular-nums text-slate-700" title="1. peli − lämmittely">
                {autoStart}
              </div>
            ) : (
              <TimeField label="Kello" value={time} onChange={setTime} />
            )}
          </Field>
          <Field label="Kesto (min)">
            {autoOn ? (
              <div className="field-shell flex min-h-11 items-center justify-center text-base tabular-nums text-slate-700" title="Laskettu otteluohjelmasta">
                {autoDuration}
              </div>
            ) : (
              <input className={inputClass} inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />
            )}
          </Field>
        </div>

        <Field label="Oma joukkue">
          <select className={inputClass} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">{teams?.length ? '– valitse –' : 'Lisää joukkue Joukkueet-osiossa'}</option>
            {teams?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({LEVEL_LABEL[t.level]})
              </option>
            ))}
          </select>
        </Field>

        {kind === 'game' ? (
          <Field label="Vastustaja">
            <input className={inputClass} value={opponent} onChange={(e) => setOpponent(e.target.value)} list="fx-opponents" maxLength={60} />
            <datalist id="fx-opponents">
              {names?.opponents.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </Field>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Field label="Turnauksen nimi">
                <input className={inputClass} value={eventName} onChange={(e) => setEventName(e.target.value)} list="fx-events" maxLength={60} />
                <datalist id="fx-events">
                  {names?.events.map((o) => (
                    <option key={o} value={o} />
                  ))}
                </datalist>
              </Field>
            </div>
            <Field label="Pelejä">
              {schedule.length ? (
                <div className="flex min-h-11 items-center px-1 text-sm tabular-nums text-slate-700">{schedule.length}</div>
              ) : (
                <input className={inputClass} inputMode="numeric" value={gamesCount} onChange={(e) => setGamesCount(e.target.value)} placeholder="esim. 4" />
              )}
            </Field>
          </div>
        )}

        {kind === 'tournament' && (
          <div className="card-sunk p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-800">Otteluohjelma</span>
              <Button
                variant="ghost"
                onClick={() =>
                  setSchedule((cur) => {
                    // Lisätään useita kerralla, jos pelimäärä on jo annettu.
                    const n = cur.length === 0 && Number(gamesCount) > 1 && Number(gamesCount) <= 20 ? Number(gamesCount) : 1;
                    return [...cur, ...Array.from({ length: n }, emptyRow)];
                  })
                }
              >
                + ottelu
              </Button>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">Valinnainen. Pelit näkyvät valmiina, kun turnaus kuitataan: lisää vain tulokset ja kommentit.</p>
            {schedule.length > 0 && (
              <ul className="mt-2 space-y-2">
                {schedule.map((g, i) => (
                  <li key={i} className="grid grid-cols-[7rem_1fr_auto] items-center gap-2">
                    <TimeField
                      label={`Ottelu ${i + 1}: kello`}
                      value={g.time}
                      onChange={(t) => setSchedule((cur) => cur.map((x, j) => (j === i ? { ...x, time: t } : x)))}
                    />
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      <input
                        className={inputClass}
                        value={g.opponent}
                        list="fx-opponents"
                        maxLength={60}
                        placeholder="Vastustaja"
                        aria-label={`Ottelu ${i + 1}: vastustaja`}
                        onChange={(e) => setSchedule((cur) => cur.map((x, j) => (j === i ? { ...x, opponent: e.target.value } : x)))}
                      />
                      <input
                        className={inputClass}
                        value={g.location}
                        maxLength={40}
                        placeholder="Kenttä"
                        aria-label={`Ottelu ${i + 1}: kenttä`}
                        onChange={(e) => setSchedule((cur) => cur.map((x, j) => (j === i ? { ...x, location: e.target.value } : x)))}
                      />
                    </div>
                    <button
                      type="button"
                      className="min-h-11 min-w-11 rounded-xl text-slate-500 ring-1 ring-slate-300"
                      aria-label={`Poista ottelu ${i + 1}`}
                      onClick={() => setSchedule((cur) => cur.filter((_, j) => j !== i))}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <datalist id="fx-opponents">
              {names?.opponents.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
        )}

        {kind === 'tournament' && (
          <div className="card-sunk p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <input type="checkbox" className="size-4 accent-green-700" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              Laske kesto otteluohjelmasta
            </label>
            {auto && (
              <>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Field label="Peli (min)">
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      value={gameLen}
                      placeholder={String(defaultGameLength(effFormat))}
                      onChange={(e) => setGameLen(e.target.value)}
                      aria-describedby="fx-timing"
                    />
                  </Field>
                  <Field label="Lämmittely">
                    <input className={inputClass} inputMode="numeric" value={warmup} onChange={(e) => setWarmup(e.target.value)} aria-describedby="fx-timing" />
                  </Field>
                  <Field label="Verryttely">
                    <input className={inputClass} inputMode="numeric" value={cooldown} onChange={(e) => setCooldown(e.target.value)} aria-describedby="fx-timing" />
                  </Field>
                </div>
                <p id="fx-timing" className="mt-2 text-xs leading-snug text-slate-600">
                  {gamesN > 0 ? (
                    <>
                      <strong className="tabular-nums text-slate-800">
                        {gamesN} × ({timing.warmupMin} + {timing.gameLengthMin}){timing.cooldownMin ? ` + ${timing.cooldownMin}` : ''} = {autoDuration} min
                      </strong>{' '}
                      aktiivista aikaa (lämmittely ennen jokaista peliä, verryttely lopuksi){autoStart && autoEnd !== undefined ? ` · paikalla ${autoStart}–${hhmm(autoEnd)}` : ''}. Pelien väliset odotukset eivät kasvata kestoa (eivätkä tehoarviota).
                      {gameLen.trim() === '' && (effFormat ? ` Pelin pituus on pelimuodon ${effFormat} oletus.` : ' Pelin pituus on oletus; valitse pelimuoto tai anna pituus.')}
                    </>
                  ) : (
                    'Lisää otteluohjelma tai pelien määrä, niin kesto lasketaan.'
                  )}
                </p>
              </>
            )}
          </div>
        )}

        <div>
          <div className="mb-1 text-sm font-medium text-slate-700">Taso</div>
          <div className="flex flex-wrap gap-2">
            <ToggleChip on={level === ''} onChange={() => setLevel('')}>
              {team ? `Joukkueen taso (${LEVEL_LABEL[team.level]})` : 'Ei tasoa'}
            </ToggleChip>
            {LEVELS.map((l) => (
              <ToggleChip key={l} on={level === l} onChange={() => setLevel(l)}>
                {LEVEL_LABEL[l]}
              </ToggleChip>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">Taso säätää tehoarviota: Elite = kovempi, Kilpa = tavallinen, Haaste = kevyempi.</p>
        </div>

        <div>
          <div className="mb-1 text-sm font-medium text-slate-700">Pelimuoto</div>
          <div className="flex flex-wrap gap-2">
            <ToggleChip on={format === ''} onChange={() => setFormat('')}>
              {team?.format ? `Joukkueen (${team.format})` : 'Ei valittu'}
            </ToggleChip>
            {GAME_FORMATS.map((f) => (
              <ToggleChip key={f} on={format === f} onChange={() => setFormat(f)}>
                {f}
              </ToggleChip>
            ))}
          </div>
        </div>

        <Field label="Paikka (valinnainen)">
          <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} maxLength={80} placeholder="esim. Kenttä 2" />
        </Field>
        <Field label="Muistiinpano">
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </Field>

        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" className="flex-1">
            {editing ? 'Tallenna' : 'Lisää kalenteriin'}
          </Button>
          {editing && (
            <button
              type="button"
              onClick={remove}
              className={`min-h-11 rounded-xl px-3 text-sm font-medium ring-1 ${confirmDelete ? 'bg-red-700 text-white ring-red-700' : 'bg-[var(--surface-raised)] text-red-700 ring-red-200'}`}
            >
              {confirmDelete ? 'Vahvista' : 'Poista'}
            </button>
          )}
        </div>
      </form>
    </Sheet>
  );
}
