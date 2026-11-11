// Testiapurit (käytetään vain testeissä).

import { addDays, datesBetween } from './dates';
import { dayTotals } from './aggregate';
import { activityTypeId } from './ids';
import { BUILT_IN_ACTIVITY_TYPES } from '../seed/activityTypes';
import type {
  ActivityType,
  DayTotals,
  Estimate,
  IntensityMinutes,
  ISODate,
  PlannedSession,
  Profile,
  Session,
  UUID,
} from './types';

export const TS = '2026-01-01T12:00:00.000Z';
export const DEV = 'test-device';

export const typesMap = (): Map<UUID, ActivityType> => new Map(BUILT_IN_ACTIVITY_TYPES.map((t) => [t.id, t]));

export const builtIn = (key: string): ActivityType => {
  const t = BUILT_IN_ACTIVITY_TYPES.find((x) => x.id === activityTypeId(key));
  if (!t) throw new Error(key);
  return t;
};

export function profile(over: Partial<Profile> = {}): Profile {
  return {
    id: 'p1',
    name: 'Testi',
    kind: 'child',
    birthYear: 2016,
    birthMonth: 5,
    color: '#16a34a',
    sortOrder: 0,
    archived: false,
    createdAt: TS,
    updatedAt: TS,
    updatedBy: DEV,
    ...over,
  };
}

let seq = 0;
export function session(over: Partial<Session> & { date: ISODate; minutes: IntensityMinutes }): Session {
  seq++;
  return {
    id: `s${seq}`,
    profileId: 'p1',
    activityTypeId: activityTypeId('other'),
    durationMin: over.minutes.light + over.minutes.moderate + over.minutes.vigorous,
    effort: 0,
    intensitySource: 'manual',
    muscle: false,
    bone: false,
    createdAt: TS,
    updatedAt: TS,
    updatedBy: DEV,
    ...over,
  };
}

export function estimate(over: Partial<Estimate>): Estimate {
  seq++;
  return {
    id: `e${seq}`,
    profileId: 'p1',
    category: 'school_recess',
    label: 'Välitunnit',
    weekdayMin: 0,
    weekendMin: 0,
    shares: { light: 0, moderate: 0, vigorous: 0 },
    validFrom: '2026-01-01',
    createdAt: TS,
    updatedAt: TS,
    updatedBy: DEV,
    ...over,
  };
}

export function planned(over: Partial<PlannedSession> & { date: ISODate }): PlannedSession {
  seq++;
  return {
    id: `pl${seq}`,
    profileId: 'p1',
    activityTypeId: activityTypeId('football_training'),
    durationMin: 90,
    status: 'open',
    createdAt: TS,
    updatedAt: TS,
    updatedBy: DEV,
    ...over,
  };
}

/** ISO-viikko 2026-W46: ma 9.11. – su 15.11.2026. */
export const WEEK_MON = '2026-11-09';
export const weekDates = (mon: ISODate = WEEK_MON) => datesBetween(mon, addDays(mon, 6));

/** Päiväkoosteet viikolle, yksi kirjattu kerta per päivä annetuilla minuuteilla. */
export function weekOfTotals(perDay: IntensityMinutes[], extra: Partial<Session>[] = []): DayTotals[] {
  const dates = weekDates();
  const sessions = perDay.map((m, i) => session({ date: dates[i], minutes: m, ...(extra[i] ?? {}) }));
  return dates.map((d) => dayTotals(d, sessions, [], typesMap()));
}

/** Minuutit niin, että MVPA = x (kaikki reipasta). */
export const mvpaMin = (x: number): IntensityMinutes => ({ light: 0, moderate: x, vigorous: 0 });
