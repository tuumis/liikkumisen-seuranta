import { lazy, Suspense, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { repo } from './db/repositories';
import { defaultPlanningThrough } from './domain/planning';
import { today } from './ui/today';
import { WeekView } from './features/week/WeekView';
import { SettingsView } from './features/settings/SettingsView';
import { Onboarding } from './features/onboarding/Onboarding';

// Analyysi (Recharts) ladataan omana osanaan; service worker esivälimuistittaa senkin.
const AnalysisView = lazy(() => import('./features/analysis/AnalysisView').then((m) => ({ default: m.AnalysisView })));

type Tab = 'week' | 'analysis' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'week', label: 'Viikko', icon: '📅' },
  { id: 'analysis', label: 'Analyysi', icon: '📊' },
  { id: 'settings', label: 'Asetukset', icon: '⚙️' },
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
  const [selectedId, setSelectedIdState] = useState<string | undefined>(() => store.get('selectedProfileId'));

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
    setTabState(t);
    store.set('tab', t);
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
    if (ready && profiles && profiles.length === 0) setTabState('settings');
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

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <h1 className="text-sm font-semibold tracking-wide text-green-800">Liikkumisen seuranta</h1>
        {profiles && profiles.length > 0 && (
          <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Profiilit">
            {profiles.map((p) => {
              const active = p.id === selected?.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => select(p.id)}
                  className={`flex min-h-9 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-medium ring-1 ${active ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-800 ring-slate-300'}`}
                >
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
                  {p.name}
                </button>
              );
            })}
          </div>
        )}
      </header>

      <main className="flex-1 px-4 py-4 pb-24">
        {!ready ? (
          <p className="text-sm text-slate-600">Ladataan…</p>
        ) : tab === 'week' ? (
          <WeekView profile={selected} onOpenSettings={() => setTab('settings')} />
        ) : tab === 'analysis' ? (
          <Suspense fallback={<p className="text-sm text-slate-600">Ladataan…</p>}>
            <AnalysisView profile={selected} />
          </Suspense>
        ) : (
          <SettingsView profile={selected} onProfileCreated={select} />
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-xl grid-cols-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${tab === t.id ? 'text-green-800' : 'text-slate-500'}`}
            >
              <span className="text-lg" aria-hidden>
                {t.icon}
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
