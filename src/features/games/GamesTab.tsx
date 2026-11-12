// Pelit-välilehti: pelikalenteri (tulevat pelit ja turnaukset), tulosta odottavat, tulokset ja
// analyysi sekä omat joukkueet. Tulokset ovat joukkueen tuloksia eivätkä vaikuta lapsen arvioihin.

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { GAME_FORMATS, LEVEL_LABEL } from '../../domain/football';
import type { ActivityType, GameFormat, GameLevel, Profile, Session, Team } from '../../domain/types';
import { repo, type FixtureEntry } from '../../db/repositories';
import { Avatar, PhotoPicker } from '../../ui/Avatar';
import { Button, Card, inputClass } from '../../ui/components';
import { Segmented, ToggleChip } from '../../ui/controls';
import { dayLabel, formatDate } from '../../ui/format';
import { SKIP_REASON_LABEL } from '../../ui/labels';
import { useToast } from '../../ui/Toast';
import { today as todayFn } from '../../ui/today';
import { FootballPanel } from '../football/FootballPanel';
import { GamesView } from '../football/GamesView';
import { SkipReasons } from '../review/SkipReasons';
import { FixtureSheet, type FixtureDraft } from './FixtureSheet';
import { DiaryView } from './DiaryView';
import { FootballHero } from './FootballHero';
import { IconPlus } from '../../ui/icons';

type View = 'diary' | 'calendar' | 'results' | 'teams';

const LEVEL_CLASS: Record<GameLevel, string> = {
  elite: 'bg-[#244c3b] text-[#f6f5f0] ring-[#244c3b] dark:bg-[#3e8a66] dark:ring-[#3e8a66]',
  kilpa: 'bg-amber-100 text-amber-900 ring-amber-200',
  haaste: 'bg-green-100 text-green-900 ring-green-200',
};

