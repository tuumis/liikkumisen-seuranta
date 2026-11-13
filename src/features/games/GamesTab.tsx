// Pelit-välilehti: pelikalenteri (tulevat pelit ja turnaukset), tulosta odottavat, tulokset ja
// analyysi sekä omat joukkueet. Tulokset ovat joukkueen tuloksia eivätkä vaikuta lapsen arvioihin.

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { GAME_FORMATS, LEVEL_LABEL } from '../../domain/football';
import type { ActivityType, GameFormat, GameLevel, Profile, Session, Team } from '../../domain/types';
import { repo, type FixtureEntry } from '../../db/repositories';
import { clubKey, parseTeamName } from '../../domain/opponent';
import { LogoPicker, TeamLogo, useClubLogos } from '../../ui/TeamLogo';
import { Button, Card, EmptyState } from '../../ui/components';
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
import { OpponentLibrary } from './TeamLibrary';
import { TeamNameFields, useTeamNameSuggestions } from './TeamNameFields';
import { FootballHero } from './FootballHero';
import { IconPlus } from '../../ui/icons';

type View = 'diary' | 'calendar' | 'results' | 'teams';

const LEVEL_CLASS: Record<GameLevel, string> = {
  elite: 'bg-green-700 text-white ring-green-700',
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

      {/* Selkeät lisäystoiminnot: mitä painike tekee ja milloin sitä käytetään. */}
      <section className="card p-4 sm:p-5" aria-labelledby="fx-add-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="fx-add-title" className="font-display text-lg font-semibold text-slate-900">
            Lisää kalenteriin
          </h2>
          <span className="text-xs text-slate-500">Tulevat pelit näkyvät myös Viikko-näkymässä</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(
            [
              ['game', '🥅', 'Tuleva peli', 'Yksi ottelu: päivä, kellonaika, vastustaja ja taso.'],
              ['tournament', '🏆', 'Tuleva turnaus', 'Useita pelejä: otteluohjelma valmiiksi, tulokset pelien jälkeen.'],
            ] as const
          ).map(([kind, icon, title, text]) => (
            <button
              key={kind}
              type="button"
              onClick={() => setDraft({ kind })}
              className={`press card-interactive flex items-center gap-3 rounded-[1.25rem] p-3 text-left ${kind === 'game' ? 'bg-green-700 text-white shadow-md' : 'card-sunk'}`}
            >
              <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl text-xl ${kind === 'game' ? 'bg-white/15' : 'bg-[var(--surface-raised)] shadow-xs'}`} aria-hidden>
                {icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 font-semibold">
                  <IconPlus size="0.95rem" /> {title}
                </span>
                <span className={`block text-xs leading-snug ${kind === 'game' ? 'text-white/80' : 'text-slate-500'}`}>{text}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">Jo pelatun pelin tai treenin kirjaat Viikko-näkymän +-painikkeella. Kalenterin pelille tulos kirjataan Kalenteri-kohdan "Kirjaa tulos" -painikkeella.</p>
      </section>

      <Segmented<View>
        label="Jalkapallon näkymä"
        value={view}
        onChange={setView}
        options={[
          { value: 'diary', label: 'Päiväkirja' },
          { value: 'calendar', label: 'Kalenteri' },
          { value: 'results', label: 'Tulokset' },
          { value: 'teams', label: 'Joukkueet' },
        ]}
      />

      {view === 'diary' && <DiaryView profile={profile} />}
      {view === 'calendar' && <CalendarView profile={profile} onEdit={(entry) => setDraft({ kind: 'game', entry })} />}
      {view === 'results' && <GamesView profile={profile} />}
      {view === 'teams' && (
        <>
          <TeamsView profile={profile} />
          <OpponentLibrary profile={profile} />
        </>
      )}

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
          <EmptyState art="calendar" title="Kalenteri on tyhjä" compact>
            Lisää tuleva peli tai turnaus yläreunan painikkeista.
          </EmptyState>
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
            <EmptyState art="scoreboard" title="Kaikki tulokset kirjattu" compact>
              Pelatut pelit, joilta tulos puuttuu, tulevat tähän pelipäivän jälkeen.
            </EmptyState>
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
  const [share, setShare] = useState(70); // peliaika-arvio %
  const logos = useClubLogos();
  const logoFor = (n: string) => {
    const c = parseTeamName(n).club;
    return c && /[/·|]/.test(n) ? logos.get(clubKey(c)) : undefined;
  };
  const suggestions = useTeamNameSuggestions(profile.id);
  const club = parseTeamName(name).club.trim();
  // Seuran logo, kun seura on annettu; muuten joukkueen oma kuva.
  const [logo, setLogo] = useState<string | undefined>();
  const [logoTouched, setLogoTouched] = useState(false);
  const shownLogo = logoTouched ? logo : (club && /[/·|]/.test(name) ? logos.get(clubKey(club)) : undefined) ?? photo;

  const open = (t: Team | 'new') => {
    setEditing(t);
    setName(t === 'new' ? '' : t.name);
    setLevel(t === 'new' ? 'kilpa' : t.level);
    setPhoto(t === 'new' ? undefined : t.photo);
    setLogo(undefined);
    setLogoTouched(false);
    setFormat(t === 'new' ? '' : (t.format ?? ''));
    setShare(Math.round((t === 'new' ? 0.7 : (t.playShare ?? 0.7)) * 100));
  };

  async function save() {
    try {
      const hasClub = !!club && /[/·|]/.test(name);
      // Logo seuralle (näkyy kaikissa seuran joukkueissa ja peleissä); ilman seuraa joukkueen kuvaksi.
      if (logoTouched && hasClub) await repo.saveClubLogo(club, logo);
      const teamPhoto = logoTouched && !hasClub ? logo : logoTouched && hasClub ? undefined : photo;
      await repo.saveTeam(profile.id, { name, level, photo: teamPhoto, format: format || undefined, playShare: share === 70 ? undefined : share / 100 }, editing && editing !== 'new' ? editing.id : undefined);
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
          <TeamNameFields own value={name} onChange={setName} suggestions={suggestions} label="Oma joukkue" />
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
          <div>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm font-medium text-slate-700">
              <label htmlFor="team-share">Peliaika-arvio</label>
              <span className="tabular-nums text-slate-900">{share} %</span>
            </div>
            <input id="team-share" type="range" min={30} max={100} step={5} value={share} onChange={(e) => setShare(Number(e.target.value))} className="w-full accent-green-700" />
            <p className="mt-1 text-xs text-slate-500">
              Kuinka suuren osan peliajasta pelaaja on tavallisesti kentällä, kun pelattuja minuutteja ei kirjata. Oletus 70 % (esim. 5v5 ja 7 pelaajan ryhmä: 5/7). Arvio tarkentuu, kun pelin jälkeen merkitset Ei / Osan / Koko pelin.
            </p>
          </div>
          <LogoPicker
            label={club && /[/·|]/.test(name) ? `Seuran logo (${club})` : 'Logo tai joukkuekuva'}
            name={name}
            value={shownLogo}
            onChange={(v) => {
              setLogo(v);
              setLogoTouched(true);
            }}
          />
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
      {teams?.length === 0 && !editing && (
        <EmptyState art="shirt" title="Ei vielä joukkueita" compact>
          Lisää lapsen joukkue, niin se esitäyttyy peleihin.
        </EmptyState>
      )}
      <ul className="divide-y divide-slate-100">
        {teams?.map((t) => (
          <li key={t.id} className={`flex items-center gap-3 py-3 ${t.archived ? 'opacity-50' : ''}`}>
            <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => open(t)} aria-label={`Muokkaa: ${t.name}`}>
              <TeamLogo logo={logoFor(t.name) ?? t.photo} name={t.name} size="lg" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-900">{t.name}</span>
                <span className="mt-0.5 flex items-center gap-1.5">
                  <LevelBadge level={t.level} />
                  {t.format && <span className="text-xs text-slate-500">{t.format}</span>}
                  <span className="text-xs text-slate-500">· peliaika ~{Math.round((t.playShare ?? 0.7) * 100)} %</span>
                </span>
              </span>
              <span className="text-slate-400" aria-hidden>
                ✎
              </span>
            </button>
            <Button variant="ghost" className="px-2" onClick={async () => {
                const next = !t.archived;
                await repo.setTeamArchived(t.id, next);
                toast(next ? `${t.name} arkistoitu` : `${t.name} palautettu`, { label: 'Kumoa', run: () => repo.setTeamArchived(t.id, !next) });
              }}>
              {t.archived ? 'Palauta' : 'Arkistoi'}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
