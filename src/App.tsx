import { lazy, Suspense, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useCompactHeader } from './ui/useCompactHeader';
import { useLiveQuery } from 'dexie-react-hooks';
import { repo } from './db/repositories';
import { defaultPlanningThrough } from './domain/planning';
import { today } from './ui/today';
import { WeekView } from './features/week/WeekView';
import { SettingsView } from './features/settings/SettingsView';
import { Onboarding } from './features/onboarding/Onboarding';
import { HelpSheet } from './features/help/HelpSheet';
import type { SettingsSectionId } from './features/settings/SettingsView';
import { GamesTab } from './features/games/GamesTab';
import { DesktopAgent } from './features/desktop/DesktopAgent';
import { GoalSound } from './features/week/GoalSound';
import { PreviewShareHost } from './features/share/PreviewShare';
import { ResultShareHost } from './features/share/ResultShare';
import { SyncBar } from './features/sync/SyncBar';
import { SidebarUpdate } from './features/update/appUpdate';
import { consumeLaunchAction, dispatchCommand, type AppCommand } from './features/desktop/commands';
import { CommandPalette } from './features/desktop/CommandPalette';
import { StoryHost } from './features/story/StoryViewer';
import { FootballStatusContext, useFootballStatusMap } from './features/football/useFootballEnabled';
import { Avatar } from './ui/Avatar';
import { hideUntilSettled } from './ui/settle';
import { markTabSwitch, TabPanel } from './ui/TabPanel';
import { formatDate } from './ui/format';
import { IconBall, IconCalendarClock, IconPlus, IconChart, IconHelp, IconLeaf, IconMoon, IconSearch, IconSettings, IconSun, IconWeek } from './ui/icons';
import { setThemeChoice, useIsDark } from './ui/theme';
import { useUnconfirmedCounts } from './features/review/unconfirmed';
import { requestWeek } from './features/desktop/settings';
import { DEMO } from './demo/demoMode';
import { DemoBanner, DemoSidebar } from './demo/DemoBanner';
import { StopwatchBar, StopwatchHost } from './features/stopwatch/StopwatchBar';
import { CoachShareHost } from './features/coach/CoachShare';

// Analyysi (Recharts) ladataan omana osanaan; service worker esivälimuistittaa senkin.
const loadAnalysis = () => import('./features/analysis/AnalysisView');
const AnalysisView = lazy(() => loadAnalysis().then((m) => ({ default: m.AnalysisView })));

type Tab = 'week' | 'games' | 'analysis' | 'settings';

const TABS: { id: Tab; label: string; Icon: typeof IconWeek }[] = [
  { id: 'week', label: 'Viikko', Icon: IconWeek },
  { id: 'games', label: 'Jalkapallo', Icon: IconBall },
  { id: 'analysis', label: 'Analyysi', Icon: IconChart },
  { id: 'settings', label: 'Asetukset', Icon: IconSettings },
];

// Laitekohtaiset käyttöliittymämuistit (valittu profiili ja välilehti).
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k) ?? undefined;
    } catch {
      return undefined;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ei tallennusta */
    }
  },
};

