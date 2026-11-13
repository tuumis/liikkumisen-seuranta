// "Viime viikko lyhyesti" (SPEC 16): viikon ensimmäisellä avauksella edellisen viikon kooste
// Viikko-näkymän yläosassa. Suljettu kooste muistetaan laitekohtaisesti viikon mukaan.

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { isoWeek, weekPeriod } from '../../domain/dates';
import { footballPeriodSummary } from '../../domain/football';
import { formatHours } from '../../domain/hours';
import { DEFAULT_SETTINGS } from '../../domain/recommendations';
import type { ISODate, Profile } from '../../domain/types';
import { distinctTypes, latestComment, previousWeekStart, shouldShowDigest } from '../../domain/weekDigest';
import { repo } from '../../db/repositories';
import { formatDate } from '../../ui/format';
import { useReport } from '../analysis/useReport';
import { useFootball } from '../football/useFootball';
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
    return { sessions, details: await repo.footballDetailsFor(sessions.map((s) => s.id)) };
  }, [profile.id, period.start, period.end]);
  const football = useFootball(profile.id, period.start, period.end);

  if (!report || !week) return null;
  const logged = week.sessions.filter((s) => !s.estimateConfirmed);
  if (!shouldShowDigest({ lastWeekStart: start, trackingStart: report.trackingStart, sessionCount: logged.length, dismissedFor: dismissed })) return null;

  const close = () => {
    writeSeen(profile.id, start);
    setDismissed(start);
  };
  const { main } = weekModel(report, settings);
  const ev = report.evaluation;
  const fb = football && football.sessions.length ? footballPeriodSummary(football, period) : undefined;
  const g = fb?.games;
  const comment = latestComment(week.sessions, week.details);
  const types = distinctTypes(week.sessions);

  const tiles: [string, string][] = [
    ['Liikuntaa yhteensä', formatHours(report.hours.actualMin)],
    ['Kertoja', `${logged.length}${types > 1 ? ` · ${types} lajia` : ''}`],
  ];
  if (main && ev.evaluable) tiles.unshift([main.label, `${Math.round(main.value)} ${main.unit}`]);
  if (fb && fb.training.count) tiles.push(['Treenit', String(fb.training.count)]);
  if (g && g.games) tiles.push(['Pelit V–T–H', `${g.wins}–${g.draws}–${g.losses}${g.noResult ? ` (+${g.noResult})` : ''}`]);
  if (g && g.playerGoalsGames) tiles.push([`${profile.name}: maalit`, `⚽ ${g.playerGoals}`]);

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
            {main && ev.evaluable && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_CLASS[main.m.status]}`}>{STATUS_TEXT[main.m.status]}</span>}
          </div>
        </div>
        <button type="button" onClick={close} className="press -mr-1 -mt-1 flex size-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-[var(--surface-sunk)] hover:text-slate-900" aria-label="Sulje viime viikon kooste">
          ✕
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {tiles.map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-2xl bg-[var(--surface-sunk)] px-3 py-2">
            <dt className="text-[11px] font-semibold leading-tight text-slate-500">{label}</dt>
            <dd className="stat truncate text-base font-semibold tabular-nums text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
      {comment && (
        <blockquote className="mt-3 border-l-2 border-[var(--accent)] pl-3 text-sm text-slate-700">
          <span className="line-clamp-2">”{comment.text}”</span>
          <span className="text-xs text-slate-500">{formatDate(comment.date, 'EEEEEE d.M.')}</span>
        </blockquote>
      )}
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
