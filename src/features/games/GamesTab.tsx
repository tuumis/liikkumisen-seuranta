// Pelit-välilehti: pelikalenteri (tulevat pelit ja turnaukset), tulosta odottavat, tulokset ja
// analyysi sekä omat joukkueet. Tulokset ovat joukkueen tuloksia eivätkä vaikuta lapsen arvioihin.

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Sheet } from '../../ui/Sheet';
import { useLiveQuery } from 'dexie-react-hooks';
import { GAME_FORMATS, HOME_AWAY_LABEL, LEVEL_LABEL } from '../../domain/football';
import type { ActivityType, GameFormat, GameLevel, ISODate, Profile, Session, Team } from '../../domain/types';
import { gameDaySchedule } from '../../domain/tournamentTime';
import { repo, type FixtureEntry } from '../../db/repositories';
import { clubKey, displayTeamName, parseTeamName } from '../../domain/opponent';
import { opponentHistory } from '../../domain/opponentLibrary';
import { historyLine, useGameRows } from './OpponentHistory';
import { Flag, OriginFields } from '../../ui/Flag';
import { clubFor, clubNameOf, LogoPicker, TeamLogo, useClubLogos, useClubs } from '../../ui/TeamLogo';
import { Button, Card, EmptyState, Field, inputClass } from '../../ui/components';
import { Segmented, ToggleChip } from '../../ui/controls';
import { dayLabel, formatDate } from '../../ui/format';
import { SKIP_REASON_LABEL } from '../../ui/labels';
import { useToast } from '../../ui/Toast';
import { today as todayFn } from '../../ui/today';
import { GameDayCard } from './TournamentDay';
import { FootballPanel } from '../football/FootballPanel';
import { GamesView } from '../football/GamesView';
import { SkipReasons } from '../review/SkipReasons';
import { FixtureSheet, fixtureKindOf, type FixtureDraft, type FixtureKind } from './FixtureSheet';
import { MonthCalendar } from './MonthCalendar';
import { CalendarPrint } from './CalendarPrint';
import { IcsExport } from './IcsExport';
import { monthKeyOf, type MonthKey } from '../../domain/monthCalendar';
import { useStoredChoice } from '../../ui/storedPref';
import { DiaryView } from './DiaryView';
import { OpponentLibrary } from './TeamLibrary';
import { TeamNameFields, useTeamNameSuggestions } from './TeamNameFields';
import { FootballHero } from './FootballHero';
import { FootballTabs } from './FootballTabs';
import { TeamBreakdownCard } from '../football/TeamBreakdownCard';
import { UnassignedTrainings } from '../football/TrainingTeam';
import { IconCalendarClock, IconPencil, IconPlus, IconReport, IconShare, IconWarning } from '../../ui/icons';
import { InfoLink, SHARE_PILL } from '../../ui/InfoLink';
import { openPreviewShare } from '../share/PreviewShare';
import { playSound } from '../../ui/sound';
import { holdHeader } from '../../ui/useCompactHeader';

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
  const [view, setViewState] = useState<View>('diary');
  // Kerran avatut näkymät pysyvät taustalla valmiina: vaihto ei näytä latautumista (sivu ei hetkeksi lyhene).
  const [visited, setVisited] = useState<ReadonlySet<View>>(() => new Set(['diary']));
  // Puhelimella ja tabletilla välilehdet ovat sivun ylimpänä ja kiinnittyvät yläpalkin alle (19.11. / 26.11.2026).
  // Välilehden valinta vierittää sivun niin, että näkymän alku on heti välilehtien alla (kausikortin ja pelipäivän
  // kortin ohi); ne näkyvät vierittämällä ylös.
  const tabsRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // PC:llä välilehdet kiinnittyvät sivun yläreunaan vieritettäessä (27.11.2026); sivua siirretään vain, kun ne ovat jo
  // kiinni (kausikortti jää näkyviin, kun välilehteä vaihdetaan sivun alussa).
  const setView = (v: View) => {
    const el = tabsRef.current;
    const content = contentRef.current;
    const stickTop = el ? parseFloat(getComputedStyle(el).top) || 0 : 0;
    const pc = typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 64rem)').matches;
    if (el && content && getComputedStyle(el).position === 'sticky' && (!pc || el.getBoundingClientRect().top <= stickTop + 1)) {
      const target = content.getBoundingClientRect().top + window.scrollY - stickTop - el.offsetHeight - 8;
      holdHeader();
      window.scrollTo({ top: Math.max(0, target) });
      // Tarkennus piirron jälkeen: näkymän alku tarkalleen välilehtien alle.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const d = content.getBoundingClientRect().top - el.getBoundingClientRect().bottom - 8;
          if (Math.abs(d) > 1 && window.scrollY > 0) {
            holdHeader();
            window.scrollBy({ top: d });
          }
        }),
      );
    }
    setVisited((s) => (s.has(v) ? s : new Set([...s, v])));
    setViewState(v);
  };
  const [draft, setDraft] = useState<FixtureDraft | null>(null);
  const [adding, setAdding] = useState(false);
  if (!profile) return <Card>Lisää profiili Asetukset-välilehdellä.</Card>;
  return (
    <div className="flex flex-col gap-5">
      <FootballHero profile={profile} onOpen={(entry) => setDraft({ kind: 'game', entry })} onAdd={() => setDraft({ kind: 'game' })} />
      {/* Pelipäivän pikakirjaus myös täällä (24.11.2026, käyttäjän valinta). */}
      <GameDayCard profile={profile} today={todayFn()} />

      {/* Lisää kalenteriin -painike avaa valinnat (peli, harjoituspeli, turnaus). PC:llä painike on välilehtien rivillä
          (27.11.2026; aiemmin oma kortti), puhelimella ja tabletilla tässä. */}
      <Button className="w-full shadow-md lg:hidden" onClick={() => setAdding(true)}>
        <IconPlus size="1.05rem" /> Lisää kalenteriin
      </Button>
      <Sheet open={adding} onClose={() => setAdding(false)} title="Lisää kalenteriin">
        <AddChoices
          className="grid gap-2"
          onPick={(kind) => {
            setAdding(false);
            setDraft({ kind });
          }}
        />
        <p className="mt-3 text-[13px] leading-relaxed text-slate-500">{ADD_HINT} Tulevat pelit näkyvät myös Viikko-näkymässä.</p>
      </Sheet>

      <div
        ref={tabsRef}
        className="sticky top-[var(--mobile-header-h,0px)] z-10 order-first lg:top-[var(--titlebar-h,0px)] -mx-4 lg:order-none bg-[color-mix(in_oklab,var(--bg)_82%,transparent)] px-4 py-2 backdrop-blur-xl lg:-mx-3 lg:rounded-b-2xl lg:px-3 lg:pb-1 lg:pt-1.5"
      >
        <div className="hidden lg:block">
          <FootballTabs profile={profile} value={view} onChange={setView} onAdd={() => setAdding(true)} />
        </div>
        <div className="lg:hidden">
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
        </div>
      </div>

      {/* Vähintään näytön korkuinen: lyhyempi näkymä ei vedä vierityskohtaa ylös, joten valitsin pysyy paikallaan. */}
      <div ref={contentRef} className="min-h-screen">
        {visited.has('diary') && (
          <div hidden={view !== 'diary'}>
            <DiaryView profile={profile} />
          </div>
        )}
        {visited.has('calendar') && (
          <div hidden={view !== 'calendar'}>
            <CalendarView profile={profile} onEdit={(entry) => setDraft({ kind: 'game', entry })} onAdd={(kind, date) => setDraft({ kind, date })} />
          </div>
        )}
        {visited.has('results') && (
          <div hidden={view !== 'results'}>
            <GamesView profile={profile} />
          </div>
        )}
        {visited.has('teams') && (
          <div hidden={view !== 'teams'} className="space-y-5">
            <TeamsView profile={profile} />
            <TeamBreakdownCard profile={profile} />
            <OpponentLibrary profile={profile} />
          </div>
        )}
      </div>

      <FixtureSheet profile={profile} draft={draft} onClose={() => setDraft(null)} />
    </div>
  );
}

