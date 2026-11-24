// Viikon tilanne: sankarikortti (pääluku edistymisrenkaassa + kolme tunnuslukua) ja avattavat
// tarkemmat luvut. Laskenta tulee raportista (domain); tässä vain esitys.

import { useLiveQuery } from 'dexie-react-hooks';
import { formatHours, hoursBand } from '../../domain/hours';
import { DEFAULT_SETTINGS, RECOMMENDATIONS } from '../../domain/recommendations';
import type { PeriodReport } from '../../domain/report';
import type { DualMeasure, Measure, Profile, Settings } from '../../domain/types';
import { repo } from '../../db/repositories';
import { GROUP_LABEL } from '../../ui/labels';
import { aboutMinutes, num1, statusShort, statusSentence } from '../../ui/statusText';
import { today as todayFn } from '../../ui/today';
import { CountUp } from '../../ui/CountUp';
import { ProgressRing } from '../../ui/ProgressRing';
import { GoalCard } from '../analysis/GoalCard';
import { Term, type TermId } from '../../ui/glossary';
import { Collapse, CollapseToggle, useCollapsible } from '../../ui/Collapse';
import { Sparks, useCelebrateOnce, useMetStreak } from './celebrate';
import { HeroThemePicker, heroThemeProps } from './HeroThemePicker';
import { useIsDark } from '../../ui/theme';

const pick = (d: DualMeasure, s: Settings) => (s.primaryView === 'logged' ? d.logged : d.combined);

export interface WeekModel {
  main: { label: string; value: number; unit: string; target: string; m: Measure; shortfall: string } | null;
  tiles: { label: string; value: string; sub?: string; term?: TermId }[];
}

/** Pääluku ja tunnusluvut suositusryhmän mukaan (kouluikäinen, alle kouluikäinen, aikuinen). */
export function weekModel(report: PeriodReport, settings: Settings): WeekModel {
  const ev = report.evaluation;
  const h = report.hours;
  const kind = report.period.kind;
  // Kokonaisliikunta kestona (kaikki teho: kevyt, reipas, rasittava) ja siitä reippaan osuus.
  const mvpaMin = report.days.reduce((a, d) => a + d.mvpaCombined, 0);
  const hoursTile = {
    label: 'Liikuntaa yhteensä',
    term: 'total' as TermId,
    value: formatHours(h.actualMin),
    sub: `josta ${report.group.group === 'early_years' ? 'vauhdikasta' : 'reipasta ja rasittavaa'} noin ${formatHours(mvpaMin)}${report.group.group === 'school_age' ? ` · ${hoursBand(h.actualMin).label.toLowerCase()}` : ''}`,
  };

  if (ev.schoolAge) {
    const s = ev.schoolAge;
    const m = pick(s.mvpaAvg, settings);
    return {
      main: { label: 'Reipasta ja rasittavaa keskimäärin', value: m.actual, unit: 'min / päivä', target: `tavoite ${m.target} min/pv`, m, shortfall: aboutMinutes(m, 'min/pv') },
      tiles: [
        hoursTile,
        { label: 'Rasittavia päiviä', term: 'vigorous_day', value: `${s.vigorousDays.actual}/${s.vigorousDays.target}`, sub: `≥ ${report.vigorousDay.min} min päivässä` },
        { label: 'Lihas · luusto', term: 'muscle', value: `${s.muscleDays.actual} · ${s.boneDays.actual}`, sub: `tavoite ${RECOMMENDATIONS.school_age.muscleDaysPerWeek.value} pv kumpaakin` },
      ],
    };
  }
  if (ev.earlyYears) {
    const e = ev.earlyYears;
    const m = pick(e.daysMet, settings);
    return {
      main: { label: 'Päiviä, joina suositus täyttyi', value: m.actual, unit: `/ ${m.target} päivää`, target: '3 h liikkumista, josta 1 h vauhdikasta', m, shortfall: `${m.target - m.actual} päivää` },
      tiles: [
        hoursTile,
        { label: 'Liikkumista ka.', value: `${Math.round(pick(e.totalAvg, settings).actual)} min`, sub: 'kesto, tavoite 180 / pv' },
        { label: 'Vauhdikasta ka.', value: `${Math.round(pick(e.mvpaAvg, settings).actual)} min`, sub: 'tavoite 60 / pv' },
      ],
    };
  }
  if (ev.adult) {
    const a = ev.adult;
    const m = pick(a.weighted, settings);
    return {
      main: {
        label: 'Reipas + 2 × rasittava',
        value: m.actual,
        unit: 'min',
        target: `tavoite ${Math.round(m.target)}${ev.n < 7 && kind === 'week' ? ' tähän mennessä' : ''}`,
        m,
        shortfall: aboutMinutes(m, 'min'),
      },
      tiles: [
        hoursTile,
        { label: 'Lihaskunto', value: `${a.muscleDays.actual}/${a.muscleDays.target}`, sub: 'päivää viikossa' },
        { label: 'Liikuntakertoja', value: String(report.days.reduce((n, d) => n + d.sessionCount, 0)), sub: 'tällä viikolla' },
      ],
    };
  }
  return { main: null, tiles: [] };
}

