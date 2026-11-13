// Pitkän aikavälin analytiikka (SPEC 9, vaihe 7): kuukausi, kausi ja vuosi samoista päiväkoosteista
// kuin viikkoanalyysi. Puhdas funktio jakson raportista ja kerroista; ei tallennettua tilastotaulua.

import { evaluatePeriod } from './aggregate';
import { addDays, isoWeek, monthPeriod, parseISODate, seasonPeriod, startOfIsoWeek, yearPeriod } from './dates';
import { contextOf } from './groups';
import { isEstimateConfirmation } from './hours';
import { mvpaOf, totalOf } from './intensity';
import type { PeriodReport } from './report';
import type { ActivityType, Context, DayTotals, ISODate, MovementGroup, Period, PeriodKind, RecommendationGroup, Session, Settings, UUID } from './types';

export type LongKind = Exclude<PeriodKind, 'week'>;

/** Jakso päivän mukaan. */
export const periodOf = (kind: LongKind, d: ISODate): Period => (kind === 'month' ? monthPeriod(d) : kind === 'season' ? seasonPeriod(d) : yearPeriod(d));
/** Edellinen samanlainen jakso (edellinen kuukausi, kausi tai vuosi). */
export const previousPeriod = (p: Period): Period => periodOf(p.kind as LongKind, addDays(p.start, -1));
export const nextPeriod = (p: Period): Period => periodOf(p.kind as LongKind, addDays(p.end, 1));

const MONTHS = ['tammi', 'helmi', 'maalis', 'huhti', 'touko', 'kesä', 'heinä', 'elo', 'syys', 'loka', 'marras', 'joulu'];
const SEASON_NAME = (month: number) => (month <= 5 ? 'Kevät' : month <= 8 ? 'Kesä' : 'Syksy');

/** Jakson nimi: "marraskuu 2026", "Syksy 2026", "2026". */
export function periodName(p: Period): string {
  const { year, month } = parseISODate(p.start);
  if (p.kind === 'month') return `${MONTHS[month - 1]}kuu ${year}`;
  if (p.kind === 'season') return `${SEASON_NAME(month)} ${year}`;
  return String(year);
}

export interface TrendBucket {
  key: string;
  /** Lyhyt nimi kaavioon: "loka" tai "vk 45". */
  label: string;
  start: ISODate;
  end: ISODate;
  validDays: number;
  /** Reipas ja rasittava ka. min/pv: kirjattu ja kirjattu + arvio. */
  mvpaLogged: number;
  mvpaCombined: number;
  /** Osuus kelvollisista päivistä, joilla on kirjaus. */
  coverage: number;
}

export interface WeeklyGoal {
  key: 'mvpa' | 'vigorous' | 'muscle' | 'bone' | 'daysMet' | 'weighted';
  label: string;
  met: number;
}

export interface TypeTotal {
  typeId: UUID;
  name: string;
  icon: string;
  count: number;
  minutes: number;
}