// Puhelimen yläpalkin korkeus muuttujaan --mobile-header-h: sivujen kiinnittyvät osat asettuvat sen alle (19.11.2026).
// PC:llä palkki on piilossa, jolloin arvo on 0.
let headerObserver: ResizeObserver | null = null;
function trackHeader(el: HTMLElement | null) {
  headerObserver?.disconnect();
  headerObserver = null;
  if (!el || typeof ResizeObserver === 'undefined') return;
  const set = () => document.documentElement.style.setProperty('--mobile-header-h', `${el.offsetHeight}px`);
  set();
  headerObserver = new ResizeObserver(set);
  headerObserver.observe(el);
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const [rawTab, setTabState] = useState<Tab>(() => (store.get('tab') as Tab) ?? 'week');
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId | undefined>();
  // Kerran avatut välilehdet (pysyvät muistissa, ei uutta latausta palatessa).
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set());
  useEffect(() => setVisited((v) => (v.has(rawTab) ? v : new Set(v).add(rawTab))), [rawTab]);
  const [helpOpen, setHelpOpen] = useState(false);
  // Puhelimen yläpalkki: nimirivi piiloutuu alaspäin vieritettäessä. Palkin alle jätetään yhtä suuri
  // marginaali, joten sisältö ei siirry (vain palkki pienenee) ja kiinnittyvät osat seuraavat palkkia.
  const headerCompact = useCompactHeader();
  const [brandH, setBrandH] = useState(40);
  const measureBrand = useCallback((el: HTMLDivElement | null) => {
    if (el) setBrandH(el.offsetHeight);
  }, []);
  const openSettings = (section?: SettingsSectionId) => {
    setSettingsSection(section);
    setTab('settings');
  };
  const [selectedId, setSelectedIdState] = useState<string | undefined>(() => store.get('selectedProfileId'));

  // Analyysi esiladataan taustalla, jotta välilehti avautuu heti (ei tyhjää hetkeä).
  useEffect(() => {
    const id = window.setTimeout(() => void loadAnalysis(), 1200);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    repo
      .initialize()
      // Esimerkkitila: keksityt tiedot luodaan tämän päivän mukaan ensimmäisellä käynnistyksellä (demo/seedDemo).
      .then(async () => {
        if (!DEMO) return;
        const { seedDemoOnce } = await import('./demo/seedDemo');
        await seedDemoOnce(repo, today());
      })
      // Välitunnit vain arkiliikunnassa: aiemmat erilliset välituntikerrat arvion vahvistuksiksi.
      .then(() => repo.foldEstimateOnlySessions(today()).catch(() => 0))
      .then(() => repo.applyAutoSkips().catch(() => 0))
      .then(() => repo.alignTournamentArrivals().catch(() => 0))
      .then(() => setReady(true))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  // null = ei vielä ladattu (erotetaan tyhjästä listasta, ettei ensikäynnistyksen ohjaus laukea turhaan).
  const profiles = useLiveQuery(() => (ready ? repo.listProfiles() : null), [ready]) ?? null;
  const selected = profiles?.find((p) => p.id === selectedId) ?? profiles?.[0];
  // Jalkapallo-välilehti vain, kun jalkapallo on profiilille käytössä (päättelyn aikana näkyy, ei välähdä pois).
  // Kaikkien profiilien tila lasketaan kerralla, joten profiilin vaihto ei välkytä valikkoa (17.11.2026).
  const footballMap = useFootballStatusMap(ready);
  const footballKnown = selected ? (selected.football ?? footballMap?.get(selected.id)) : profiles ? false : undefined;
  // Käynnistyksessä (profiilit vielä lataamatta) viimeksi tiedetty tila, ettei välilehti ilmesty hetken päästä.
  useEffect(() => {
    if (footballKnown !== undefined) store.set('footballTab', footballKnown ? '1' : '0');
  }, [footballKnown]);
  const football = (footballKnown ?? store.get('footballTab') !== '0') !== false;
  const tabs = football ? TABS : TABS.filter((t) => t.id !== 'games');
  const tab: Tab = !football && rawTab === 'games' ? 'week' : rawTab;
  const onboarded = useLiveQuery(() => (ready ? repo.getMeta<boolean>('onboarded').then((v) => v ?? false) : null), [ready]) ?? null;

  // Välilehden vaihto (24.11.2026): tila vaihtuu heti ja uusi välilehti häivytetään esiin (ui/TabPanel). Aiempi
  // View Transitions -siirtymä kuvasi sivun kahdesti ja jähmetti näkymän puhelimella yli 100 ms.
  const setTab = (t: Tab) => {
    if (t === 'settings' && tab === 'settings') setSettingsSection(undefined);
    store.set('tab', t);
    if (t !== tab) markTabSwitch();
    setTabState(t);
    window.scrollTo({ top: 0 });
  };
  // Profiilin vaihto: sisältö näkyviin kerralla, kun uuden profiilin tiedot ovat valmiit (ui/settle).
  const pageRef = useRef<HTMLDivElement>(null);
  const shownId = useRef<string | undefined>(undefined);
  const selectedKey = selected?.id;
  useLayoutEffect(() => {
    const prev = shownId.current;
    shownId.current = selectedKey;
    if (!prev || !selectedKey || prev === selectedKey || !pageRef.current) return;
    return hideUntilSettled(pageRef.current);
  }, [selectedKey]);
  const select = (id: string) => {
    setSelectedIdState(id);
    store.set('selectedProfileId', id);
  };

  // Kuittaamattomat kerrat (18.11.2026): sivuvalikon Kuittaa-painike, profiilien ja Viikko-kohdan numerot.
  const pending = useUnconfirmedCounts(ready);
  const pendingOf = (id: string) => pending?.get(id) ?? 0;
  const pendingTotal = [...(pending?.values() ?? [])].reduce((a, n) => a + n, 0);
  const pendingLine =
    profiles && profiles.length > 1
      ? profiles.filter((p) => pendingOf(p.id)).map((p) => `${p.name} ${pendingOf(p.id)}`).join(' · ')
      : `${pendingTotal} ${pendingTotal === 1 ? 'kerta odottaa' : 'kertaa odottaa'}`;
  /** Avaa kuittauksen: valittu profiili, jos sillä on kuitattavaa, muuten ensimmäinen, jolla on. */
  const openReview = () => {
    const id = selected && pendingOf(selected.id) ? selected.id : profiles?.find((p) => pendingOf(p.id))?.id;
    if (!id) return;
    select(id);
    setTab('week');
    requestWeek(true);
  };

  /** Komento pikanäppäimestä, komentovalikosta tai tehtäväpalkista: Viikko-komennot avaavat Viikko-näkymän. */
  const runCommand = (cmd: AppCommand) => {
    if (cmd.kind === 'add' || cmd.kind === 'review' || cmd.kind === 'week') setTab('week');
    dispatchCommand(cmd);
  };
  // Tehtäväpalkin pikakuvake (?action=…) kerran käynnistyksessä, kun profiilit on ladattu.
  const [launchHandled, setLaunchHandled] = useState(false);
  useEffect(() => {
    if (launchHandled || !ready || !profiles) return;
    setLaunchHandled(true);
    const cmd = consumeLaunchAction();
    if (cmd && profiles.length) runCommand(cmd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchHandled, ready, profiles]);

  // Käynnistyksessä suunnitelmat kaikille profiileille ensi viikon loppuun (SPEC 10).
  const profileIds = profiles?.map((p) => p.id).join(',') ?? '';
  useEffect(() => {
    if (!ready || !profileIds) return;
    const t = today();
    for (const id of profileIds.split(',')) void repo.ensurePlanned(id, defaultPlanningThrough(t), t);
  }, [ready, profileIds]);

  // Ensikäynnistys ilman profiileja → Asetukset.
  useEffect(() => {
    if (ready && profiles && profiles.length === 0) {
      setTabState('settings');
      setSettingsSection('profiles');
    }
  }, [ready, profiles]);

  // Ensikäynnistys: ei profiileja eikä aloitusta tehty (SPEC 12). Päätetään kerran, jotta
  // aloitus ei sulkeudu kesken, kun sen ensimmäinen vaihe luo profiilin.
  const [onboarding, setOnboarding] = useState<boolean | null>(null);
  useEffect(() => {
    if (onboarding === null && ready && profiles && onboarded !== null) setOnboarding(profiles.length === 0 && !onboarded);
  }, [onboarding, ready, profiles, onboarded]);

  if (onboarding) {
    return (
      <Onboarding
        onDone={(id) => {
          if (id) select(id);
          setTab('week');
          setOnboarding(false);
        }}
      />
    );
  }

  if (error) {
    return (
      <main className="p-4">
        <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-900 ring-1 ring-red-200">Tietokannan avaus epäonnistui: {error}</p>
      </main>
    );
  }

  const TAB_TITLE: Record<Tab, string> = { week: 'Viikko', games: 'Jalkapallo', analysis: 'Analyysi', settings: 'Asetukset' };
  const tabIndex = tabs.findIndex((t) => t.id === tab);
  const mounted = new Set<Tab>([...visited, tab]);
  const dateLine = formatDate(today(), 'EEEE d. MMMM');

  return (
    <FootballStatusContext.Provider value={footballMap}>
    <div className="min-h-dvh lg:pl-72">
      {/* PC-sovellus: vetoalue ikkunan ylälaidassa, kun otsikkopalkki on piilotettu (window-controls-overlay). */}
      <div className="titlebar" aria-hidden />
      {/* PC: kiinteä metsänvihreä sivupalkki navigaatiolle ja profiileille. */}
      <aside className="sidebar fixed inset-y-0 left-0 z-20 hidden w-72 flex-col lg:flex">
        <div className="flex items-center gap-3 px-6 pb-8 pt-8">
          <BrandMark className="size-10" />
          <div className="leading-tight">
            <div className="font-display text-[17px] font-semibold text-[var(--side-ink)]">Liikkumisen</div>
            <div className="font-display text-[17px] font-semibold text-[var(--hero-accent)]">seuranta</div>
          </div>
        </div>
        <nav className="space-y-1 px-4" aria-label="Päävalikko">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={active ? 'page' : undefined}
                className={`press group relative flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-semibold ${
                  active ? 'bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]' : 'text-[var(--side-ink-soft)] hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <span className={`absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[var(--hero-accent)] transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`} aria-hidden />
                <t.Icon size="1.35rem" />
                {t.label}
              </button>
            );
          })}
        </nav>
        {/* Sekuntikello (25.11.2026): käynnissä olevat kellot aina näkyvissä. */}
        <div className="mt-4 px-4 empty:hidden">
          <StopwatchBar variant="sidebar" profiles={profiles} />
        </div>
        {pendingTotal > 0 && (
          <div className="mt-4 px-4">
            <button
              type="button"
              onClick={openReview}
              className="press anim-rise flex w-full items-center gap-3 rounded-2xl bg-[var(--hero-accent)] px-4 py-2.5 text-left text-[var(--side-from)] shadow-md hover:brightness-105"
            >
              <IconCalendarClock size="1.25rem" className="shrink-0" />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block text-sm font-semibold">Kuittaa kerrat</span>
                <span className="block truncate text-[11px] font-medium opacity-80">{pendingLine}</span>
              </span>
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--side-from)] px-1.5 text-xs font-bold tabular-nums text-[var(--hero-accent)]" aria-hidden>
                {pendingTotal}
              </span>
            </button>
          </div>
        )}
        {profiles && profiles.length > 0 && (
          <div className={`${pendingTotal > 0 ? 'mt-8' : 'mt-10'} px-4`}>
            <div className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--side-muted)]">Profiilit</div>
            <div className="space-y-1" role="tablist" aria-label="Profiilit" aria-orientation="vertical">
              {profiles.map((p) => {
                const active = p.id === selected?.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => select(p.id)}
                    className={`press flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm font-semibold ${active ? 'bg-[var(--side-ink)] text-[var(--side-from)] shadow-md' : 'text-[var(--side-ink-soft)] hover:bg-white/[0.06]'}`}
                  >
                    <Avatar name={p.name} photo={p.photo} color={p.color} size="sm" className={active ? '' : 'ring-2 ring-white/20'} />
                    <span className="truncate">{p.name}</span>
                    <PendingCount n={pendingOf(p.id)} className="ml-auto bg-[var(--hero-accent)] text-[var(--side-from)]" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="mt-auto space-y-3 px-4 pb-7">
          <SidebarUpdate />
          {DEMO ? <DemoSidebar /> : <SyncBar variant="sidebar" />}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
            className="press flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-semibold text-[var(--side-ink-soft)] hover:bg-white/[0.06] hover:text-white"
          >
            <IconSearch size="1.25rem" />
            <span className="flex-1 text-left">Haku ja komennot</span>
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10.5px] font-bold tracking-wide text-[var(--side-muted)]">Ctrl K</span>
          </button>
          <button type="button" onClick={() => setHelpOpen(true)} className="press flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-semibold text-[var(--side-ink-soft)] hover:bg-white/[0.06] hover:text-white">
            <IconHelp size="1.25rem" />
            Ohje
          </button>
          <ThemeToggle />
          <p className="flex items-start gap-2 px-4 text-[11px] leading-relaxed text-[var(--side-muted)]">
            <IconLeaf size="0.95rem" className="mt-px shrink-0" />
            Tiedot pysyvät tällä laitteella. Ei verkkoliikennettä.
          </p>
        </div>
      </aside>

      {/* Puhelin ja tabletti: läpikuultava yläpalkki profiilisiruineen. */}
      <header
        ref={trackHeader}
        style={{ marginBottom: headerCompact ? brandH : 0 }}
        className="sticky top-0 z-20 bg-[color-mix(in_oklab,var(--bg)_82%,transparent)] px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl transition-[margin] duration-200 ease-out motion-reduce:transition-none lg:hidden"
      >
        <div
          style={{ height: headerCompact ? 0 : brandH, opacity: headerCompact ? 0 : 1 }}
          className="overflow-hidden transition-[height,opacity] duration-200 ease-out motion-reduce:transition-none"
          inert={headerCompact}
        >
          <div ref={measureBrand} className="mx-auto flex max-w-xl items-center justify-between md:max-w-2xl">
            <div className="flex items-center gap-2">
              <BrandMark className="size-7" />
              <span className="font-display text-[15px] font-semibold text-slate-900">Liikkumisen seuranta</span>
            </div>
            <div className="-mr-1 flex items-center gap-1">
              {/* Lisää kerta aina ylhäällä (25.11.2026): kelluva +-painike väistyy avattaessa päivän kortin tieltä. */}
              {selected && (
                <button
                  type="button"
                  onClick={() => runCommand({ kind: 'add' })}
                  className="press hit mr-1 flex size-9 items-center justify-center rounded-full bg-green-700 text-white shadow-[0_4px_10px_-4px_rgb(var(--accent-rgb)/0.6)] hover:bg-green-800"
                  aria-label="Lisää kerta"
                >
                  <IconPlus size="1.25rem" strokeWidth={2.2} />
                </button>
              )}
              {!DEMO && <SyncBar variant="header" />}
              <button type="button" onClick={() => setHelpOpen(true)} className="press hit flex size-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100" aria-label="Ohje">
                <IconHelp size="1.35rem" />
              </button>
            </div>
          </div>
        </div>
        {profiles && profiles.length > 1 && (
          <div className="mx-auto -mx-4 mt-1.5 flex max-w-xl gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] md:max-w-2xl" role="tablist" aria-label="Profiilit">
            {profiles.map((p) => {
              const active = p.id === selected?.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => select(p.id)}
                  className={`press flex min-h-11 shrink-0 items-center gap-2 rounded-full pl-1.5 pr-3.5 text-sm font-semibold ${
                    active ? 'bg-green-700 text-white shadow-[0_6px_16px_-6px_rgb(var(--accent-rgb)/0.6)]' : 'bg-[var(--surface)] text-slate-800 shadow-xs ring-1 ring-slate-200'
                  }`}
                >
                  <Avatar name={p.name} photo={p.photo} color={p.color} size="sm" />
                  {p.name}
                  <PendingCount n={pendingOf(p.id)} className="-mr-1 bg-amber-400 text-amber-950" />
                </button>
              );
            })}
          </div>
        )}
        <StopwatchBar variant="header" profiles={profiles} />
      </header>

      <main className="mx-auto max-w-xl px-4 pb-[calc(max(0.75rem,env(safe-area-inset-bottom))+7.5rem)] pt-2 md:max-w-2xl lg:max-w-none lg:px-10 lg:pb-12 lg:pt-10 2xl:px-14">
        {/* PC:llä esimerkkitilan merkintä ja Poistu ovat sivupalkissa. */}
        {DEMO && (
          <div className="lg:hidden">
            <DemoBanner />
          </div>
        )}
        <div className="mb-5 flex items-end justify-between gap-3 lg:mb-8">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-500">{dateLine}</div>
            <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight text-slate-900 lg:text-[40px]">
              {tab === 'week' && selected ? `Viikko · ${selected.name}` : TAB_TITLE[tab]}
            </h1>
          </div>
          {selected && (
            <span className="hidden items-center gap-2 rounded-full bg-[var(--surface)] py-1 pl-1 pr-3.5 text-sm font-semibold text-slate-700 shadow-sm lg:flex">
              <Avatar name={selected.name} photo={selected.photo} color={selected.color} size="sm" />
              {selected.name}
            </span>
          )}
        </div>
        {/* Avatut välilehdet pidetään muistissa (piilotettuina, laskenta pysäytettynä), jotta palatessa sisältö näkyy heti. */}
        <div className="page-view" ref={pageRef}>
          {!ready ? (
            <LoadingSkeleton />
          ) : (
            tabs.filter((t) => mounted.has(t.id)).map((t) => (
              <TabPanel key={t.id} active={t.id === tab} contextKey={selected?.id}>
                {t.id === 'week' ? (
                  <WeekView profile={selected} onOpenSettings={openSettings} />
                ) : t.id === 'games' ? (
                  <GamesTab profile={selected} />
                ) : t.id === 'analysis' ? (
                  <Suspense fallback={<LoadingSkeleton />}>
                    <AnalysisView profile={selected} />
                  </Suspense>
                ) : (
                  <SettingsView profile={selected} onProfileCreated={select} section={settingsSection} onSection={setSettingsSection} />
                )}
              </TabPanel>
            ))
          )}
        </div>
      </main>

      {ready && selected && <GoalSound key={selected.id} profile={selected} />}
      {ready && <ResultShareHost />}
      {ready && <StopwatchHost profiles={profiles} />}
      {ready && <CoachShareHost profiles={profiles} />}
      {ready && <PreviewShareHost />}

      {ready && !DEMO && profiles && profiles.length > 0 && (
        <DesktopAgent
          onOpen={(id) => {
            select(id);
            setTab('week');
          }}
        />
      )}

      {/* Puhelin: kelluva alanavigaatio, aktiivinen kohta liukuu paikalleen. */}
      <nav className="bottom-nav fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden" aria-label="Päävalikko">
        <div className="relative mx-auto grid max-w-md rounded-[1.75rem] bg-[color-mix(in_oklab,var(--surface)_88%,transparent)] p-1.5 shadow-xl ring-1 ring-slate-200/70 backdrop-blur-xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          <span
            className="absolute inset-y-1.5 left-1.5 rounded-[1.35rem] bg-green-700 shadow-[0_8px_20px_-8px_rgb(var(--accent-rgb)/0.7)] transition-transform duration-500 [transition-timing-function:var(--ease-out)]"
            style={{ width: `calc((100% - 0.75rem) / ${tabs.length})`, transform: `translateX(${tabIndex * 100}%)` }}
            aria-hidden
          />
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={active ? 'page' : undefined}
                className={`press relative z-10 flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[1.35rem] text-[11px] font-semibold transition-colors ${active ? 'text-white' : 'text-slate-500'}`}
              >
                <span className="relative">
                  <t.Icon size="1.4rem" />
                  {t.id === 'week' && pendingTotal > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold tabular-nums text-amber-950 ring-2 ring-[var(--surface)]" aria-hidden>
                      {pendingTotal}
                    </span>
                  )}
                </span>
                {t.label}
                {t.id === 'week' && pendingTotal > 0 && <span className="sr-only">, {pendingTotal} kuittaamatta</span>}
              </button>
            );
          })}
        </div>
      </nav>
      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
      {ready && <StoryHost profile={selected} />}
      {ready && profiles && (
        <CommandPalette
          profiles={profiles}
          selected={selected}
          tab={tab}
          setTab={setTab}
          football={football}
          selectProfile={select}
          openSettings={openSettings}
          openHelp={() => setHelpOpen(true)}
          run={runCommand}
        />
      )}
    </div>
    </FootballStatusContext.Provider>
  );
}

/** Kuittaamattomien kertojen määrä profiilin vieressä (piilossa, kun ei kuitattavaa). */
function PendingCount({ n, className }: { n: number; className: string }) {
  if (!n) return null;
  return (
    <span className={`flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ${className}`}>
      {n}
      <span className="sr-only"> kuittaamatta</span>
    </span>
  );
}

/** Tuotemerkki: metsänvihreä ruutu, hiekansävyinen edistymiskaari ja liikkeen piste. */
function BrandMark({ className = '' }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--hero-from)' }} />
          <stop offset="1" style={{ stopColor: 'var(--hero-to)' }} />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill={`url(#${id})`} />
      <circle cx="20" cy="20" r="10.5" fill="none" stroke="#f6f5f0" strokeOpacity="0.22" strokeWidth="3.2" />
      <path d="M20 9.5a10.5 10.5 0 1 1-9.9 14" fill="none" style={{ stroke: 'var(--hero-accent)' }} strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="20" cy="20" r="3.4" fill="#f6f5f0" />
    </svg>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Ladataan">
      <div className="skeleton h-48 rounded-[1.75rem]" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="skeleton h-28 rounded-[1.75rem]" />
        <div className="skeleton h-28 rounded-[1.75rem]" />
      </div>
      <div className="skeleton h-64 rounded-[1.75rem]" />
    </div>
  );
}

/**
 * Vaalea/tumma-pikavalinta PC:n sivupalkissa (24.11.2026, käyttäjän toive). Vaihtaa näkyvän teeman
 * vastakkaiseksi; laitteen mukainen teema valitaan edelleen kohdasta Asetukset → Ulkoasu.
 */
function ThemeToggle() {
  const dark = useIsDark();
  return (
    <button
      type="button"
      onClick={() => setThemeChoice(dark ? 'light' : 'dark')}
      className="press flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-semibold text-[var(--side-ink-soft)] hover:bg-white/[0.06] hover:text-white"
      aria-label={dark ? 'Vaihda vaaleaan teemaan' : 'Vaihda tummaan teemaan'}
    >
      {dark ? <IconSun size="1.25rem" /> : <IconMoon size="1.25rem" />}
      {dark ? 'Vaalea teema' : 'Tumma teema'}
    </button>
  );
}
