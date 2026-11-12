// Päiväkooste ja jakson arviointi (SPEC 3, 7.1–7.8).

import { datesBetween, isWeekend, timestampToLocalDate } from './dates';
import { addMinutes, minutesFromShares, mvpaOf, totalOf, ZERO_MINUTES } from './intensity';
import { APP_INTERPRETATIONS, RECOMMENDATIONS } from './recommendations';
import type {
  ActivityType,
  AdultEvaluation,
  Category,
  CategoryTotals,
  DataQuality,
  DayFlag,
  DayTotals,
  DualMeasure,
  EarlyYearsEvaluation,
  Estimate,
  IntensityMinutes,
  ISODate,
  Measure,
  Period,
  PeriodEvaluation,
  Profile,
  RecommendationGroup,
  SchoolAgeEvaluation,
  Session,
  Settings,
  Status,
  UUID,
} from './types';

const EPS = 1e-9;

// ---------- perusarvio ----------

/** Onko perusarvio voimassa päivänä d (validFrom ≤ d ≤ validTo, molemmat mukaan luettuina). */
export function isEstimateValidOn(e: Estimate, d: ISODate): boolean {
  return !e.deletedAt && e.validFrom <= d && (e.validTo === undefined || d <= e.validTo);
}

/** Kategorian voimassa oleva arvio; päällekkäisistä uusin validFrom (sitten updatedAt) voittaa. */
export function activeEstimate(estimates: Estimate[], category: Category, d: ISODate): Estimate | undefined {
  let best: Estimate | undefined;
  for (const e of estimates) {
    if (e.category !== category || !isEstimateValidOn(e, d)) continue;
    if (
      !best ||
      e.validFrom > best.validFrom ||
      (e.validFrom === best.validFrom && e.updatedAt > best.updatedAt)
    ) {
      best = e;
    }
  }
  return best;
}

/** Arvion minuutit päivälle: arki- tai viikonloppuarvo × tehoprofiili, Math.round. */
export function estimateMinutes(e: Estimate, d: ISODate): IntensityMinutes {
  const base = isWeekend(d) ? e.weekendMin : e.weekdayMin;
  return minutesFromShares(base, e.shares);
}

// ---------- 7.1 päiväkooste ----------

/**
 * Päiväkooste profiilin yhdelle päivälle. Kutsuja antaa saman profiilin kerrat
 * ja arviot; muiden päivien kerrat ja poistomerkityt tietueet ohitetaan.
 *
 * Korvausperiaate: jokaiselle kategorialle käytetään joko kirjauksia tai
 * perusarviota, ei molempia. Perusarvio ei koskaan tuota rasittavaa eikä
 * vahvistavaa päivää.
 */
export function dayTotals(
  date: ISODate,
  sessions: Session[],
  estimates: Estimate[],
  types: Map<UUID, ActivityType>,
): DayTotals {
  const byCategory: Partial<Record<Category, CategoryTotals>> = {};
  let logged: IntensityMinutes = { ...ZERO_MINUTES };
  let muscle = false;
  let bone = false;
  let sessionCount = 0;

  for (const s of sessions) {
    if (s.date !== date || s.deletedAt) continue;
    const category: Category = types.get(s.activityTypeId)?.category ?? 'other';
    logged = addMinutes(logged, s.minutes);
    const prev = byCategory[category]?.minutes ?? ZERO_MINUTES;
    byCategory[category] = { source: 'logged', minutes: addMinutes(prev, s.minutes) };
    muscle ||= s.muscle;
    bone ||= s.bone;
    sessionCount++;
  }

  let estimate: IntensityMinutes = { ...ZERO_MINUTES };
  const estimatedCategories: Category[] = [];
  const validEstimates = estimates.filter((e) => isEstimateValidOn(e, date));
  const categories = [...new Set(validEstimates.map((e) => e.category))];
  for (const c of categories) {
    if (byCategory[c]) continue; // kirjaukset korvaavat arvion
    const e = activeEstimate(validEstimates, c, date);
    if (!e) continue;
    const m = estimateMinutes(e, date);
    estimate = addMinutes(estimate, m);
    byCategory[c] = { source: 'estimate', minutes: m };
    estimatedCategories.push(c);
  }

  const combined = addMinutes(logged, estimate);
  return {
    date,
    logged,
    estimate,
    combined,
    mvpa: mvpaOf(logged),
    mvpaCombined: mvpaOf(combined),
    total: totalOf(logged),
    totalCombined: totalOf(combined),
    muscle,
    bone,
    sessionCount,
    estimatedCategories,
    estimateAvailable: validEstimates.length > 0,
    byCategory,
  };
}

// ---------- 7.2 kelvolliset päivät ----------

/** Seurannan alku = käyttäjän asettama päivä tai profiilin luontipäivä (paikallinen päivä). */
export function trackingStart(profile: Pick<Profile, 'createdAt' | 'trackingStart'>): ISODate {
  return profile.trackingStart ?? timestampToLocalDate(profile.createdAt);
}

/**
 * Jakson kelvolliset päivät: ≤ tänään, ≥ seurannan alku eikä DayFlag-merkintää.
 */
export function validDays(
  period: Period,
  profile: Pick<Profile, 'id' | 'createdAt' | 'trackingStart'>,
  flags: DayFlag[],
  today: ISODate,
): ISODate[] {
  const start = trackingStart(profile);
  const flagged = new Set(flags.filter((f) => f.profileId === profile.id && !f.deletedAt).map((f) => f.date));
  return datesBetween(period.start, period.end).filter((d) => d <= today && d >= start && !flagged.has(d));
}

// ---------- 7.7 tila ----------

