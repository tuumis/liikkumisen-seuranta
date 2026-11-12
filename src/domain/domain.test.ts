// Domain-funktioiden lisätestit (päivämäärät, ryhmät, kelvolliset päivät, laatu, tunnisteet).

import { describe, expect, it } from 'vitest';
import {
  addDays,
  datesBetween,
  endOfIsoWeek,
  isISODate,
  isoWeek,
  isoWeekday,
  monthPeriod,
  seasonPeriod,
  startOfIsoWeek,
  weekPeriod,
  yearPeriod,
} from './dates';
import { ageInYears, contextOf, periodGroup } from './groups';
import { dataQuality, dayTotals, measure, statusOf, validDays } from './aggregate';
import { activityTypeId, dayFlagId, newId, plannedSessionId, sessionIdFromPlanned } from './ids';
import { CURRENT_SCHEMA_VERSION, migrateToCurrent } from './migrations';
import { isValidShares } from './intensity';
import { RECOMMENDATIONS } from './recommendations';
import { BUILT_IN_ACTIVITY_TYPES } from '../seed/activityTypes';
import { estimate, mvpaMin, profile, session, typesMap, weekDates } from './test-helpers';

describe('päivämäärät', () => {
  it('ISO-viikonpäivä ja viikon rajat', () => {
    expect(isoWeekday('2026-11-09')).toBe(1);
    expect(isoWeekday('2026-11-15')).toBe(7);
    expect(startOfIsoWeek('2026-11-15')).toBe('2026-11-09');
    expect(endOfIsoWeek('2026-11-09')).toBe('2026-11-15');
    expect(weekPeriod('2026-11-11')).toEqual({ kind: 'week', start: '2026-11-09', end: '2026-11-15' });
  });

  it('kesäaika ei siirrä päiviä', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(datesBetween('2026-03-28', '2026-03-31')).toEqual(['2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31']);
  });

  it('vuoden ja kuukauden vaihde, karkausvuosi', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(monthPeriod('2028-02-10').end).toBe('2028-02-29');
    expect(datesBetween('2026-01-02', '2026-01-01')).toEqual([]);
  });

  it('ISO-viikkonumero', () => {
    expect(isoWeek('2026-11-11')).toEqual({ year: 2026, week: 46 });
    expect(isoWeek('2027-01-01')).toEqual({ year: 2026, week: 53 });
    expect(isoWeek('2026-01-01')).toEqual({ year: 2026, week: 1 });
  });

  it('kaudet ja vuosi', () => {
    expect(seasonPeriod('2026-02-01')).toMatchObject({ start: '2026-01-01', end: '2026-05-31' });
    expect(seasonPeriod('2026-07-01')).toMatchObject({ start: '2026-06-01', end: '2026-08-31' });
    expect(seasonPeriod('2026-11-11')).toMatchObject({ start: '2026-09-01', end: '2026-12-31' });
    expect(yearPeriod('2026-11-11')).toMatchObject({ start: '2026-01-01', end: '2026-12-31' });
  });

  it('isISODate', () => {
    expect(isISODate('2026-02-28')).toBe(true);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('2026-2-3')).toBe(false);
  });
});

describe('ryhmät ja konteksti', () => {
  it('ikä: syntymäpäivä kuun 15. päivä', () => {
    expect(ageInYears(2019, 3, '2026-03-14')).toBe(6);
    expect(ageInYears(2019, 3, '2026-03-15')).toBe(7);
  });

  it('ryhmä vaihtuu kesken jakson → jakson viimeisen päivän ryhmä ja vaihtopäivä', () => {
    const p = profile({ birthYear: 2019, birthMonth: 3, schoolStart: { year: 2026, month: 8 } });
    const info = periodGroup(p, { kind: 'week', start: '2026-07-27', end: '2026-08-02' });
    expect(info.group).toBe('school_age');
    expect(info.changedOn).toBe('2026-08-01');
    expect(periodGroup(p, weekPeriod('2026-11-11')).changedOn).toBeUndefined();
  });

  it('yli 64-vuotias → adult ja huomautus', () => {
    const p = profile({ kind: 'adult', birthYear: 1960, birthMonth: 1 });
    expect(periodGroup(p, weekPeriod('2026-11-11'))).toMatchObject({ group: 'adult', over64: true });
    expect(periodGroup(profile({ birthYear: 1990, birthMonth: 1 }), weekPeriod('2026-11-11')).over64).toBe(false);
  });

  it('konteksti kategoriasta', () => {
    expect(contextOf('hobby')).toBe('organized');
    expect(contextOf('school_pe')).toBe('organized');
    expect(contextOf('school_recess')).toBe('self_directed');
    expect(contextOf('family')).toBe('self_directed');
    expect(contextOf('commute')).toBe('everyday');
    expect(contextOf('other')).toBe('everyday');
  });
});

