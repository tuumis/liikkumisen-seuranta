import { lazy, Suspense, useEffect, useId, useState } from 'react';
import { flushSync } from 'react-dom';
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
import { Avatar } from './ui/Avatar';
import { formatDate } from './ui/format';
import { IconBall, IconChart, IconHelp, IconLeaf, IconSettings, IconWeek } from './ui/icons';

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

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const [tab, setTabState] = useState<Tab>(() => (store.get('tab') as Tab) ?? 'week');
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId | undefined>();
  const [helpOpen, setHelpOpen] = useState(false);
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
      .then(() => setReady(true))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  // null = ei vielä ladattu (erotetaan tyhjästä listasta, ettei ensikäynnistyksen ohjaus laukea turhaan).
  const profiles = useLiveQuery(() => (ready ? repo.listProfiles() : null), [ready]) ?? null;
  const selected = profiles?.find((p) => p.id === selectedId) ?? profiles?.[0];
  const onboarded = useLiveQuery(() => (ready ? repo.getMeta<boolean>('onboarded').then((v) => v ?? false) : null), [ready]) ?? null;

  const setTab = (t: Tab) => {
    if (t === 'settings' && tab === 'settings') setSettingsSection(undefined);
    store.set('tab', t);
    if (t === tab) return setTabState(t);
    // Sulava näkymänvaihto (View Transitions), jos selain tukee eikä liikettä ole vähennetty.
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (doc.startViewTransition && !reduce) doc.startViewTransition(() => flushSync(() => setTabState(t)));
    else setTabState(t);
    window.scrollTo({ top: 0 });
  };
  const select = (id: string) => {
    setSelectedIdState(id);
    store.set('selectedProfileId', id);
  };

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
  const tabIndex = TABS.findIndex((t) => t.id === tab);
  const dateLine = formatDate(today(), 'EEEE d. MMMM');

  return (
    <div className="min-h-dvh lg:pl-72">
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
          {TABS.map((t) => {
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
        {profiles && profiles.length > 0 && (
          <div className="mt-10 px-4">
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
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="mt-auto space-y-3 px-4 pb-7">
          <button type="button" onClick={() => setHelpOpen(true)} className="press flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-semibold text-[var(--side-ink-soft)] hover:bg-white/[0.06] hover:text-white">
            <IconHelp size="1.25rem" />
            Ohje
          </button>
          <p className="flex items-start gap-2 px-4 text-[11px] leading-relaxed text-[var(--side-muted)]">
            <IconLeaf size="0.95rem" className="mt-px shrink-0" />
            Tiedot pysyvät tällä laitteella. Ei verkkoliikennettä.
          </p>
        </div>
      </aside>

      {/* Puhelin ja tabletti: läpikuultava yläpalkki profiilisiruineen. */}
      <header className="sticky top-0 z-20 bg-[color-mix(in_oklab,var(--bg)_82%,transparent)] px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-xl items-center justify-between md:max-w-2xl">
          <div className="flex items-center gap-2">
            <BrandMark className="size-7" />
            <span className="font-display text-[15px] font-semibold text-slate-900">Liikkumisen seuranta</span>
          </div>
          <button type="button" onClick={() => setHelpOpen(true)} className="press -mr-1 flex size-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100" aria-label="Ohje">
            <IconHelp size="1.35rem" />
          </button>
        </div>
        {profiles && profiles.length > 1 && (
          <div className="mx-auto -mx-4 mt-2 flex max-w-xl gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:max-w-2xl" role="tablist" aria-label="Profiilit">
            {profiles.map((p) => {
              const active = p.id === selected?.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => select(p.id)}
                  className={`press flex min-h-9 shrink-0 items-center gap-2 rounded-full pl-1 pr-3.5 text-sm font-semibold ${
                    active ? 'bg-green-700 text-white shadow-[0_6px_16px_-6px_rgb(var(--accent-rgb)/0.6)]' : 'bg-[var(--surface)] text-slate-800 shadow-xs ring-1 ring-slate-200'
                  }`}
                >
                  <Avatar name={p.name} photo={p.photo} color={p.color} size="sm" />
                  {p.name}
                </button>
              );
            })}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-xl px-4 pb-[calc(max(0.75rem,env(safe-area-inset-bottom))+7.5rem)] pt-2 md:max-w-2xl lg:max-w-none lg:px-10 lg:pb-12 lg:pt-10 2xl:px-14">
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
        <div key={tab} className="anim-fade">
          {!ready ? (
            <LoadingSkeleton />
          ) : tab === 'week' ? (
            <WeekView profile={selected} onOpenSettings={openSettings} />
          ) : tab === 'games' ? (
            <GamesTab profile={selected} />
          ) : tab === 'analysis' ? (
            <Suspense fallback={<LoadingSkeleton />}>
              <AnalysisView profile={selected} />
            </Suspense>
          ) : (
            <SettingsView profile={selected} onProfileCreated={select} section={settingsSection} onSection={setSettingsSection} />
          )}
        </div>
      </main>

      {/* Puhelin: kelluva alanavigaatio, aktiivinen kohta liukuu paikalleen. */}
      <nav className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden" aria-label="Päävalikko">
        <div className="relative mx-auto grid max-w-md grid-cols-4 rounded-[1.75rem] bg-[color-mix(in_oklab,var(--surface)_88%,transparent)] p-1.5 shadow-xl ring-1 ring-slate-200/70 backdrop-blur-xl">
          <span
            className="absolute inset-y-1.5 left-1.5 rounded-[1.35rem] bg-green-700 shadow-[0_8px_20px_-8px_rgb(var(--accent-rgb)/0.7)] transition-transform duration-500 [transition-timing-function:var(--ease-out)]"
            style={{ width: 'calc((100% - 0.75rem) / 4)', transform: `translateX(${tabIndex * 100}%)` }}
            aria-hidden
          />
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={active ? 'page' : undefined}
                className={`press relative z-10 flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[1.35rem] text-[11px] font-semibold transition-colors ${active ? 'text-white' : 'text-slate-500'}`}
              >
                <t.Icon size="1.4rem" />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>
      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
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
