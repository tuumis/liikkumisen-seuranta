// "Viime viikko lyhyesti" (SPEC 16): viikon ensimmäisellä avauksella edellisen viikon kooste
// Viikko-näkymän yläosassa. Tiivis nauha: pääluku ja muutos edelliseen viikkoon, päivien minipylväät
// ja muutama tunnusluku. Suljettu kooste tallennetaan profiiliin (synkronoituu laitteiden välillä).

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays, isoWeek, weekPeriod } from '../../domain/dates';
import { footballPeriodSummary } from '../../domain/football';
import { formatHours } from '../../domain/hours';
import { DEFAULT_SETTINGS, RECOMMENDATIONS } from '../../domain/recommendations';
import type { DayTotals, ISODate, Profile, RecommendationGroup } from '../../domain/types';
import { previousWeekStart, shouldShowDigest } from '../../domain/weekDigest';
import { repo } from '../../db/repositories';
import { formatDate } from '../../ui/format';
import { useReport } from '../analysis/useReport';
import { useFootball } from '../football/useFootball';
import { useFootballEnabled } from '../football/useFootballEnabled';
import { weekModel } from './WeekSummary';

// Vanha laitekohtainen muisti (ennen profiiliin tallennusta); luetaan edelleen, ettei suljettu palaa.
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
    /* ei tallennusta: profiilin tieto riittää */
  }
}
const later = (...ds: (ISODate | undefined)[]) => ds.filter((d): d is ISODate => !!d).sort().pop();

const STATUS_TEXT = { met: '✓ Suositus täyttyi', near: '≈ Lähellä suositusta', below: '○ Alle suosituksen' } as const;
const STATUS_CLASS = {
  met: 'bg-green-100 text-green-900',
  near: 'bg-amber-100 text-amber-900',
  below: 'bg-slate-100 text-slate-700',
} as const;

/** Päiväpylvään tavoite (sama kuin viikkonäkymän palkeissa). */
const DAY_TARGET: Record<RecommendationGroup, number> = {
  early_years: RECOMMENDATIONS.early_years.mvpaMinPerDay.value,
  school_age: RECOMMENDATIONS.school_age.mvpaAvgMinPerDay.value,
  adult: RECOMMENDATIONS.adult.weightedMinPerWeek.value / 7,
};
const WD = ['ma', 'ti', 'ke', 'to', 'pe', 'la', 'su'];

/** Viikon päivät minipylväinä: reipas ja rasittava, katkoviiva = päivän tavoite. */
function DayBars({ days, valid, target }: { days: DayTotals[]; valid: Set<ISODate>; target: number }) {
  const max = Math.max(target * 1.5, ...days.map((d) => d.mvpaCombined));
  const H = 44;
  const label = days.map((d, i) => `${WD[i]} ${Math.round(d.mvpaCombined)} min`).join(', ');
  return (
    <div className="w-full max-w-[13rem] shrink-0" role="img" aria-label={`Reipas ja rasittava päivittäin: ${label}. Tavoite ${Math.round(target)} min.`}>
      <div className="relative flex items-end gap-1.5" style={{ height: H }}>
        <div className="absolute inset-x-0 border-t border-dashed border-slate-400/70" style={{ bottom: (target / max) * H }} aria-hidden />
        {days.map((d) => {
          const v = d.mvpaCombined;
          const met = v >= target;
          return (
            <div
              key={d.date}
              title={`${formatDate(d.date, 'EEEEEE d.M.')}: ${Math.round(v)} min`}
              className={`flex-1 rounded-t-[4px] ${met ? 'bg-green-700' : 'bg-slate-300'} ${valid.has(d.date) ? '' : 'opacity-40'}`}
              style={{ height: Math.max(3, (v / max) * H) }}
            />
          );
        })}
      </div>
      <div className="mt-1 flex gap-1.5 text-center text-[10px] font-semibold uppercase text-slate-500" aria-hidden>
        {WD.map((w) => (
          <span key={w} className="flex-1">
            {w}
          </span>
        ))}
      </div>
    </div>
  );
}