const ADD_HINT = 'Jo pelatun pelin tai treenin kirjaat Viikko-näkymän +‑painikkeella. Kalenterin pelille tulos kirjataan Kalenteri-kohdan "Kirjaa tulos" -painikkeella.';

/** Tulevan pelin, harjoituspelin ja turnauksen lisäysvalinnat (PC:llä sivulla, puhelimella valikossa). */
function AddChoices({ className, onPick }: { className: string; onPick: (kind: FixtureKind) => void }) {
  return (
    <div className={className}>
      {(
        [
          ['game', '⚽', 'Tuleva peli', 'Yksi ottelu: päivä, kellonaika, vastustaja ja taso.'],
          ['friendly', '🤝', 'Tuleva harjoituspeli', 'Pelitälli yhtä tai useampaa joukkuetta vastaan; tulos ei tilastoihin.'],
          ['tournament', '🏆', 'Tuleva turnaus', 'Useita pelejä: otteluohjelma valmiiksi, tulokset pelien jälkeen.'],
        ] as const
      ).map(([kind, icon, title, text]) => (
        <button
          key={kind}
          type="button"
          onClick={() => onPick(kind)}
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
  );
}

function CalendarView({ profile, onEdit, onAdd }: { profile: Profile; onEdit: (e: FixtureEntry) => void; onAdd: (kind: FixtureKind, date: ISODate) => void }) {
  const today = todayFn();
  // Lista | Kuukausi (18.11.2026): valinta muistetaan laitteella; lista on oletus.
  const [mode, setMode] = useStoredChoice<'list' | 'month'>('calendarMode', ['list', 'month'], 'list');
  // Kuukausinäkymän kuukausi; myös tulosteen ja kalenteriviennin alkukuukausi (19.11.2026).
  const [month, setMonth] = useState<MonthKey>(() => monthKeyOf(today));
  const [printing, setPrinting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const toast = useToast();
  const entries = useLiveQuery(() => repo.listFixtures(profile.id), [profile.id]);
  const teams = useLiveQuery(() => repo.listTeams(profile.id, { includeArchived: true }), [profile.id]);
  const types = useLiveQuery(() => repo.listActivityTypes({ includeArchived: true }), []);
  const [panel, setPanel] = useState<Session | null>(null);
  const [skipping, setSkipping] = useState<string | null>(null);
  const teamById = useMemo(() => new Map((teams ?? []).map((t) => [t.id, t])), [teams]);
  const typeMap = useMemo(() => new Map<string, ActivityType>((types ?? []).map((t) => [t.id, t])), [types]);
  const gameHistory = useGameRows(profile.id);
  const history = (opponent: string | undefined) => (gameHistory ? historyLine(opponentHistory(gameHistory, opponent)) : undefined);

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
      if (r.created) playSound('confirm');
      setPanel(r.session);
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err));
    }
  }

  // Odottaa tulosta ja väliin jääneet (27.11.2026): kuukausinäkymässä leveänä kalenterin sivusarakkeessa
  // valitun päivän alla (side), muuten omina kortteinaan kalenterin alla. Leveysraja sama säiliö (fcal) kuin kalenterissa.
  const resultCards = (side: boolean) => (
      <>
        <ResultBox side={side} title={`Odottaa tulosta (${pending.length})`}>
          {!entries ? (
            <div className="skeleton h-24 rounded-2xl" aria-busy="true" aria-label="Ladataan" />
          ) : pending.length === 0 ? (
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
                        onPick={async (r, note) => {
                          await repo.skipPlanned(e.plan.id, r, note);
                          setSkipping(null);
                          toast('Merkitty pelaamattomaksi');
                        }}
                        onCancel={() => setSkipping(null)}
                      />
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-2">
                      <Button className="flex-1" onClick={() => record(e)}>
                        Kirjaa tulos
                      </Button>
                      {e.fixture?.link && <InfoLink href={e.fixture.link} compact />}
                      <Button variant="secondary" onClick={() => setSkipping(e.plan.id)}>
                        Ei pelattu
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ResultBox>
        {skipped.length > 0 && (
          <ResultBox side={side} title="Viimeksi väliin jääneet">
            <ul className="divide-y divide-slate-100 text-sm">
              {skipped.map((e) => (
                <li key={e.plan.id} className="py-2">
                  <div className="flex justify-between gap-2">
                    <span className="truncate text-slate-700">
                      {dayLabel(e.plan.date)} ·{' '}
                      {e.fixture?.opponent ??
                        e.fixture?.eventName ??
                        (fixtureKindOf(e.plan.activityTypeId) === 'tournament' ? 'Turnaus' : fixtureKindOf(e.plan.activityTypeId) === 'friendly' ? 'Harjoituspeli' : 'Peli')}
                    </span>
                    <span className="shrink-0 text-slate-500">{e.plan.skipReason ? SKIP_REASON_LABEL[e.plan.skipReason] : 'ei syytä'}</span>
                  </div>
                  {e.plan.skipNote && <span className="block text-xs italic text-slate-600">“{e.plan.skipNote}”</span>}
                </li>
              ))}
            </ul>
          </ResultBox>
        )}
      </>
  );

  return (
    <div className="@container/fcal space-y-4">
      {/* Puhelimessa yksi rivi (26.11.2026): valitsin täyttää rivin ja toiminnot ovat kuvakepainikkeina; leveämmällä tekstein. */}
      <div className="flex items-center gap-2 sm:flex-wrap">
        <div className="min-w-0 flex-1 sm:w-full sm:max-w-xs sm:basis-56">
          <Segmented<'list' | 'month'>
            label="Kalenterin esitystapa"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'list', label: 'Lista' },
              { value: 'month', label: 'Kuukausi' },
            ]}
          />
        </div>
        <div className="ml-auto flex shrink-0 gap-2">
          <Button variant="secondary" className="w-11 !px-0 sm:w-auto sm:!px-4" aria-label="Tulosta" title="Tulosta" onClick={() => setPrinting(true)}>
            <IconReport size="1.1rem" /> <span className="hidden sm:inline">Tulosta</span>
          </Button>
          <Button variant="secondary" className="w-11 !px-0 sm:w-auto sm:!px-4" aria-label="Vie kalenteriin" title="Vie kalenteriin" onClick={() => setExporting(true)}>
            <IconCalendarClock size="1.1rem" /> <span className="hidden sm:inline">Vie kalenteriin</span>
          </Button>
        </div>
      </div>
      {mode === 'month' && <MonthCalendar profile={profile} today={today} month={month} onMonth={setMonth} onEdit={onEdit} onAdd={onAdd} onOpenSession={setPanel} side={resultCards(true)} />}
      {printing && <CalendarPrint profile={profile} today={today} startMonth={mode === 'month' ? month : monthKeyOf(today)} onClose={() => setPrinting(false)} />}
      <IcsExport profile={profile} today={today} startMonth={mode === 'month' ? month : monthKeyOf(today)} open={exporting} onClose={() => setExporting(false)} />
    <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
      {mode === 'list' && (
      <Card title={`Tulevat pelit ja turnaukset (${upcoming.length})`}>
        {!entries ? (
          <div className="skeleton h-24 rounded-2xl" aria-busy="true" aria-label="Ladataan" />
        ) : upcoming.length === 0 ? (
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
                    <FixtureRow key={e.plan.id} e={e} team={e.fixture?.teamId ? teamById.get(e.fixture.teamId) : undefined} today={today} history={history} onClick={() => onEdit(e)} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">Tulevat pelit näkyvät myös Viikko-näkymässä suunnitelmina. Pelin jälkeen kirjaa tulos.</p>
      </Card>
      )}

      <div className={`space-y-4 ${mode === 'month' ? '@min-[67rem]/fcal:hidden' : ''}`}>
        {resultCards(false)}
      </div>

      <FootballPanel session={panel} type={panel ? typeMap.get(panel.activityTypeId) : undefined} onClose={() => setPanel(null)} />
    </div>
    </div>
  );
}

/** Kortti tai (kalenterin sivusarakkeessa) otsikoitu osio ilman korttikehystä. */
function ResultBox({ side, title, children }: { side: boolean; title: string; children: ReactNode }) {
  if (!side) return <Card title={title}>{children}</Card>;
  return (
    <section className="mt-5 border-t border-slate-100 pt-3" aria-label={title}>
      <h3 className="mb-2 text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  );
}

/** Loppuaika alusta ja kestosta (harjoituspeli). */
function endOf(start: string, durationMin: number): string {
  const m = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5)) + durationMin;
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** "Tietoja puuttuu" -merkki (17.11.2026); kuvaus näkyy merkissä ja vihjeenä. */
export function MissingBadge({ f }: { f?: { infoMissing?: boolean; missingNote?: string } }) {
  if (!f?.infoMissing) return null;
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200" title={f.missingNote}>
      <IconWarning size="0.8rem" className="shrink-0" />
      <span className="truncate">Tietoja puuttuu{f.missingNote ? `: ${f.missingNote}` : ''}</span>
    </span>
  );
}