export interface LongTermSummary {
  period: Period;
  group: RecommendationGroup;
  validDays: number;
  /** Ka. min/pv kelvollisilta päiviltä; null kun kelvollisia päiviä ei ole. */
  mvpa: { logged: number; combined: number } | null;
  total: { logged: number; combined: number } | null;
  /** Rasittavan osuus kirjatusta reippaasta ja rasittavasta. */
  vigorousShare: number | null;
  /** Kirjatun MVPA:n jakauma kontekstin mukaan (ohjattu, omaehtoinen, arki); null kun kirjattua ei ole. */
  context: Record<Context, number> | null;
  /** Eri liikuntaryhmät (ei "vaihtelee"/"muu") ja lajit kirjatuista kerroista. */
  variety: { groups: MovementGroup[]; types: number };
  byType: TypeTotal[];
  /** Viikkotavoitteet (7.6): viikot, joilla ≥ 4 kelvollista päivää, ja täyttyneet tavoitteittain. */
  weeks: { evaluated: number; goals: WeeklyGoal[] };
  quality: { coverage: number; estimateShare: number };
  buckets: TrendBucket[];
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const NOT_VARIETY: MovementGroup[] = ['varies', 'other'];

function bucketsOf(period: Period, days: DayTotals[], valid: Set<ISODate>): TrendBucket[] {
  const keyOf = (d: ISODate) => (period.kind === 'month' ? startOfIsoWeek(d) : d.slice(0, 7));
  const groups = new Map<string, DayTotals[]>();
  for (const d of days) {
    const k = keyOf(d.date);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(d);
  }
  return [...groups.entries()].map(([key, all]) => {
    const v = all.filter((d) => valid.has(d.date));
    const m = MONTHS[parseISODate(`${key}-01`).month - 1];
    // Vuodessa 12 palkkia: kolmen kirjaimen lyhenne, ettei akseli mene päällekkäin.
    const label = period.kind === 'month' ? `vk ${isoWeek(key).week}` : period.kind === 'year' ? m.slice(0, 3) : m;
    return {
      key,
      label,
      start: all[0].date,
      end: all[all.length - 1].date,
      validDays: v.length,
      mvpaLogged: avg(v.map((d) => d.mvpa)),
      mvpaCombined: avg(v.map((d) => d.mvpaCombined)),
      coverage: v.length ? v.filter((d) => d.sessionCount > 0).length / v.length : 0,
    };
  });
}

function weeklyGoals(report: PeriodReport, settings: Settings): LongTermSummary['weeks'] {
  const byWeek = new Map<ISODate, DayTotals[]>();
  for (const d of report.days) {
    const k = startOfIsoWeek(d.date);
    if (!byWeek.has(k)) byWeek.set(k, []);
    byWeek.get(k)!.push(d);
  }
  const group = report.group.group;
  const keys: WeeklyGoal['key'][] =
    group === 'school_age' ? ['mvpa', 'vigorous', 'muscle', 'bone'] : group === 'early_years' ? ['daysMet'] : ['weighted', 'muscle'];
  const LABEL: Record<WeeklyGoal['key'], string> = {
    mvpa: 'Reipas ja rasittava ka. ≥ 60 min/pv',
    vigorous: 'Rasittavia päiviä ≥ 3',
    muscle: group === 'adult' ? 'Lihaskuntoa ≥ 2 pv' : 'Lihaksia vahvistavaa ≥ 3 pv',
    bone: 'Luustoa vahvistavaa ≥ 3 pv',
    daysMet: 'Päiväsuositus täyttyi joka päivä',
    weighted: 'Reipas + 2 × rasittava ≥ 150 min',
  };
  const met = Object.fromEntries(keys.map((k) => [k, 0])) as Record<WeeklyGoal['key'], number>;
  let evaluated = 0;
  const s = { ...settings, vigorousDayMin: report.vigorousDay.min };
  for (const days of byWeek.values()) {
    if (days.length < 4) continue;
    evaluated++;
    const e = evaluatePeriod(group, days, s);
    if (e.schoolAge) {
      if (e.schoolAge.mvpaAvg.combined.status === 'met') met.mvpa++;
      if (e.schoolAge.vigorousDays.status === 'met') met.vigorous++;
      if (e.schoolAge.muscleDays.status === 'met') met.muscle++;
      if (e.schoolAge.boneDays.status === 'met') met.bone++;
    }
    if (e.earlyYears && e.earlyYears.daysMet.combined.status === 'met') met.daysMet++;
    if (e.adult) {
      // Viikon tavoite suhteutetaan kelvollisiin päiviin (kuten viikkoarviossa).
      if (e.adult.weighted.combined.status === 'met') met.weighted++;
      if (e.adult.muscleDays.status === 'met') met.muscle++;
    }
  }
  return { evaluated, goals: keys.map((k) => ({ key: k, label: LABEL[k], met: met[k] })) };
}

export function longTermSummary(report: PeriodReport, sessions: Session[], types: Map<UUID, ActivityType>, settings: Settings): LongTermSummary {
  const valid = new Set(report.validDates);
  const days = report.days;
  const n = days.length;
  const loggedMvpa = days.reduce((a, d) => a + d.mvpa, 0);
  const loggedVig = days.reduce((a, d) => a + d.logged.vigorous, 0);

  // Kontekstit kirjatusta MVPA:sta (kategoriajakaumasta, kelvolliset päivät).
  const ctx: Record<Context, number> = { organized: 0, self_directed: 0, everyday: 0 };
  for (const c of report.byCategory) ctx[contextOf(c.category)] += mvpaOf(c.logged);
  const ctxSum = ctx.organized + ctx.self_directed + ctx.everyday;

  const own = sessions.filter((s) => !s.deletedAt && valid.has(s.date) && !isEstimateConfirmation(s));
  const byType = new Map<UUID, TypeTotal>();
  const groups = new Set<MovementGroup>();
  for (const s of own) {
    const t = types.get(s.activityTypeId);
    if (t && !NOT_VARIETY.includes(t.movementGroup)) groups.add(t.movementGroup);
    const row = byType.get(s.activityTypeId) ?? { typeId: s.activityTypeId, name: t?.name ?? 'Muu', icon: t?.icon ?? '•', count: 0, minutes: 0 };
    row.count++;
    row.minutes += s.durationMin;
    byType.set(s.activityTypeId, row);
  }

  return {
    period: report.period,
    group: report.group.group,
    validDays: n,
    mvpa: n ? { logged: loggedMvpa / n, combined: days.reduce((a, d) => a + d.mvpaCombined, 0) / n } : null,
    total: n ? { logged: days.reduce((a, d) => a + d.total, 0) / n, combined: days.reduce((a, d) => a + d.totalCombined, 0) / n } : null,
    vigorousShare: loggedMvpa > 0 ? loggedVig / loggedMvpa : null,
    context: ctxSum > 0 ? { organized: ctx.organized / ctxSum, self_directed: ctx.self_directed / ctxSum, everyday: ctx.everyday / ctxSum } : null,
    variety: { groups: [...groups], types: byType.size },
    byType: [...byType.values()].sort((a, b) => b.minutes - a.minutes || b.count - a.count),
    weeks: weeklyGoals(report, settings),
    quality: { coverage: report.evaluation.quality.coverage, estimateShare: report.evaluation.quality.estimateShare },
    buckets: bucketsOf(report.period, report.allDays, valid),
  };
}

/** Kokonaisliikunta (L+M+V) päiväkoosteesta; viedään näyttöön totalOf-yhteensopivana. */
export const dayTotal = (d: DayTotals) => totalOf(d.combined);