/** Suositusryhmän tavoite lyhyesti (viikon alun suunnitelmarivi). */
const GROUP_TARGET: Record<PeriodReport['group']['group'], string> = {
  school_age: 'tavoite 60 min reipasta ja rasittavaa päivässä',
  early_years: 'tavoite 3 h liikkumista päivässä, josta 1 h vauhdikasta',
  adult: 'tavoite 150 min reipasta viikossa',
};

/**
 * Viikon alku ennen ensimmäistä arvioitavaa päivää (24.11.2026, käyttäjän toive: "Viikko on vasta alussa"
 * -viesti oli turha): viikon suunnitelma lyhyesti, ei kehotusta eikä painiketta.
 */
export function weekPlanText(report: PeriodReport, upcoming: boolean): { title: string; sub: string } {
  const a = report.adherence;
  const planned = a.planned;
  if (!upcoming) return { title: planned > 0 ? `${planned} ${planned === 1 ? 'kerta' : 'kertaa'} suunniteltu` : 'Ei kirjauksia', sub: 'Viikolta ei ole arvioitavia päiviä.' };
  const parts = [
    planned > 0 && report.hours.expected.sessions > 0 && `yhteensä ${formatHours(report.hours.expected.sessions)}`,
    report.hours.forecastMin > 0 && `arvio koko viikolle noin ${formatHours(report.hours.forecastMin)}`,
    GROUP_TARGET[report.group.group],
  ].filter(Boolean) as string[];
  const sub = parts.join(' · ');
  return {
    title: planned > 0 ? `${planned} ${planned === 1 ? 'kerta' : 'kertaa'} suunniteltu` : 'Ei suunniteltuja kertoja',
    sub: sub.charAt(0).toUpperCase() + sub.slice(1),
  };
}

const PILL = {
  met: 'bg-[var(--hero-pill-bg)] text-[var(--hero-pill-ink)]',
  near: 'bg-[#f3e3cc] text-[#6a4526]',
  below: 'bg-[var(--hero-glass-strong)] text-[var(--hero-ink)]',
} as const;