function FixtureSummary({ e, team, history }: { e: FixtureEntry; team?: Team; history?: (opponent: string | undefined) => string | undefined }) {
  const kind = fixtureKindOf(e.plan.activityTypeId);
  const tournament = kind === 'tournament';
  const friendly = kind === 'friendly';
  const f = e.fixture;
  const level = f?.level;
  const opponentsText = (f?.games ?? []).map((g) => g.opponent).filter(Boolean).join(', ');
  const endText = e.plan.startTime ? endOf(e.plan.startTime, e.plan.durationMin) : undefined;
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden>{tournament ? '🏆' : friendly ? '🤝' : '⚽'}</span>
        {friendly && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-sky-950 ring-1 ring-sky-200">Harjoituspeli</span>}
        <span className="truncate font-medium text-slate-900">
          {tournament
            ? f?.eventName ?? 'Turnaus'
            : friendly
              ? `${team?.name ?? 'Oma joukkue'} – ${opponentsText || 'vastustaja ?'}`
              : `${team?.name ?? 'Oma joukkue'} – ${f?.opponent ?? 'vastustaja ?'}`}
        </span>
        <LevelBadge level={level} />
        <MissingBadge f={f} />
      </div>
      <div className="mt-0.5 text-xs text-slate-600">
        {dayLabel(e.plan.date)}
        {e.plan.startTime &&
          (tournament
            ? f?.games?.some((g) => g.time) && !f.durationManual
              ? ` · paikalla ${e.plan.startTime}`
              : ` klo ${e.plan.startTime}`
            : friendly
              ? ` klo ${e.plan.startTime}–${endText}`
              : ` klo ${e.plan.startTime} (paikalla ${gameDaySchedule(e.plan.startTime, f?.warmupMin).arrival})`)}{' '}
        · {e.plan.durationMin} min
        {tournament && team && ` · ${team.name}`}
        {tournament && f?.gamesCount && ` · ${f.gamesCount} peliä`}
        {f?.series && ` · ${f.series}`}
        {(f?.format ?? team?.format) && ` · ${f?.format ?? team?.format}`}
        {f?.homeAway && ` · ${HOME_AWAY_LABEL[f.homeAway]}`}
        {f?.location && ` · ${f.location}`}
      </div>
      {!tournament && !friendly && history?.(f?.opponent) && <div className="mt-0.5 text-xs text-slate-500">{history(f?.opponent)}</div>}
      {tournament && f?.games && f.games.length > 0 && (
        <ol className="mt-1 space-y-0.5 text-xs text-slate-600">
          {f.games.map((g, i) => (
            <li key={i}>
              {i + 1}. {g.time && `klo ${g.time} · `}
              {g.opponent ?? 'vastustaja ?'}
              {g.location && ` · ${g.location}`}
              {g.homeAway && ` · ${HOME_AWAY_LABEL[g.homeAway]}`}
              {history?.(g.opponent) && <span className="block pl-3 text-slate-500">{history(g.opponent)}</span>}
            </li>
          ))}
        </ol>
      )}
      {f?.note && <div className="mt-0.5 text-xs text-slate-500">{f.note}</div>}
    </div>
  );
}

