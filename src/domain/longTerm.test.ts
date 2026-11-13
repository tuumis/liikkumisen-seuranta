// Vaihe 7: pitkän aikavälin koosteet (kuukausi, kausi, vuosi).
import { describe, expect, it } from 'vitest';
import { longTermSummary, nextPeriod, periodName, periodOf, previousPeriod } from './longTerm';
import { periodReport, type ReportInput } from './report';
import { activityTypeId } from './ids';
import { DEFAULT_SETTINGS } from './recommendations';
import { profile, session, typesMap } from './test-helpers';

const types = typesMap();
const input = (over: Partial<ReportInput>): ReportInput => ({
  profile: profile({ createdAt: '2026-09-01T10:00:00.000Z', birthYear: 2016, birthMonth: 5 }),
  period: periodOf('season', '2026-10-15'),
  sessions: [],
  estimates: [],
  flags: [],
  planned: [],
  types,
  settings: { ...DEFAULT_SETTINGS },
  today: '2026-11-30',
  ...over,
});

describe('jaksot', () => {
  it('nimet ja edellinen / seuraava jakso', () => {
    expect(periodName(periodOf('month', '2026-11-13'))).toBe('marraskuu 2026');
    expect(periodName(periodOf('season', '2026-11-13'))).toBe('Syksy 2026');
    expect(periodName(previousPeriod(periodOf('season', '2026-11-13')))).toBe('Kesä 2026');
    expect(periodName(previousPeriod(periodOf('season', '2026-03-01')))).toBe('Syksy 2025');
    expect(previousPeriod(periodOf('year', '2026-05-05'))).toMatchObject({ start: '2025-01-01', end: '2025-12-31' });
    expect(nextPeriod(periodOf('month', '2026-12-05'))).toMatchObject({ start: '2027-01-01', end: '2027-01-31' });
  });
});

describe('pitkän aikavälin kooste', () => {
  const training = (date: string, vig = 20) =>
    session({ date, activityTypeId: activityTypeId('football_training'), durationMin: 90, minutes: { light: 30, moderate: 40, vigorous: vig } });
  const bike = (date: string) => session({ date, activityTypeId: activityTypeId('kick_scooter'), durationMin: 30, minutes: { light: 10, moderate: 20, vigorous: 0 } });

  it('kuukausittaiset palkit, ohjatun osuus, monipuolisuus ja lajit', () => {
    const sessions = [training('2026-09-08'), training('2026-09-10'), training('2026-10-06'), bike('2026-10-07'), bike('2026-11-02')];
    const report = periodReport(input({ sessions }));
    const s = longTermSummary(report, sessions, types, DEFAULT_SETTINGS);
    expect(s.buckets.map((b) => b.label)).toEqual(['syys', 'loka', 'marras', 'joulu']);
    expect(s.buckets[3].validDays).toBe(0); // tulevat päivät eivät ole vertailussa
    expect(s.buckets[0].validDays).toBe(30);
    expect(s.buckets[0].mvpaLogged).toBeCloseTo((60 * 2) / 30);
    expect(s.validDays).toBe(91);
    // Ohjattu: 3 treeniä × 60 MVPA = 180; omaehtoinen pyöräily 2 × 20 = 40 (kategoria tyypin mukaan).
    expect(s.context!.organized).toBeCloseTo(180 / 220);
    expect(s.vigorousShare).toBeCloseTo(60 / 220);
    expect(s.byType[0]).toMatchObject({ count: 3, minutes: 270 });
    expect(s.variety.types).toBe(2);
    expect(s.variety.groups.length).toBe(2);
  });

  it('viikkotavoitteet: vain viikot, joilla ≥ 4 vertailtavaa päivää', () => {
    // Elokuun lopun viikko jää seurannan alun takia vajaaksi; jakso syys–joulu, tänään 30.11.
    const sessions = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'].map((d) =>
      session({ date: d, activityTypeId: activityTypeId('football_training'), durationMin: 90, minutes: { light: 10, moderate: 50, vigorous: 30 }, muscle: true, bone: true }),
    );
    const report = periodReport(input({ sessions }));
    const s = longTermSummary(report, sessions, types, DEFAULT_SETTINGS);
    expect(s.weeks.evaluated).toBe(13); // 1.9.(ti)–30.11.: vk 36 (6 pv) … vk 49 ma 30.11. (1 pv) ei
    const byKey = Object.fromEntries(s.weeks.goals.map((g) => [g.key, g.met]));
    expect(byKey).toMatchObject({ mvpa: 1, vigorous: 1, muscle: 1, bone: 1 });
  });

  it('kuukauden palkit viikoittain', () => {
    const report = periodReport(input({ period: periodOf('month', '2026-11-01') }));
    const s = longTermSummary(report, [], types, DEFAULT_SETTINGS);
    expect(s.buckets[0].label).toBe('vk 44');
    expect(s.buckets.at(-1)!.label).toBe('vk 49');
    expect(s.context).toBeNull();
    expect(s.mvpa).toEqual({ logged: 0, combined: 0 });
  });
});
