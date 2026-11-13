// "Viime viikko lyhyesti" (SPEC 16): viikon ensimmäisellä avauksella edellisen viikon kooste
// Viikko-näkymän yläosassa. Suljettu kooste muistetaan laitekohtaisesti viikon mukaan.

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { isoWeek, weekPeriod } from '../../domain/dates';
import { footballPeriodSummary } from '../../domain/football';
import { formatHours } from '../../domain/hours';
import { DEFAULT_SETTINGS } from '../../domain/recommendations';
import type { ISODate, Profile } from '../../domain/types';
import { previousWeekStart, shouldShowDigest } from '../../domain/weekDigest';
import { repo } from '../../db/repositories';
import { formatDate } from '../../ui/format';
import { useReport } from '../analysis/useReport';
import { useFootball } from '../football/useFootball';
import { useFootballEnabled } from '../football/useFootballEnabled';
import { weekModel } from './WeekSummary';

const KEY = 'lastWeekSeen';

function readSeen(): Record<string, ISODate> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, ISODate>;
  } catch {
    return {};
  }
}
function writeSeen(profileId: string, week: ISODate) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readSeen(), [profileId]: week }));
  } catch {
    /* ei tallennusta: kooste näkyy uudelleen */
  }
}

const STATUS_TEXT = { met: '✓ Suositus täyttyi', near: '≈ Lähellä suositusta', below: '○ Alle suosituksen' } as const;

const STATUS_CLASS = {
  met: 'bg-green-100 text-green-900',
  near: 'bg-amber-100 text-amber-900',
  below: 'bg-slate-100 text-slate-700',
} as const;

export function LastWeekCard({ profile, today, onOpenWeek }: { profile: Profile; today: ISODate; onOpenWeek: (weekStart: ISODate) => void }) {
  const start = previousWeekStart(today);
  const period = weekPeriod(start);
  const [dismissed, setDismissed] = useState(() => readSeen()[profile.id]);
  const report = useReport(profile, period);
  const settings = useLiveQuery(() => repo.getSettings(), []) ?? DEFAULT_SETTINGS;
  const week = useLiveQuery(async () => {
    const sessions = (await repo.sessionsInRange(profile.id, period.start, period.end)).filter((s) => !s.deletedAt);
    return { sessions };
  }, [profile.id, period.start, period.end]);
  const footballOn = useFootballEnabled(profile);
  const football = useFootball(footballOn ? profile.id : undefined, period.start, period.end);

  if (!report || !week) return null;
  const logged = week.sessions.filter((s) => !s.estimateConfirmed);
  if (!shouldShowDigest({ lastWeekStart: start, trackingStart: report.trackingStart, sessionCount: logged.length, dismissedFor: dismissed })) return null;

  const close = () => {
    writeSeen(profile.id, start);
    setDismissed(start);
  };
  const { main, tiles: weekTiles } = weekModel(report, settings);
  const ev = report.evaluation;
  const fb = football && football.sessions.length ? footballPeriodSummary(football, period) : undefined;
  const g = fb?.games;
  // Selkeät, isot luvut: pääluku omana rivinään, muut ruutuina (kertoja ja kommentteja ei näytetä).
  // Ilman jalkapalloa: viikkonäkymän omat ruudut (esim. rasittavat päivät, lihas · luusto).
  const tiles: { label: string; value: string; unit?: string }[] = footballOn
    ? [{ label: 'Liikuntaa yhteensä', value: formatHours(report.hours.actualMin) }]
    : weekTiles.map((t) => ({ label: t.label, value: t.value, unit: t.sub }));
  if (fb && fb.training.count) tiles.push({ label: 'Treenit', value: String(fb.training.count) });
  if (g && g.games) tiles.push({ label: 'Pelit V–T–H', value: `${g.wins}–${g.draws}–${g.losses}`, unit: g.noResult ? `+${g.noResult} ilman tulosta` : undefined });
  if (g && g.playerGoalsGames) tiles.push({ label: `${profile.name}: maalit`, value: `⚽ ${g.playerGoals}` });
  const showMain = main && ev.evaluable;

  return (
    <section className="card anim-rise p-4 sm:p-5" aria-label="Viime viikko lyhyesti">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Viime viikko lyhyesti · vk {isoWeek(start).week}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="font-display text-lg font-semibold leading-tight text-slate-900">
              {formatDate(period.start, 'd.M.')} – {formatDate(period.end, 'd.M.')}
            </h2>
            {showMain && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_CLASS[main.m.status]}`}>{STATUS_TEXT[main.m.status]}</span>}
          </div>
        </div>
        <button type="button" onClick={close} className="press -mr-1 -mt-1 flex size-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-[var(--surface-sunk)] hover:text-slate-900" aria-label="Sulje viime viikon kooste">
          ✕
        </button>
      </div>
      {showMain && (
        <div className="mt-3 rounded-2xl bg-[var(--surface-sunk)] px-4 py-3">
          <div className="text-sm font-semibold text-slate-600">{main.label}</div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="stat text-4xl font-semibold tabular-nums text-slate-900">{Math.round(main.value)}</span>
            <span className="text-base font-semibold text-slate-600">{main.unit}</span>
          </div>
          <div className="text-sm text-slate-500">{main.target}</div>
        </div>
      )}
      <dl className={`mt-2 grid grid-cols-2 gap-2 ${tiles.length === 3 ? 'sm:grid-cols-3 [&>*:last-child]:max-sm:col-span-2' : 'sm:grid-cols-4'}`}>
        {tiles.map((t) => (
          <div key={t.label} className="min-w-0 rounded-2xl bg-[var(--surface-sunk)] px-4 py-3">
            <dt className="text-sm font-semibold leading-tight text-slate-600">{t.label}</dt>
            <dd className="stat mt-1 text-2xl font-semibold tabular-nums text-slate-900">{t.value}</dd>
            {t.unit && <dd className="text-xs text-slate-500">{t.unit}</dd>}
          </div>
        ))}
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            close();
            onOpenWeek(start);
          }}
          className="press min-h-10 rounded-xl bg-[var(--surface-raised)] px-3 text-sm font-semibold text-slate-800 shadow-xs ring-1 ring-slate-200 hover:bg-slate-100"
        >
          Avaa viime viikko
        </button>
        <button type="button" onClick={close} className="min-h-10 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-[var(--surface-sunk)]">
          Selvä
        </button>
      </div>
    </section>
  );
}