function FixtureRow({ e, team, today, history, onClick }: { e: FixtureEntry; team?: Team; today: string; history?: (opponent: string | undefined) => string | undefined; onClick: () => void }) {
  const days = Math.round((Date.parse(e.plan.date) - Date.parse(today)) / 86_400_000);
  return (
    <li className="relative">
      <button type="button" onClick={onClick} className="press card-sunk flex w-full items-center gap-3 p-3 pb-12 text-left hover:bg-slate-100">
        <div className="w-12 shrink-0 text-center">
          <div className="text-lg font-semibold leading-none text-slate-900">{Number(e.plan.date.slice(8, 10))}</div>
          <div className="text-[11px] uppercase text-slate-500">{formatDate(e.plan.date, 'EEEEEE')}</div>
        </div>
        <div className="min-w-0 flex-1">
          <FixtureSummary e={e} team={team} history={history} />
        </div>
        <span className="shrink-0 self-start text-xs text-slate-500">{days === 0 ? 'tänään' : days === 1 ? 'huomenna' : `${days} pv`}</span>
      </button>
      <div className="absolute bottom-2 right-2 flex items-center gap-2">
        {e.fixture?.link && <InfoLink href={e.fixture.link} />}
        <button
          type="button"
          onClick={() => openPreviewShare(e.plan.id)}
          className={`${SHARE_PILL} min-h-9`}
          title="Ennakko kuvana tai videona (esim. Instagram)"
        >
          <IconShare size="0.9rem" /> Ennakko
        </button>
      </div>
    </li>
  );
}

