// Jalkapallon näkymien välilehdet PC:llä (27.11.2026): kuvakkeet, määrät ja selvästi korostettu valittu välilehti,
// jotta palkki erottuu sivulta. Palkin oikeassa päässä Lisää kalenteriin -painike. Puhelimella käytetään edelleen
// valintakytkintä (`Segmented`).

import { useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Profile } from '../../domain/types';
import { gameRows, summarizeGames } from '../../domain/football';
import { nextFixtures } from '../../domain/nextGames';
import { repo } from '../../db/repositories';
import { today as todayFn } from '../../ui/today';
import { useFootball } from '../football/useFootball';
import { IconCalendarClock, IconNotebook, IconPlus, IconTrophy, IconUsers } from '../../ui/icons';

export type FootballView = 'diary' | 'calendar' | 'results' | 'teams';

/** Välilehtien määrät: päiväkirjan kirjaukset, tulevat kalenterin tapahtumat ja pelatut pelit (kuten Tulokset). */
function useTabCounts(profile: Profile) {
  const today = todayFn();
  const data = useFootball(profile.id);
  const fixtures = useLiveQuery(() => repo.listFixtures(profile.id, today), [profile.id, today]);
  return useMemo(
    () => ({
      diary: data?.sessions.filter((s) => !s.deletedAt && !s.linkedTo).length,
      calendar: fixtures ? nextFixtures(fixtures, today, Number.POSITIVE_INFINITY).length : undefined,
      results: data ? summarizeGames(gameRows(data.sessions, data.details, data.types)).games : undefined,
    }),
    [data, fixtures, today],
  );
}

export function FootballTabs({
  profile,
  value,
  onChange,
  onAdd,
}: {
  profile: Profile;
  value: FootballView;
  onChange: (v: FootballView) => void;
  onAdd: () => void;
}) {
  const counts = useTabCounts(profile);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // Määrä ja sen selite (esim. "3 tulossa"); kapealla palkilla määrät piiloon, keskileveällä pelkkä luku.
  const tabs: { value: FootballView; label: string; icon: ReactNode; count?: string; unit?: string; countLabel?: string }[] = [
    { value: 'diary', label: 'Päiväkirja', icon: <IconNotebook size="1.2rem" />, count: counts.diary ? String(counts.diary) : undefined, countLabel: `${counts.diary} kirjausta` },
    { value: 'calendar', label: 'Kalenteri', icon: <IconCalendarClock size="1.2rem" />, count: counts.calendar ? String(counts.calendar) : undefined, unit: 'tulossa', countLabel: `${counts.calendar} tulossa` },
    { value: 'results', label: 'Tulokset', icon: <IconTrophy size="1.2rem" />, count: counts.results ? String(counts.results) : undefined, countLabel: `${counts.results} peliä` },
    { value: 'teams', label: 'Joukkueet', icon: <IconUsers size="1.2rem" /> },
  ];

  // Nuolinäppäimet, Home ja End siirtävät valintaa (välilehtiryhmän tavallinen näppäimistökäyttö).
  const onKey = (e: KeyboardEvent, i: number) => {
    const n = tabs.length;
    const to = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    onChange(tabs[to]!.value);
    refs.current[to]?.focus();
  };

  return (
    <div className="flex items-center gap-3">
      <div role="tablist" aria-label="Jalkapallon näkymä" className="@container/tb grid min-w-0 flex-1 grid-cols-4 border-b border-[var(--line)]">
        {tabs.map((t, i) => {
          const on = t.value === value;
          return (
            <button
              key={t.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(t.value)}
              onKeyDown={(e) => onKey(e, i)}
              className={`press group relative flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-t-xl px-2 text-[15px] font-semibold transition-colors ${on ? 'text-slate-900' : 'text-slate-500 hover:bg-[var(--surface-sunk)] hover:text-slate-900'}`}
            >
              <span className={`shrink-0 ${on ? 'text-[var(--focus)]' : ''}`}>{t.icon}</span>
              <span className="truncate">{t.label}</span>
              {t.count && (
                <span
                  className={`hidden shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-bold tabular-nums @min-[42rem]/tb:inline ${on ? 'bg-[var(--sage)] text-[var(--focus)]' : 'bg-[var(--surface-sunk)] text-slate-500'}`}
                  aria-label={t.countLabel}
                >
                  {t.count}
                  {t.unit && <span className="hidden @min-[52rem]/tb:inline"> {t.unit}</span>}
                </span>
              )}
              <span className={`absolute inset-x-3 -bottom-px h-[3px] rounded-full bg-[var(--focus)] transition-opacity ${on ? 'opacity-100' : 'opacity-0'}`} aria-hidden />
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="press inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-green-700 px-4 text-sm font-semibold text-white shadow-[0_6px_16px_-8px_rgb(var(--accent-rgb)/0.6)] hover:bg-green-800"
      >
        <IconPlus size="1rem" /> Lisää kalenteriin
      </button>
    </div>
  );
}