export function LastWeekCard({ profile, today, onOpenWeek }: { profile: Profile; today: ISODate; onOpenWeek: (weekStart: ISODate) => void }) {
  const start = previousWeekStart(today);
  const period = weekPeriod(start);
  const prevPeriod = weekPeriod(addDays(start, -7));
  // Sulkeminen piilottaa heti (tila profiileittain); pysyvästi profiiliin ja laitteen muistiin.
  const [closedNow, setClosedNow] = useState<Record<string, ISODate>>({});
  const report = useReport(profile, period);
  const prev = useReport(profile, prevPeriod);
  const settings = useLiveQuery(() => repo.getSettings(), []) ?? DEFAULT_SETTINGS;
  const week = useLiveQuery(async () => (await repo.sessionsInRange(profile.id, period.start, period.end)).filter((s) => !s.deletedAt), [profile.id, period.start, period.end]);
  const footballOn = useFootballEnabled(profile);
  const football = useFootball(footballOn ? profile.id : undefined, period.start, period.end);

  if (!report || !week) return null;
  const dismissedFor = later(profile.digestSeenWeek, readSeen()[profile.id], closedNow[profile.id]);
  const logged = week.filter((s) => !s.estimateConfirmed);
  if (!shouldShowDigest({ lastWeekStart: start, trackingStart: report.trackingStart, sessionCount: logged.length, dismissedFor })) return null;

  const close = () => {
    setClosedNow((c) => ({ ...c, [profile.id]: start }));
    writeSeen(profile.id, start);
    void repo.markDigestSeen(profile.id, start);
  };
  const { main, tiles: weekTiles } = weekModel(report, settings);
  const showMain = main && report.evaluation.evaluable;
  const prevMain = prev && prev.evaluation.evaluable ? weekModel(prev, settings).main : null;
  const delta = showMain && prevMain && prevMain.unit === main.unit ? Math.round(main.value) - Math.round(prevMain.value) : undefined;
  const deltaText =
    delta === undefined ? undefined : delta === 0 ? 'sama kuin edellisellä viikolla' : `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta)} edelliseen viikkoon`;

  // Tunnusluvut: liikunta yhteensä ja jalkapallo, tai ilman jalkapalloa viikkonäkymän omat luvut.
  const fb = football && football.sessions.length ? footballPeriodSummary(football, period) : undefined;
  const g = fb?.games;
  const stats: { value: string; label: string }[] = [{ value: formatHours(report.hours.actualMin), label: 'liikuntaa' }];
  if (footballOn) {
    if (fb?.training.count) stats.push({ value: String(fb.training.count), label: fb.training.count === 1 ? 'treeni' : 'treeniä' });
    if (g?.games) stats.push({ value: `${g.wins}–${g.draws}–${g.losses}`, label: g.noResult ? `V–T–H (+${g.noResult})` : 'pelit V–T–H' });
    if (g?.playerGoalsGames) stats.push({ value: `⚽ ${g.playerGoals}`, label: `${profile.name}: maalit` });
  } else {
    for (const t of weekTiles.slice(1)) stats.push({ value: t.value, label: t.label.toLowerCase() });
  }

  // Kiinnostava poiminta: tavoitepäivät ja viikon paras päivä.
  const target = DAY_TARGET[report.group.group];
  const valid = new Set(report.validDates);
  const best = [...report.allDays].sort((a, b) => b.mvpaCombined - a.mvpaCombined)[0];
  const metDays = report.allDays.filter((d) => d.mvpaCombined >= target).length;

  const open = () => {
    close();
    onOpenWeek(start);
  };

  return (
    <section className="card anim-rise p-4 sm:px-5" aria-label="Viime viikko lyhyesti">
      <div className="-mr-2 -mt-2 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Viime viikko · vk {isoWeek(start).week}
          <span className="max-sm:hidden">
            {' · '}
            {formatDate(period.start, 'd.M.')}–{formatDate(period.end, 'd.M.')}
          </span>
        </span>
        <button type="button" onClick={open} className="press min-h-10 shrink-0 rounded-xl px-2.5 text-sm font-semibold text-green-800 hover:bg-green-50">
          Avaa viikko ›
        </button>
        <button
          type="button"
          onClick={close}
          className="press flex size-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-[var(--surface-sunk)] hover:text-slate-900"
          aria-label="Sulje viime viikon kooste"
          title="Sulje (ei näytetä uudelleen tältä viikolta)"
        >
          ✕
        </button>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-4">
        {showMain && (
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-500">{main.label}</div>
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
              <span className="stat text-[2.5rem] font-semibold leading-none tabular-nums text-slate-900">{Math.round(main.value)}</span>
              <span className="text-sm font-semibold text-slate-600">{main.unit}</span>
              <span className={`ml-1 self-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_CLASS[main.m.status]}`}>{STATUS_TEXT[main.m.status]}</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {main.target}
              {deltaText && (
                <>
                  {' · '}
                  <span className={delta! > 0 ? 'font-semibold text-green-800' : delta! < 0 ? 'font-semibold text-slate-700' : ''}>{deltaText}</span>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-1">
          <DayBars days={report.allDays} valid={valid} target={target} />
          {best && best.mvpaCombined > 0 && (
            <div className="text-[11px] leading-tight text-slate-500">
              {metDays}/7 päivää tavoitteessa · paras {formatDate(best.date, 'EEEEEE')} {Math.round(best.mvpaCombined)} min
            </div>
          )}
        </div>

        <dl className="flex flex-wrap gap-x-5 gap-y-2 sm:border-l sm:border-slate-200 sm:pl-6">
          {stats.map((s) => (
            <div key={s.label} className="flex min-w-0 flex-col-reverse">
              <dt className="text-xs text-slate-500">{s.label}</dt>
              <dd className="stat text-xl font-semibold leading-tight tabular-nums text-slate-900">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