function TeamsView({ profile }: { profile: Profile }) {
  const toast = useToast();
  const teams = useLiveQuery(() => repo.listTeams(profile.id, { includeArchived: true, groups: true }), [profile.id]);
  const [editing, setEditing] = useState<Team | 'new' | null>(null);
  // Joukkue (pelit ja treenit) vai treeniryhmä (vain treenit, oma nimi), 19.11.2026.
  const [kind, setKind] = useState<'team' | 'group'>('team');
  const group = kind === 'group';
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const [format, setFormat] = useState<GameFormat | ''>('');
  const [series, setSeries] = useState('');
  const [share, setShare] = useState(70); // peliaika-arvio %
  const logos = useClubLogos();
  const clubs = useClubs();
  const [country, setCountry] = useState<string | undefined>();
  const [city, setCity] = useState('');
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
    setKind(t !== 'new' && t.kind === 'group' ? 'group' : 'team');
    setName(t === 'new' ? '' : t.name);
    setPhoto(t === 'new' ? undefined : t.photo);
    setLogo(undefined);
    setLogoTouched(false);
    setFormat(t === 'new' ? '' : (t.format ?? ''));
    setSeries(t === 'new' ? '' : (t.series ?? ''));
    setShare(Math.round((t === 'new' ? 0.7 : (t.playShare ?? 0.7)) * 100));
    const info = t === 'new' ? undefined : clubFor(clubs, t.name);
    setCountry(info?.country);
    setCity(info?.city ?? '');
  };

  async function save() {
    try {
      const hasClub = !group && !!club && /[/·|]/.test(name);
      // Logo seuralle (näkyy kaikissa seuran joukkueissa ja peleissä); ilman seuraa joukkueen kuvaksi.
      if (logoTouched && hasClub) await repo.saveClubLogo(club, logo);
      // Maa ja kotipaikkakunta seuralle (ilman erotettua seuraa koko nimelle).
      const info = clubFor(clubs, name);
      if (!group && ((country ?? '') !== (info?.country ?? '') || city.trim() !== (info?.city ?? ''))) await repo.saveClub(clubNameOf(name), { country, city });
      const teamPhoto = logoTouched && !hasClub ? logo : logoTouched && hasClub ? undefined : photo;
      await repo.saveTeam(
        profile.id,
        group ? { name, photo: teamPhoto, kind } : { name, photo: teamPhoto, format: format || undefined, series, playShare: share === 70 ? undefined : share / 100, kind },
        editing && editing !== 'new' ? editing.id : undefined,
      );
      toast(group ? 'Ryhmä tallennettu' : 'Joukkue tallennettu');
      setEditing(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Card
      title={`Omat joukkueet ja ryhmät · ${profile.name}`}
      action={
        <Button variant="ghost" onClick={() => open('new')}>
          <IconPlus size="1rem" /> Lisää
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
          <Segmented<'team' | 'group'>
            label="Tyyppi"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'team', label: 'Joukkue' },
              { value: 'group', label: 'Treeniryhmä' },
            ]}
          />
          <p className="text-xs text-slate-500">
            {group
              ? 'Treeniryhmä on vain treenejä varten, esim. pienryhmävalmennus, taitokoulu tai futsal-koulu. Anna sille nimi, jolla tunnistat treenit. Ryhmä ei näy pelien joukkuevalinnassa.'
              : 'Joukkue pelaa pelejä ja treenaa. Treenit voi merkitä joukkueelle viikkorytmissä tai treenin lisätiedoissa.'}
          </p>
          {group ? (
            <Field label="Ryhmän nimi">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="esim. Pienryhmävalmennus, Taitokoulu" />
            </Field>
          ) : (
            <TeamNameFields own value={name} onChange={setName} suggestions={suggestions} label="Oma joukkue" />
          )}
          {!group && (
          <>
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
          <Field label="Sarja (oletus peleille ja turnauksille)" hint="Esim. P9 tai T12. Esitäytetään uusiin peleihin ja turnauksiin; tapahtumakohtaisesti voi muuttaa.">
            <input className={inputClass} value={series} onChange={(e) => setSeries(e.target.value)} maxLength={20} placeholder="esim. P9" autoCapitalize="characters" />
          </Field>
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
          <OriginFields country={country} city={city} onCountry={setCountry} onCity={setCity} />
          </>
          )}
          <LogoPicker
            label={group ? 'Kuva (valinnainen)' : club && /[/·|]/.test(name) ? `Seuran logo (${club})` : 'Logo tai joukkuekuva'}
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
          Lisää lapsen joukkue, niin se esitäyttyy peleihin. Treeniryhmän (esim. pienryhmävalmennus) voi lisätä samasta painikkeesta.
        </EmptyState>
      )}
      <ul className="divide-y divide-slate-100">
        {teams && [...teams.filter((t) => t.kind !== 'group'), ...teams.filter((t) => t.kind === 'group')].map((t) => (
          <li key={t.id} className={`flex items-center gap-3 py-3 ${t.archived ? 'opacity-50' : ''}`}>
            <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => open(t)} aria-label={`Muokkaa: ${t.name}`}>
              <TeamLogo logo={(t.kind === 'group' ? undefined : logoFor(t.name)) ?? t.photo} name={t.name} size="lg" />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Flag code={t.kind === 'group' ? undefined : clubFor(clubs, t.name)?.country} />
                  <span className="truncate font-medium text-slate-900">{displayTeamName(t.name)}</span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">
                  {t.kind === 'group'
                    ? 'Treeniryhmä · vain treenit'
                    : [clubFor(clubs, t.name)?.city, t.series, t.format, `peliaika ~${Math.round((t.playShare ?? 0.7) * 100)} %`].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="text-slate-400" aria-hidden>
                <IconPencil size="1rem" />
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
      <UnassignedTrainings profile={profile} />
    </Card>
  );
}