export function LevelBadge({ level }: { level?: GameLevel }) {
  if (!level) return null;
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${LEVEL_CLASS[level]}`}>{LEVEL_LABEL[level]}</span>;
}

export function GamesTab({ profile }: { profile?: Profile }) {
  const [view, setView] = useState<View>('diary');
  const [draft, setDraft] = useState<FixtureDraft | null>(null);
  if (!profile) return <Card>Lisää profiili Asetukset-välilehdellä.</Card>;
  return (
    <div className="space-y-5">
      <FootballHero profile={profile} />
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <Segmented<View>
            label="Pelit"
            value={view}
            onChange={setView}
            options={[
              { value: 'diary', label: 'Päiväkirja' },
              { value: 'calendar', label: 'Kalenteri' },
              { value: 'results', label: 'Tulokset' },
              { value: 'teams', label: 'Joukkueet' },
            ]}
          />
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button className="flex-1 sm:flex-none" onClick={() => setDraft({ kind: 'game' })}>
            <IconPlus size="1rem" /> Peli
          </Button>
          <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => setDraft({ kind: 'tournament' })}>
            <IconPlus size="1rem" /> Turnaus
          </Button>
        </div>
      </div>

      {view === 'diary' && <DiaryView profile={profile} />}
      {view === 'calendar' && <CalendarView profile={profile} onEdit={(entry) => setDraft({ kind: 'game', entry })} />}
      {view === 'results' && <GamesView profile={profile} />}
      {view === 'teams' && <TeamsView profile={profile} />}

      <FixtureSheet profile={profile} draft={draft} onClose={() => setDraft(null)} />
    </div>
  );
}

function CalendarView({ profile, onEdit }: { profile: Profile; onEdit: (e: FixtureEntry) => void }) {
  const today = todayFn();
  const toast = useToast();
  const entries = useLiveQuery(() => repo.listFixtures(profile.id), [profile.id]);
  const teams = useLiveQuery(() => repo.listTeams(profile.id, { includeArchived: true }), [profile.id]);
  const types = useLiveQuery(() => repo.listActivityTypes({ includeArchived: true }), []);
  const [panel, setPanel] = useState<Session | null>(null);
  const [skipping, setSkipping] = useState<string | null>(null);
  const teamById = useMemo(() => new Map((teams ?? []).map((t) => [t.id, t])), [teams]);
  const typeMap = useMemo(() => new Map<string, ActivityType>((types ?? []).map((t) => [t.id, t])), [types]);

  const upcoming = (entries ?? []).filter((e) => e.plan.status === 'open' && e.plan.date >= today);
  const pending = (entries ?? []).filter((e) => e.plan.status === 'open' && e.plan.date < today);
  const skipped = (entries ?? []).filter((e) => e.plan.status === 'skipped').slice(-5).reverse();

  // Kuukausittain ryhmitelty kalenteri.
  const byMonth = new Map<string, FixtureEntry[]>();
  for (const e of upcoming) {
    const k = e.plan.date.slice(0, 7);
    byMonth.set(k, [...(byMonth.get(k) ?? []), e]);
  }

  async function record(e: FixtureEntry) {
    try {
      const r = await repo.confirmPlanned(e.plan.id, today);
      setPanel(r.session);
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
      <Card title={`Tulevat pelit ja turnaukset (${upcoming.length})`}>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-600">Kalenteri on tyhjä. Lisää tuleva peli tai turnaus yläreunan painikkeista.</p>
        ) : (
          <div className="space-y-4">
            {[...byMonth.entries()].map(([month, list]) => (
              <div key={month}>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{formatDate(`${month}-01`, 'LLLL yyyy')}</h3>
                <ul className="space-y-2">
                  {list.map((e) => (
                    <FixtureRow key={e.plan.id} e={e} team={e.fixture?.teamId ? teamById.get(e.fixture.teamId) : undefined} today={today} onClick={() => onEdit(e)} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">Tulevat pelit näkyvät myös Viikko-näkymässä suunnitelmina. Pelin jälkeen kirjaa tulos.</p>
      </Card>

      <div className="space-y-4">
        <Card title={`Odottaa tulosta (${pending.length})`}>
          {pending.length === 0 ? (
            <p className="text-sm text-slate-600">Ei kirjaamattomia pelejä.</p>
          ) : (
            <ul className="space-y-2">
              {pending.map((e) => (
                <li key={e.plan.id} className="card-sunk p-3">
                  <FixtureSummary e={e} team={e.fixture?.teamId ? teamById.get(e.fixture.teamId) : undefined} />
                  {skipping === e.plan.id ? (
                    <div className="mt-2">
                      <SkipReasons
                        onPick={async (r) => {
                          await repo.skipPlanned(e.plan.id, r);
                          setSkipping(null);
                          toast('Merkitty pelaamattomaksi');
                        }}
                        onCancel={() => setSkipping(null)}
                      />
                    </div>
                  ) : (
                    <div className="mt-2 flex gap-2">
                      <Button className="flex-1" onClick={() => record(e)}>
                        Kirjaa tulos
                      </Button>
                      <Button variant="secondary" onClick={() => setSkipping(e.plan.id)}>
                        Ei pelattu
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        {skipped.length > 0 && (
          <Card title="Viimeksi väliin jääneet">
            <ul className="divide-y divide-slate-100 text-sm">
              {skipped.map((e) => (
                <li key={e.plan.id} className="flex justify-between gap-2 py-2">
                  <span className="truncate text-slate-700">
                    {dayLabel(e.plan.date)} · {e.fixture?.opponent ?? e.fixture?.eventName ?? (e.plan.activityTypeId.includes('tournament') ? 'Turnaus' : 'Peli')}
                  </span>
                  <span className="shrink-0 text-slate-500">{e.plan.skipReason ? SKIP_REASON_LABEL[e.plan.skipReason] : 'ei syytä'}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <FootballPanel session={panel} type={panel ? typeMap.get(panel.activityTypeId) : undefined} onClose={() => setPanel(null)} />
    </div>
  );
}

function FixtureSummary({ e, team }: { e: FixtureEntry; team?: Team }) {
  const tournament = e.plan.activityTypeId === 't:football_tournament';
  const f = e.fixture;
  const level = f?.level ?? team?.level;
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden>{tournament ? '🏆' : '🥅'}</span>
        <span className="truncate font-medium text-slate-900">
          {tournament ? f?.eventName ?? 'Turnaus' : `${team?.name ?? 'Oma joukkue'} – ${f?.opponent ?? 'vastustaja ?'}`}
        </span>
        <LevelBadge level={level} />
      </div>
      <div className="mt-0.5 text-xs text-slate-600">
        {dayLabel(e.plan.date)}
        {e.plan.startTime && ` klo ${e.plan.startTime}`} · {e.plan.durationMin} min
        {tournament && team && ` · ${team.name}`}
        {tournament && f?.gamesCount && ` · ${f.gamesCount} peliä`}
        {(f?.format ?? team?.format) && ` · ${f?.format ?? team?.format}`}
        {f?.location && ` · ${f.location}`}
      </div>
      {tournament && f?.games && f.games.length > 0 && (
        <ol className="mt-1 space-y-0.5 text-xs text-slate-600">
          {f.games.map((g, i) => (
            <li key={i}>
              {i + 1}. {g.time && `klo ${g.time} · `}
              {g.opponent ?? 'vastustaja ?'}
              {g.location && ` · ${g.location}`}
            </li>
          ))}
        </ol>
      )}
      {f?.note && <div className="mt-0.5 text-xs text-slate-500">{f.note}</div>}
    </div>
  );
}

function FixtureRow({ e, team, today, onClick }: { e: FixtureEntry; team?: Team; today: string; onClick: () => void }) {
  const days = Math.round((Date.parse(e.plan.date) - Date.parse(today)) / 86_400_000);
  return (
    <li>
      <button type="button" onClick={onClick} className="press card-sunk flex w-full items-center gap-3 p-3 text-left hover:bg-slate-100">
        <div className="w-12 shrink-0 text-center">
          <div className="text-lg font-semibold leading-none text-slate-900">{Number(e.plan.date.slice(8, 10))}</div>
          <div className="text-[11px] uppercase text-slate-500">{formatDate(e.plan.date, 'EEEEEE')}</div>
        </div>
        <div className="min-w-0 flex-1">
          <FixtureSummary e={e} team={team} />
        </div>
        <span className="shrink-0 text-xs text-slate-500">{days === 0 ? 'tänään' : days === 1 ? 'huomenna' : `${days} pv`}</span>
      </button>
    </li>
  );
}

function TeamsView({ profile }: { profile: Profile }) {
  const toast = useToast();
  const teams = useLiveQuery(() => repo.listTeams(profile.id, { includeArchived: true }), [profile.id]);
  const [editing, setEditing] = useState<Team | 'new' | null>(null);
  const [name, setName] = useState('');
  const [level, setLevel] = useState<GameLevel>('kilpa');
  const [photo, setPhoto] = useState<string | undefined>();
  const [format, setFormat] = useState<GameFormat | ''>('');

  const open = (t: Team | 'new') => {
    setEditing(t);
    setName(t === 'new' ? '' : t.name);
    setLevel(t === 'new' ? 'kilpa' : t.level);
    setPhoto(t === 'new' ? undefined : t.photo);
    setFormat(t === 'new' ? '' : (t.format ?? ''));
  };

  async function save() {
    try {
      await repo.saveTeam(profile.id, { name, level, photo, format: format || undefined }, editing && editing !== 'new' ? editing.id : undefined);
      toast('Joukkue tallennettu');
      setEditing(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Card
      title={`Omat joukkueet · ${profile.name}`}
      action={
        <Button variant="ghost" onClick={() => open('new')}>
          + Lisää
        </Button>
      }
    >
      {editing && (
        <form
          className="mb-4 space-y-3 card-sunk p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="esim. P2018 Valkoinen" maxLength={60} autoFocus aria-label="Joukkueen nimi" />
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Sarjataso (oletus peleille)</div>
            <div className="flex flex-wrap gap-2">
              {(['elite', 'kilpa', 'haaste'] as GameLevel[]).map((l) => (
                <ToggleChip key={l} on={level === l} onChange={() => setLevel(l)}>
                  {LEVEL_LABEL[l]}
                </ToggleChip>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">Elite = kovatempoinen (kovempi), Kilpa = reipas (tavallinen), Haaste = kevyempi. Tason voi vaihtaa yksittäiselle pelille tai turnaukselle.</p>
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Pelimuoto (oletus peleille)</div>
            <div className="flex flex-wrap gap-2">
              {GAME_FORMATS.map((f) => (
                <ToggleChip key={f} on={format === f} onChange={() => setFormat(format === f ? '' : f)}>
                  {f}
                </ToggleChip>
              ))}
            </div>
          </div>
          <PhotoPicker label="Joukkuekuva" name={name} value={photo} fallback="👕" onChange={setPhoto} />
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              Tallenna
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Peruuta
            </Button>
          </div>
        </form>
      )}
      {teams?.length === 0 && !editing && <p className="text-sm text-slate-600">Ei vielä joukkueita. Lisää lapsen joukkue, niin se esitäyttyy peleihin.</p>}
      <ul className="divide-y divide-slate-100">
        {teams?.map((t) => (
          <li key={t.id} className={`flex items-center gap-3 py-3 ${t.archived ? 'opacity-50' : ''}`}>
            <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => open(t)} aria-label={`Muokkaa: ${t.name}`}>
              <Avatar name={t.name} photo={t.photo} fallback="👕" size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-900">{t.name}</span>
                <span className="mt-0.5 flex items-center gap-1.5">
                  <LevelBadge level={t.level} />
                  {t.format && <span className="text-xs text-slate-500">{t.format}</span>}
                </span>
              </span>
              <span className="text-slate-400" aria-hidden>
                ✎
              </span>
            </button>
            <Button variant="ghost" className="px-2" onClick={() => repo.setTeamArchived(t.id, !t.archived)}>
              {t.archived ? 'Palauta' : 'Arkistoi'}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