/** Etusivun pääkortti: metsänvihreä pinta, animoitu rengas ja tunnusluvut. */
export function WeekHero({ report, profile, isCurrentWeek }: { report: PeriodReport; profile: Profile; isCurrentWeek: boolean }) {
  const settings = useLiveQuery(() => repo.getSettings(), []) ?? DEFAULT_SETTINGS;
  const { main, tiles } = weekModel(report, settings);
  const ev = report.evaluation;
  const decimals = main && main.unit.startsWith('min / päivä') ? 0 : 0;
  // Viikko on täysi, kun sen kaikki päivät ovat mukana (sunnuntaina ja sen jälkeen). Kesken viikon
  // tila kertoo tahdin; "Suositus täyttyi", putki ja juhlistus vasta täydestä viikosta (17.11.2026).
  const inProgress = report.period.end > todayFn();
  const met = !!main && ev.evaluable && main.m.status === 'met' && !inProgress;
  const streak = useMetStreak(profile, report.period.start, met);
  const party = useCelebrateOnce(profile.id, report.period.start, met && isCurrentWeek);
  const theme = heroThemeProps(profile, useIsDark());

  return (
    <section
      className="hero anim-rise p-5 sm:p-6 lg:p-7"
      data-hero={theme['data-hero']}
      style={{ ['--i' as string]: 0, ...theme.style }}
      aria-label="Viikon tilanne"
    >
      {/* Asettelu kortin leveyden mukaan (24.11.2026): kapeassa pääpalstassa (PC, sivupalsta auki) lukulaatikot
          menivät rinnakkain liian kapeiksi ja tekstit päällekkäin. */}
      <div className="@container relative z-10">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--hero-ink-soft)]">
            {isCurrentWeek ? 'Tämä viikko' : 'Viikon tilanne'} · {GROUP_LABEL[report.group.group]}
          </div>
          {main && ev.evaluable && (
            <span className={`anim-pop shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${PILL[main.m.status]}`} style={{ animationDelay: '0.9s' }}>
              {statusShort(main.m, inProgress)}
              {met && streak >= 2 && <span className="font-semibold opacity-80"> · {streak} vk putkeen</span>}
            </span>
          )}
        </div>

        {!ev.evaluable || !main ? (
          <div className="py-4">
            <p className="font-display text-2xl font-semibold leading-snug">{weekPlanText(report, inProgress).title}</p>
            <p className="mt-1 max-w-md text-sm text-[var(--hero-ink-soft)]">{weekPlanText(report, inProgress).sub}</p>
          </div>
        ) : (
          <div className={`mt-4 flex flex-col gap-5 @xl:flex-row @xl:items-center @xl:gap-7 ${ev.quality.lowData ? 'opacity-80' : ''}`}>
            <div className={`relative flex items-center gap-5 ${party.sparks ? 'celebrate' : ''}`}>
              {party.sparks && (
                <span className="absolute left-0 top-0 size-[136px]">
                  <Sparks />
                </span>
              )}
              <ProgressRing
                value={main.m.ratio}
                size={136}
                stroke={13}
                color="var(--hero-accent)"
                track="var(--hero-track)"
                label={`${main.label}: ${num1(Math.round(main.value))} ${main.unit}, ${Math.round(main.m.ratio * 100)} % tavoitteesta`}
              >
                <span className="stat text-[40px] font-semibold"><CountUp value={main ? main.value : 0} format={(v) => v.toFixed(decimals).replace('.', ',')} /></span>
                <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--hero-ink-soft)]">{main.unit}</span>
              </ProgressRing>
              <div className="min-w-0 @xl:hidden">
                <div className="text-sm font-semibold leading-snug">{main.label}</div>
                <div className="mt-1 text-xs text-[var(--hero-ink-soft)]">{main.target}</div>
                <div className="mt-2 text-xs leading-snug text-[var(--hero-ink-soft)]">{statusSentence(main.m, main.shortfall, report.period.kind, inProgress)}</div>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="hidden @xl:block">
                <div className="font-display text-xl font-semibold leading-snug lg:text-2xl">{main.label}</div>
                <div className="mt-1 text-sm text-[var(--hero-ink-soft)]">
                  {statusSentence(main.m, main.shortfall, report.period.kind, inProgress)} · {main.target}
                </div>
              </div>
              <dl className="grid grid-cols-3 gap-2 @xl:mt-5 @xl:gap-3">
                {tiles.map((t, i) => (
                  <div key={t.label} className="hero-glass anim-rise rounded-2xl px-3 py-2.5" style={{ ['--i' as string]: i + 2 }}>
                    <dt className="min-h-[2lh] text-[11px] font-bold uppercase leading-tight tracking-wide text-[var(--hero-ink-soft)] @xl:min-h-0">
                      {t.term ? (
                        <Term id={t.term} vigorousMin={report.vigorousDay.min} className="!decoration-[color:var(--hero-line)] text-left" align={i === 2 ? 'right' : 'left'}>
                          {t.label}
                        </Term>
                      ) : (
                        t.label
                      )}
                    </dt>
                    <dd className="stat mt-1.5 text-[22px] font-semibold lg:text-[26px]">{t.value}</dd>
                    {t.sub && <dd className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--hero-ink-soft)] @xl:text-xs">{t.sub}</dd>}
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}
        {party.message && met && (
          <p className="anim-pop mt-4 text-sm font-semibold text-[var(--hero-accent)]" style={{ animationDelay: '1.2s' }} role="status">
            Hienoa – viikon suositus täyttyi{streak >= 2 ? `, ${streak}. viikko putkeen` : ''}!
          </p>
        )}
        {ev.evaluable && ev.quality.lowData && <p className="mt-3 text-xs text-[var(--hero-ink-soft)]">Kirjauksia on vielä vähän, joten vertailu on suuntaa antava.</p>}
        {/* Teeman pikavalinta alarivillä (yläreunassa tila loppui puhelimella). */}
        <div className="-mb-2 mt-2 flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--hero-ink-soft)] opacity-80">Luvut ovat arvioita lajien tyypillisestä tehosta.</p>
          <HeroThemePicker profile={profile} />
        </div>
      </div>
    </section>
  );
}

/** Tarkemmat luvut: suositusvertailu kirjatuista ja arvioiduista minuuteista (pienennettävä). */
export function WeekDetails({ report }: { report: PeriodReport; isCurrentWeek?: boolean }) {
  const [open, toggle] = useCollapsible('weekDetails', false);
  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Suositusvertailu</div>
          <h2 className="font-display text-lg font-semibold text-slate-900">Tarkemmat luvut</h2>
          {!open && <p className="text-xs text-slate-500">Kirjatut ja arvioidut minuutit erikseen, rasittavat ja vahvistavat päivät</p>}
        </div>
        <CollapseToggle open={open} onToggle={toggle} label="Tarkemmat luvut" />
      </div>
      <Collapse open={open}>
        <div className="card-sunk mt-4 p-3 text-sm">
          <GoalCard report={report} variant="compact" />
        </div>
      </Collapse>
    </section>
  );
}
