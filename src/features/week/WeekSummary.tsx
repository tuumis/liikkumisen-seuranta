// Viikon tilanne selkokielellä: yksi pääluku, edistymispalkki ja kolme pientä lukua.
// Tarkemmat luvut (kirjattu vs. perusarvio, tunnit päivittäin) avautuvat "Näytä tarkemmin".

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatHours } from '../../domain/hours';
import { DEFAULT_SETTINGS, RECOMMENDATIONS } from '../../domain/recommendations';
import type { PeriodReport } from '../../domain/report';
import type { DualMeasure, Measure, Profile, Settings } from '../../domain/types';
import { repo } from '../../db/repositories';
import { GROUP_LABEL } from '../../ui/labels';
import { aboutMinutes, num1, statusSentence } from '../../ui/statusText';
import { GoalCard } from '../analysis/GoalCard';
import { HoursCard } from './HoursCard';

const STATUS_STYLE = {
  met: { bar: 'bg-green-600', pill: 'bg-green-100 text-green-900', icon: '✓' },
  near: { bar: 'bg-amber-500', pill: 'bg-amber-100 text-amber-900', icon: '≈' },
  below: { bar: 'bg-slate-400', pill: 'bg-slate-100 text-slate-700', icon: '○' },
} as const;

const pick = (d: DualMeasure, s: Settings) => (s.primaryView === 'logged' ? d.logged : d.combined);

function readOpen(): boolean {
  try {
    return localStorage.getItem('weekDetails') === '1';
  } catch {
    return false;
  }
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

/** `wide`: erittäin leveällä näytöllä tarkemmat luvut näkyvät omina kortteinaan, joten avaus piilotetaan. */
export function WeekSummary({ report, profile, isCurrentWeek, wide = false }: { report: PeriodReport; profile: Profile; isCurrentWeek: boolean; wide?: boolean }) {
  const settings = useLiveQuery(() => repo.getSettings(), []) ?? DEFAULT_SETTINGS;
  const [open, setOpen] = useState(readOpen);
  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem('weekDetails', o ? '0' : '1');
      } catch {
        /* ei tallennusta */
      }
      return !o;
    });
  };

  const ev = report.evaluation;
  const h = report.hours;
  const kind = report.period.kind;

  let main: { label: string; value: string; unit: string; target: string; m: Measure; shortfall: string } | null = null;
  let tiles: { label: string; value: string; sub?: string }[] = [];
  const hoursTile = { label: 'Liikuntaa', value: formatHours(h.actualMin), sub: h.expectedMin ? `arvio ${formatHours(h.expectedMin)}` : undefined };

  if (ev.schoolAge) {
    const s = ev.schoolAge;
    const m = pick(s.mvpaAvg, settings);
    main = { label: 'Reipasta liikuntaa keskimäärin', value: num1(Math.round(m.actual)), unit: 'min / päivä', target: `tavoite ${m.target}`, m, shortfall: aboutMinutes(m, 'min/pv') };
    tiles = [
      hoursTile,
      { label: 'Rasittavia päiviä', value: `${s.vigorousDays.actual} / ${s.vigorousDays.target}`, sub: `≥ ${report.vigorousDay.min} min päivässä` },
      { label: 'Lihas · luusto', value: `${s.muscleDays.actual} · ${s.boneDays.actual}`, sub: `tavoite ${RECOMMENDATIONS.school_age.muscleDaysPerWeek.value} pv kumpaakin` },
    ];
  } else if (ev.earlyYears) {
    const e = ev.earlyYears;
    const m = pick(e.daysMet, settings);
    main = { label: 'Päiviä, joina suositus täyttyi', value: String(m.actual), unit: `/ ${m.target} päivää`, target: '3 h liikkumista, josta 1 h vauhdikasta', m, shortfall: `${m.target - m.actual} päivää` };
    tiles = [
      hoursTile,
      { label: 'Liikkumista ka.', value: `${Math.round(pick(e.totalAvg, settings).actual)} min`, sub: 'tavoite 180 / pv' },
      { label: 'Vauhdikasta ka.', value: `${Math.round(pick(e.mvpaAvg, settings).actual)} min`, sub: 'tavoite 60 / pv' },
    ];
  } else if (ev.adult) {
    const a = ev.adult;
    const m = pick(a.weighted, settings);
    main = { label: 'Reipas + 2 × rasittava', value: String(Math.round(m.actual)), unit: 'min', target: `tavoite ${Math.round(m.target)}${ev.n < 7 && kind === 'week' ? ' tähän mennessä' : ''}`, m, shortfall: aboutMinutes(m, 'min') };
    tiles = [
      hoursTile,
      { label: 'Lihaskunto', value: `${a.muscleDays.actual} / ${a.muscleDays.target}`, sub: 'päivää viikossa' },
      { label: 'Kirjauksia', value: String(report.days.reduce((n, d) => n + d.sessionCount, 0)), sub: 'tällä viikolla' },
    ];
  }

  const style = main ? STATUS_STYLE[main.m.status] : STATUS_STYLE.below;

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">{isCurrentWeek ? 'Tämä viikko' : 'Viikon tilanne'}</h2>
        <span className="truncate text-xs text-slate-500">
          {profile.name} · {GROUP_LABEL[report.group.group]}
        </span>
      </div>

      {!ev.evaluable || !main ? (
        <p className="mt-3 text-sm text-slate-600">Tälle viikolle ei vielä ole vertailtavia päiviä. Kirjaa liikuntaa +-painikkeesta, niin tilanne näkyy tässä.</p>
      ) : (
        <>
          <div className={`mt-3 ${ev.quality.lowData ? 'opacity-60' : ''}`}>
            <div className="text-sm text-slate-600">{main.label}</div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="text-4xl font-semibold tracking-tight tabular-nums text-slate-900">≈ {main.value}</span>
              <span className="text-sm text-slate-600">{main.unit}</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
              <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${Math.min(100, main.m.ratio * 100)}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${style.pill}`}>
                {style.icon} {statusSentence(main.m, main.shortfall, kind)}
              </span>
              <span className="text-xs text-slate-500">{main.target}</span>
            </div>
            {ev.quality.lowData && <p className="mt-2 text-xs text-slate-600">Kirjauksia on vielä vähän, joten vertailu on suuntaa antava.</p>}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {tiles.map((t) => (
              <Tile key={t.label} {...t} />
            ))}
          </div>
        </>
      )}

      <div className={`mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 ${wide ? '2xl:hidden' : ''}`}>
        <span className="text-[11px] text-slate-500">≈ = arvio lajin tyypillisestä tehosta</span>
        <button type="button" onClick={toggle} className="min-h-9 rounded-lg px-2 text-sm font-medium text-green-800 hover:bg-green-50" aria-expanded={open}>
          {open ? 'Piilota tarkemmat' : 'Näytä tarkemmin'}
        </button>
      </div>

      {open && (
        <div className={`mt-3 space-y-4 ${wide ? '2xl:hidden' : ''}`}>
          <div className="rounded-xl bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
            <GoalCard report={report} variant="compact" />
          </div>
          <HoursCard report={report} isCurrentWeek={isCurrentWeek} />
        </div>
      )}
    </section>
  );
}
