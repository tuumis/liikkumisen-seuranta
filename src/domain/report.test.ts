// Vaihe 4: jakson raportti, korvausperiaate viikolla, kelvolliset päivät ja jakaumat.

import { describe, expect, it } from 'vitest';
import { periodReport, type ReportInput } from './report';
import { weekPeriod } from './dates';
import { activityTypeId } from './ids';
import { DEFAULT_SETTINGS } from './recommendations';
import { estimate, planned, profile, session, typesMap } from './test-helpers';
import { aboutMinutes, num1, percent, statusSentence } from '../ui/statusText';
import { measure } from './aggregate';

const WEEK = weekPeriod('2026-11-11'); // ma 9.11. – su 15.11.
const recess = estimate({
  category: 'school_recess',
  weekdayMin: 60,
  weekendMin: 0,
  shares: { light: 0.5, moderate: 0.25, vigorous: 0.05 },
  validFrom: '2026-01-01',
});

const input = (over: Partial<ReportInput> = {}): ReportInput => ({
  profile: profile({ createdAt: '2026-11-01T10:00:00.000Z', birthYear: 2016, birthMonth: 5 }),
  period: WEEK,
  sessions: [],
  estimates: [],
  flags: [],
  planned: [],
  types: typesMap(),
  settings: { ...DEFAULT_SETTINGS },
  today: '2026-11-15',
  ...over,
});

describe('jakson raportti', () => {
  it('korvausperiaate viikolla: arkipäivät saavat välituntiarvion, kirjattu päivä ei', () => {
    const thuRecess = session({
      date: '2026-11-12',
      activityTypeId: activityTypeId('school_recess'),
      minutes: { light: 20, moderate: 10, vigorous: 2 },
      intensitySource: 'profile',
    });
    const r = periodReport(input({ sessions: [thuRecess], estimates: [recess] }));
    expect(r.evaluation.n).toBe(7);
    expect(r.days.map((d) => d.estimate.moderate)).toEqual([15, 15, 15, 0, 15, 0, 0]);
    expect(r.days[3].logged.moderate).toBe(10);
    // MVPA*: 4 × 18 + 12 = 84 / 7 = 12; kirjattu 12 / 7
    expect(r.evaluation.schoolAge!.mvpaAvg.combined.actual).toBeCloseTo(84 / 7, 10);
    expect(r.evaluation.schoolAge!.mvpaAvg.logged.actual).toBeCloseTo(12 / 7, 10);
    expect(r.evaluation.quality.estimateShare).toBeCloseTo(72 / 84, 10);
    expect(r.evaluation.quality.coverage).toBeCloseTo(1 / 7, 10);
    expect(r.evaluation.quality.lowData).toBe(false); // perusarvioita on
  });

  it('kelvolliset päivät: tulevat, ennen seurannan alkua ja merkityt jäävät pois', () => {
    const r = periodReport(
      input({
        profile: profile({ createdAt: '2026-11-10T10:00:00.000Z' }),
        today: '2026-11-13',
        flags: [{ id: 'f', profileId: 'p1', date: '2026-11-11', reason: 'sick', updatedAt: 'x', updatedBy: 'd' }],
      }),
    );
    expect(r.validDates).toEqual(['2026-11-10', '2026-11-12', '2026-11-13']);
    expect(r.excluded).toEqual({ future: 2, beforeTracking: 1, flagged: 1 });
    expect(r.trackingStart).toBe('2026-11-10');
    expect(r.allDays).toHaveLength(7);
  });

  it('N = 0 → ei vertailua', () => {
    const r = periodReport(input({ today: '2026-11-01' }));
    expect(r.evaluation.evaluable).toBe(false);
  });

  it('muiden profiilien tiedot eivät sekoitu', () => {
    const other = session({ profileId: 'p2', date: '2026-11-10', minutes: { light: 0, moderate: 99, vigorous: 0 } });
    const r = periodReport(input({ sessions: [other], estimates: [{ ...recess, profileId: 'p2' }] }));
    expect(r.days.every((d) => d.mvpaCombined === 0)).toBe(true);
  });

  it('jakauma kategorioittain erottaa kirjatun ja perusarvion', () => {
    const t = session({
      date: '2026-11-10',
      activityTypeId: activityTypeId('football_training'),
      minutes: { light: 26, moderate: 23, vigorous: 11 },
    });
    const r = periodReport(input({ sessions: [t], estimates: [recess] }));
    const hobby = r.byCategory.find((c) => c.category === 'hobby')!;
    const rec = r.byCategory.find((c) => c.category === 'school_recess')!;
    expect(hobby).toMatchObject({ total: 60, mvpa: 34, estimate: { light: 0, moderate: 0, vigorous: 0 } });
    expect(rec.estimate).toEqual({ light: 150, moderate: 75, vigorous: 15 });
    expect(rec.mvpa).toBe(90);
    expect(r.byCategory.map((c) => c.category)).toEqual(['hobby', 'school_recess']);
  });

  it('suunnitelma vs. toteuma jakson suunnitelmista; ryhmä jakson viimeisestä päivästä', () => {
    const plans = [planned({ date: '2026-11-10' }), planned({ date: '2026-11-12', status: 'skipped', skipReason: 'sick' }), planned({ date: '2026-11-20' })];
    const r = periodReport(input({ planned: plans }));
    expect(r.adherence).toMatchObject({ planned: 2, skipped: 1, unconfirmed: 1 });
    expect(r.group.group).toBe('school_age');
  });
});