export function statusOf(actual: number, target: number): Status {
  const ratio = target > 0 ? actual / target : 1;
  if (ratio >= 1 - EPS) return 'met';
  if (ratio >= APP_INTERPRETATIONS.NEAR_THRESHOLD - EPS) return 'near';
  return 'below';
}

export function measure(actual: number, target: number): Measure {
  return {
    actual,
    target,
    ratio: target > 0 ? actual / target : 1,
    status: statusOf(actual, target),
    shortfall: Math.max(0, target - actual),
  };
}

function dual(logged: number, combined: number, target: number): DualMeasure {
  return { logged: measure(logged, target), combined: measure(combined, target) };
}

// ---------- 7.8 datan laatu ----------

/** Arvion osuus = (MVPA* − MVPA) / MVPA*; 0, kun MVPA* = 0. */
export function estimateShare(mvpaLogged: number, mvpaCombined: number): number {
  return mvpaCombined > 0 ? (mvpaCombined - mvpaLogged) / mvpaCombined : 0;
}

export function dataQuality(days: DayTotals[]): DataQuality {
  const n = days.length;
  const covered = days.filter((d) => d.sessionCount > 0).length;
  const coverage = n > 0 ? covered / n : 0;
  const sumLogged = days.reduce((a, d) => a + d.mvpa, 0);
  const sumCombined = days.reduce((a, d) => a + d.mvpaCombined, 0);
  const hasEstimates = days.some((d) => d.estimateAvailable);
  return {
    coverage,
    estimateShare: estimateShare(sumLogged, sumCombined),
    lowData: coverage < APP_INTERPRETATIONS.LOW_COVERAGE && !hasEstimates,
  };
}

// ---------- 7.3–7.5 jakson arviointi ----------

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function evaluateSchoolAge(days: DayTotals[], settings: Settings): SchoolAgeEvaluation {
  const r = RECOMMENDATIONS.school_age;
  const n = days.length;
  const target = r.mvpaAvgMinPerDay.value;
  return {
    mvpaAvg: dual(sum(days.map((d) => d.mvpa)) / n, sum(days.map((d) => d.mvpaCombined)) / n, target),
    activeDays: {
      logged: days.filter((d) => d.mvpa >= target).length,
      combined: days.filter((d) => d.mvpaCombined >= target).length,
    },
    // Päivämäärämittarit vain kirjatuista.
    vigorousDays: measure(
      days.filter((d) => d.logged.vigorous >= settings.vigorousDayMin).length,
      r.vigorousDaysPerWeek.value,
    ),
    muscleDays: measure(days.filter((d) => d.muscle).length, r.muscleDaysPerWeek.value),
    boneDays: measure(days.filter((d) => d.bone).length, r.boneDaysPerWeek.value),
  };
}

/** Täyttyykö alle kouluikäisen päiväsuositus: kokonais ≥ 180 ja vauhdikas ≥ 60. */
export function earlyYearsDayMet(total: number, mvpa: number): boolean {
  const r = RECOMMENDATIONS.early_years;
  return total >= r.totalMinPerDay.value && mvpa >= r.mvpaMinPerDay.value;
}

function evaluateEarlyYears(days: DayTotals[]): EarlyYearsEvaluation {
  const r = RECOMMENDATIONS.early_years;
  const n = days.length;
  return {
    // Tila täyttyneiden päivien osuudesta (vahvistettu tulkinta).
    daysMet: dual(
      days.filter((d) => earlyYearsDayMet(d.total, d.mvpa)).length,
      days.filter((d) => earlyYearsDayMet(d.totalCombined, d.mvpaCombined)).length,
      n,
    ),
    totalAvg: dual(sum(days.map((d) => d.total)) / n, sum(days.map((d) => d.totalCombined)) / n, r.totalMinPerDay.value),
    mvpaAvg: dual(sum(days.map((d) => d.mvpa)) / n, sum(days.map((d) => d.mvpaCombined)) / n, r.mvpaMinPerDay.value),
  };
}

function evaluateAdult(days: DayTotals[]): AdultEvaluation {
  const r = RECOMMENDATIONS.adult;
  const n = days.length;
  const k = r.vigorousWeight.value;
  const w = (mins: IntensityMinutes[]) => sum(mins.map((m) => m.moderate)) + k * sum(mins.map((m) => m.vigorous));
  const target = (r.weightedMinPerWeek.value * n) / 7; // kesken olevalla viikolla osaviikon tavoite
  return {
    weighted: dual(w(days.map((d) => d.logged)), w(days.map((d) => d.combined)), target),
    // Erillisinä päivinä: kaksi kertaa samana päivänä on yksi kerta.
    muscleDays: measure(days.filter((d) => d.muscle).length, r.muscleDaysPerWeek.value),
  };
}

/**
 * Jakson arviointi. `days` = kelvollisten päivien (validDays) päiväkoosteet.
 * Päivämäärätavoitteet (≥ 3 pv / ≥ 2 pv) ovat viikkotavoitteita; pidempien
 * jaksojen viikkokohtainen arviointi (7.6) tehdään viikko kerrallaan.
 */
export function evaluatePeriod(
  group: RecommendationGroup,
  days: DayTotals[],
  settings: Settings,
): PeriodEvaluation {
  const n = days.length;
  const quality = dataQuality(days);
  if (n === 0) return { group, n, evaluable: false, quality };
  const base: PeriodEvaluation = { group, n, evaluable: true, quality };
  switch (group) {
    case 'school_age':
      return { ...base, schoolAge: evaluateSchoolAge(days, settings) };
    case 'early_years':
      return { ...base, earlyYears: evaluateEarlyYears(days) };
    case 'adult':
      return { ...base, adult: evaluateAdult(days) };
  }
}
