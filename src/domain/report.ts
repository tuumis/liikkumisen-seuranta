// Jakson raportti: kokoaa päiväkoosteet, kelvolliset päivät, suositusvertailun,
// datan laadun, kategoriajakauman ja suunnitelma vs. toteuma -vertailun (SPEC 7).
// Puhdas funktio: kaikki data annetaan parametreina.

import { planAdherence } from './adherence';
import { weeklyHours, type WeeklyHours } from './hours';
import { vigorousDayThreshold, type VigorousThreshold } from './vigorous';
import { dayTotals, evaluatePeriod, trackingStart, validDays } from './aggregate';
import { datesBetween } from './dates';
import { periodGroup, type PeriodGroupInfo } from './groups';
import { addMinutes, mvpaOf, totalOf, ZERO_MINUTES } from './intensity';
import type {
  ActivityType,
  AdherenceSummary,
  Category,
  DayFlag,
  DayTotals,
  Estimate,
  IntensityMinutes,
  ISODate,
  Period,
  PeriodEvaluation,
  PlannedSession,
  Profile,
  Session,
  Settings,
  UUID,
} from './types';

export interface CategoryBreakdown {
  category: Category;
  logged: IntensityMinutes;
  estimate: IntensityMinutes;
  /** L + M + V (kirjattu + perusarvio). */
  total: number;
  /** M + V (kirjattu + perusarvio). */
  mvpa: number;
}

export interface PeriodReport {
  period: Period;
  group: PeriodGroupInfo;
  /** Päiväkoosteet jakson kaikille päiville (myös ei-kelvollisille, näyttöä varten). */
  allDays: DayTotals[];
  /** Kelvolliset päivät (7.2). */
  validDates: ISODate[];
  /** Kelvollisten päivien koosteet; vertailu lasketaan näistä. */
  days: DayTotals[];
  evaluation: PeriodEvaluation;
  /** Miksi päiviä jäi pois vertailusta. */
  excluded: { future: number; beforeTracking: number; flagged: number };
  trackingStart: ISODate;
  /** Jakauma kategorioittain kelvollisilta päiviltä (7.10). */
  byCategory: CategoryBreakdown[];
  /** Suunnitelma vs. toteuma koko jaksolta (7.9). */
  adherence: AdherenceSummary;
  /** Liikuntatunnit kestona: arvio (suunnitelma + perusarvio) ja toteuma. */
  hours: WeeklyHours;
  /** Rasittavan päivän raja, jolla rasittavat päivät laskettiin (iän mukaan tai kiinteä). */
  vigorousDay: VigorousThreshold;
}

export interface ReportInput {
  profile: Profile;
  period: Period;
  sessions: Session[];
  estimates: Estimate[];
  flags: DayFlag[];
  planned: PlannedSession[];
  types: Map<UUID, ActivityType>;
  settings: Settings;
  today: ISODate;
}

const CATEGORY_ORDER: Category[] = ['hobby', 'school_pe', 'school_recess', 'commute', 'self_directed', 'family', 'other'];

export function periodReport(input: ReportInput): PeriodReport {
  const { profile, period, today } = input;
  const own = <T extends { profileId: UUID }>(rows: T[]) => rows.filter((r) => r.profileId === profile.id);
  const sessions = own(input.sessions);
  const estimates = own(input.estimates);
  const flags = own(input.flags);

  const dates = datesBetween(period.start, period.end);
  const allDays = dates.map((d) => dayTotals(d, sessions, estimates, input.types));
  const validDates = validDays(period, profile, flags, today);
  const valid = new Set(validDates);
  const days = allDays.filter((d) => valid.has(d.date));

  const start = trackingStart(profile);
  const flagged = new Set(flags.filter((f) => !f.deletedAt).map((f) => f.date));
  const excluded = { future: 0, beforeTracking: 0, flagged: 0 };
  for (const d of dates) {
    if (d > today) excluded.future++;
    else if (d < start) excluded.beforeTracking++;
    else if (flagged.has(d)) excluded.flagged++;
  }

  const group = periodGroup(profile, period);
  // Rasittavan päivän raja jakson viimeisen päivän iän mukaan (kuten suositusryhmä).
  const vigorousDay = vigorousDayThreshold(input.settings, profile, period.end);
  const evaluation = evaluatePeriod(group.group, days, { ...input.settings, vigorousDayMin: vigorousDay.min });

  const acc = new Map<Category, { logged: IntensityMinutes; estimate: IntensityMinutes }>();
  for (const d of days) {
    for (const [c, v] of Object.entries(d.byCategory) as [Category, NonNullable<DayTotals['byCategory'][Category]>][]) {
      const cur = acc.get(c) ?? { logged: { ...ZERO_MINUTES }, estimate: { ...ZERO_MINUTES } };
      if (v.source === 'logged') cur.logged = addMinutes(cur.logged, v.minutes);
      else cur.estimate = addMinutes(cur.estimate, v.minutes);
      acc.set(c, cur);
    }
  }
  const byCategory = CATEGORY_ORDER.filter((c) => acc.has(c)).map((c) => {
    const { logged, estimate } = acc.get(c)!;
    const both = addMinutes(logged, estimate);
    return { category: c, logged, estimate, total: totalOf(both), mvpa: mvpaOf(both) };
  });

  const inPeriod = <T extends { date: ISODate }>(rows: T[]) => rows.filter((r) => r.date >= period.start && r.date <= period.end);
  const adherence = planAdherence(inPeriod(own(input.planned)), inPeriod(sessions), today);

  const hours = weeklyHours({ period, sessions, planned: own(input.planned), estimates, flags, types: input.types, today });

  return { period, group, allDays, validDates, days, evaluation, excluded, trackingStart: start, byCategory, adherence, hours, vigorousDay };
}