describe('tilan sanoitus (7.7)', () => {
  it('met / near / below', () => {
    expect(statusSentence(measure(60, 60), '')).toBe('Suositus täyttyi');
    const near = measure(52, 60);
    expect(statusSentence(near, aboutMinutes(near, 'min/pv'))).toBe('Lähellä suositusta – puuttui noin 8 min/pv');
    expect(statusSentence(measure(30, 60), '')).toBe('Tällä viikolla vähemmän kuin suositus');
    expect(statusSentence(measure(30, 60), '', 'month')).toBe('Tässä kuussa vähemmän kuin suositus');
  });

  it('luvut', () => {
    expect(percent(0.234)).toBe('23 %');
    expect(num1(380 / 6)).toBe('63,3');
    expect(num1(60)).toBe('60');
    expect(aboutMinutes(measure(52.4, 60), 'min/pv')).toBe('noin 8 min/pv');
  });
});

describe('rasittavan päivän raja iän mukaan (oma tavoite)', () => {
  it('taulukko, rajat ja kiinteä sääntö', async () => {
    const { vigorousDayThreshold } = await import('./vigorous');
    const s = { ...DEFAULT_SETTINGS };
    const p = (birthYear: number) => ({ birthYear, birthMonth: 1 });
    expect(vigorousDayThreshold(s, p(2017), '2026-11-15')).toEqual({ min: 20, rule: 'age', age: 9 });
    expect(vigorousDayThreshold(s, p(2010), '2026-11-15')).toMatchObject({ min: 35, age: 16 });
    expect(vigorousDayThreshold(s, p(2021), '2026-11-15')).toMatchObject({ min: 15, age: 5 }); // alle 7 → 7 v rivi
    expect(vigorousDayThreshold(s, p(2000), '2026-11-15')).toMatchObject({ min: 35, age: 26 }); // yli 17 → 17 v rivi
    expect(vigorousDayThreshold({ ...s, vigorousDayRule: 'fixed', vigorousDayMin: 12 }, p(2017), '2026-11-15')).toEqual({ min: 12, rule: 'fixed' });
    // Syntymäpäivä oletetaan kuun 15. päiväksi: 2017/11 täyttää 9 v vasta 15.11.
    expect(vigorousDayThreshold(s, { birthYear: 2017, birthMonth: 11 }, '2026-11-14')).toMatchObject({ min: 18, age: 8 });
  });

  it('jakson arviointi käyttää iän mukaista rajaa (9 v → 20 min)', () => {
    const minutes = (v: number) => ({ light: 0, moderate: 30, vigorous: v });
    const days = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'];
    const vig = [15, 20, 25, 19];
    const sessions = days.map((date, i) => session({ date, minutes: minutes(vig[i]) }));
    const r = periodReport(input({ profile: profile({ createdAt: '2026-11-01T10:00:00.000Z', birthYear: 2017, birthMonth: 1 }), sessions }));
    expect(r.vigorousDay).toEqual({ min: 20, rule: 'age', age: 9 });
    expect(r.evaluation.schoolAge!.vigorousDays.actual).toBe(2);
    const fixed = periodReport(input({ profile: profile({ createdAt: '2026-11-01T10:00:00.000Z', birthYear: 2017, birthMonth: 1 }), sessions, settings: { ...DEFAULT_SETTINGS, vigorousDayRule: 'fixed' } }));
    expect(fixed.evaluation.schoolAge!.vigorousDays.actual).toBe(4); // raja 10 min
  });
});