describe('kelvolliset päivät', () => {
  it('tulevat päivät ja seurantaa edeltävät päivät eivät ole kelvollisia', () => {
    const p = profile({ createdAt: '2026-11-10T12:00:00.000Z' });
    expect(validDays(weekPeriod('2026-11-11'), p, [], '2026-11-12')).toEqual(['2026-11-10', '2026-11-11', '2026-11-12']);
  });

  it('muun profiilin ja poistetut merkinnät ohitetaan', () => {
    const p = profile();
    const flags = [
      { id: 'a', profileId: 'p2', date: '2026-11-10', reason: 'sick' as const, updatedAt: 'x', updatedBy: 'd' },
      { id: 'b', profileId: 'p1', date: '2026-11-11', reason: 'travel' as const, updatedAt: 'x', updatedBy: 'd', deletedAt: 'y' },
    ];
    expect(validDays(weekPeriod('2026-11-11'), p, flags, '2026-12-01')).toHaveLength(7);
  });
});

describe('päiväkooste', () => {
  it('poistetut ja muiden päivien kerrat ohitetaan', () => {
    const [mon, tue] = weekDates();
    const sessions = [
      session({ date: mon, minutes: mvpaMin(30) }),
      session({ date: mon, minutes: mvpaMin(99), deletedAt: '2026-11-10T00:00:00Z' }),
      session({ date: tue, minutes: mvpaMin(50) }),
    ];
    const d = dayTotals(mon, sessions, [], typesMap());
    expect(d.mvpa).toBe(30);
    expect(d.sessionCount).toBe(1);
  });

  it('poistettu arvio ei ole voimassa', () => {
    const e = estimate({ weekdayMin: 60, shares: { light: 1, moderate: 0, vigorous: 0 }, deletedAt: 'x' });
    expect(dayTotals('2026-11-11', [], [e], typesMap()).estimateAvailable).toBe(false);
  });
});

describe('tila ja laatu', () => {
  it('rajat 100 % ja 75 %', () => {
    expect(statusOf(60, 60)).toBe('met');
    expect(statusOf(45, 60)).toBe('near');
    expect(statusOf(44.9, 60)).toBe('below');
    expect(measure(52, 60)).toMatchObject({ status: 'near', shortfall: 8 });
  });

  it('vähäinen data ilman arvioita himmennetään', () => {
    const [mon] = weekDates();
    const days = weekDates().map((d) => dayTotals(d, [session({ date: mon, minutes: mvpaMin(30) })], [], typesMap()));
    const q = dataQuality(days);
    expect(q.coverage).toBeCloseTo(1 / 7, 10);
    expect(q.lowData).toBe(true);
    const e = estimate({ weekdayMin: 10, shares: { light: 1, moderate: 0, vigorous: 0 } });
    const withEst = weekDates().map((d) => dayTotals(d, [], [e], typesMap()));
    expect(dataQuality(withEst).lowData).toBe(false);
  });
});

describe('tunnisteet ja siemendata', () => {
  it('johdetut tunnisteet', () => {
    expect(activityTypeId('football_training')).toBe('t:football_training');
    expect(plannedSessionId('tpl1', '2026-11-10')).toBe('p:tpl1:2026-11-10');
    expect(sessionIdFromPlanned('p:tpl1:2026-11-10')).toBe('s:p:tpl1:2026-11-10');
    expect(dayFlagId('p1', '2026-11-10')).toBe('f:p1:2026-11-10');
    expect(newId()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('18 sisäänrakennettua lajia, pysyvät avaimet, kelvolliset profiilit', () => {
    expect(BUILT_IN_ACTIVITY_TYPES).toHaveLength(18);
    const ids = BUILT_IN_ACTIVITY_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of BUILT_IN_ACTIVITY_TYPES) {
      expect(t.id).toBe(`t:${t.key}`);
      expect(isValidShares(t.shares)).toBe(true);
    }
    const football = BUILT_IN_ACTIVITY_TYPES.filter((t) => t.sport === 'football');
    expect(football.map((t) => [t.footballKind, t.usesPlayedMinutes])).toEqual([
      ['training', false],
      ['game', true],
      ['tournament', true],
      ['training', false], // omatoiminen
    ]);
    const self = BUILT_IN_ACTIVITY_TYPES.find((t) => t.key === 'football_self')!;
    expect(self).toMatchObject({ id: 't:football_self', category: 'self_directed', sortOrder: 2.5, shares: { light: 0.5, moderate: 0.35, vigorous: 0.05 } });
  });

  it('suositukset ovat jäädytettyjä', () => {
    expect(Object.isFrozen(RECOMMENDATIONS.school_age.mvpaAvgMinPerDay)).toBe(true);
    expect(RECOMMENDATIONS.school_age.mvpaAvgMinPerDay.source.checked).toBe('2026-11-11');
  });

  it('migraatioketju v1 → nykyinen; uudempi hylätään', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(2);
    const data = { profiles: [] };
    expect(migrateToCurrent(data, 2)).toBe(data);
    expect(migrateToCurrent(data, 1)).toEqual({ profiles: [], teams: [], fixtures: [] });
    expect(() => migrateToCurrent(data, 3)).toThrow('Päivitä sovellus tällä laitteella ensin');
  });
});
