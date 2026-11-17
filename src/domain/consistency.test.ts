// Laskennan johdonmukaisuus (tarkastuksen havainnot 1–5, 17.11.2026): vahvistettu arkiliikunta on kirjattua
// mutta ei kerta, kaikki liikunta lasketaan kestona ja treenin verryttely kuuluu treeniin.
import { describe, expect, it } from 'vitest';
import { dataQuality, dayTotals, isVigorousDay } from './aggregate';
import { dayGoalMet } from './dayTarget';
import { weekPeriod } from './dates';
import { typeTotals } from './football';
import { activityTypeId } from './ids';
import { longTermSummary } from './longTerm';
import { DEFAULT_SETTINGS } from './recommendations';
import { periodReport, type ReportInput } from './report';
import { estimate, profile, session, typesMap } from './test-helpers';
import { weekReport } from './weekReport';

const types = typesMap();
const MON = '2026-11-02';
const training = () =>
  session({ id: 'tr', date: MON, startTime: '17:30', activityTypeId: activityTypeId('football_training'), durationMin: 90, minutes: { light: 30, moderate: 40, vigorous: 10 } });
const warmup = () =>
  session({ id: 'w:tr', linkedTo: 'tr', date: MON, activityTypeId: activityTypeId('football_self'), durationMin: 15, minutes: { light: 8, moderate: 5, vigorous: 1 } });
const confirmation = (date = MON) =>
  session({ date, activityTypeId: activityTypeId('school_recess'), durationMin: 60, minutes: { light: 30, moderate: 15, vigorous: 3 }, estimateConfirmed: true, label: 'Välitunnit' });

function report(sessions = [training(), warmup(), confirmation()]) {
  const input: ReportInput = {
    profile: profile({ createdAt: '2026-09-01T10:00:00.000Z', birthYear: 2016, birthMonth: 5 }),
    period: weekPeriod(MON),
    sessions,
    estimates: [estimate({ category: 'school_recess', weekdayMin: 60, shares: { light: 0.5, moderate: 0.25, vigorous: 0.05 } })],
    flags: [],
    planned: [],
    types,
    settings: { ...DEFAULT_SETTINGS },
    today: '2026-11-08',
  };
  return { input, r: periodReport(input) };
}

describe('kerrat: ei vahvistuksia eikä verryttelyä', () => {
  it('päivän kertamäärä on 1 (treeni), vahvistus erikseen; kattavuus laskee vahvistuspäivän', () => {
    const d = dayTotals(MON, [training(), warmup(), confirmation()], [], types);
    expect(d.sessionCount).toBe(1);
    expect(d.confirmations).toBe(1);
    // Vahvistettu arkiliikunta on kirjattua: mukana kirjatuissa minuuteissa.
    expect(d.mvpa).toBe(50 + 6 + 18);
    const onlyConfirmed = dayTotals('2026-11-03', [confirmation('2026-11-03')], [], types);
    expect(onlyConfirmed.sessionCount).toBe(0);
    expect(dataQuality([onlyConfirmed]).coverage).toBe(1);
  });

  it('typeTotals: verryttelyn minuutit treenin lajiin, kerta lasketaan kerran', () => {
    const t = typeTotals([training(), warmup()]);
    expect([...t.keys()]).toEqual([activityTypeId('football_training')]);
    expect(t.get(activityTypeId('football_training'))).toEqual({ count: 1, minutes: 105 });
    // Ilman treeniä verryttely on oma rivinsä.
    expect(typeTotals([warmup()]).get(activityTypeId('football_self'))).toEqual({ count: 1, minutes: 15 });
  });

  it('viikkoraportti: verryttely treenin rivillä; rivit summautuvat edelleen päivään', () => {
    const sessions = [training(), warmup(), confirmation()];
    const { r } = report(sessions);
    const w = weekReport({ totals: r.allDays, hours: r.hours.days, sessions, types, flags: [], group: r.group.group });
    const mon = w.days[0];
    expect(mon.entries).toHaveLength(1);
    expect(mon.entries[0]).toMatchObject({ durationMin: 105, mvpa: 56, detail: 'verryttely 15 min' });
    expect(mon.arki).toMatchObject({ durationMin: 60, confirmed: true });
    expect(mon.entries[0].durationMin + mon.arki!.durationMin).toBe(mon.durationMin);
    expect(w.summary.sessionCount).toBe(1);
    expect(w.summary.byType).toEqual([expect.objectContaining({ typeId: activityTypeId('football_training'), count: 1, durationMin: 105 })]);
  });
});

describe('kaikki liikunta kestona', () => {
  it('pitkä aikaväli ja kategoriajakauma käyttävät kestoa kuten tunnit', () => {
    const { input, r } = report();
    const days = r.days.length;
    const s = longTermSummary(r, input.sessions, types, input.settings);
    expect(s.total!.combined * days).toBeCloseTo(r.days.reduce((a, d) => a + d.movingCombined, 0), 6);
    expect(s.byType.find((t) => t.typeId === activityTypeId('football_training'))).toMatchObject({ count: 1, minutes: 105 });
    expect(s.byType.some((t) => t.typeId === activityTypeId('football_self'))).toBe(false);
    // Kategorioiden kestot summautuvat viikon toteutuneisiin tunteihin.
    expect(r.byCategory.reduce((a, c) => a + c.total, 0)).toBe(r.hours.actualMin);
    expect(r.byCategory.find((c) => c.category === 'hobby')!.total).toBe(105);
  });
});

describe('havainnot 7–10', () => {
  it('aikuisen päivätavoite painotettuna kuten viikon 150 min (reipas + 2 × rasittava)', () => {
    const d = dayTotals(MON, [session({ date: MON, minutes: { light: 0, moderate: 10, vigorous: 6 } })], [], types);
    expect(d.mvpaCombined).toBe(16); // alle 150/7 ≈ 21,4 painottamattomana
    expect(dayGoalMet('adult', d)).toBe(true); // 10 + 2 × 6 = 22
    expect(dayGoalMet('school_age', d)).toBe(false);
  });

  it('tunnit: ennen seurannan alkua ei arkiliikunnan arviota', () => {
    const { input } = report([]);
    const r = periodReport({ ...input, profile: { ...input.profile, trackingStart: '2026-11-04' } });
    expect(r.hours.days.map((d) => d.actualMin)).toEqual([0, 0, 60, 60, 60, 0, 0]);
    expect(r.hours.days[0].expectedMin).toBe(0);
  });

  it('viikkoraportti: sairaspäivän lihaskuntokerta ei ole lihaspäivä, kuten arviossa', () => {
    const sick = { id: 'f', profileId: 'p1', date: MON, reason: 'sick' as const, updatedAt: 'x', updatedBy: 'd' };
    const sessions = [session({ date: MON, muscle: true, minutes: { light: 10, moderate: 10, vigorous: 0 } })];
    const { input } = report(sessions);
    const r = periodReport({ ...input, flags: [sick] });
    const w = weekReport({ totals: r.allDays, hours: r.hours.days, sessions, types, flags: [sick], group: r.group.group });
    expect(w.summary.muscleDays).toBe(0);
    expect(r.evaluation.schoolAge!.muscleDays.actual).toBe(0);
  });

  it('vahvistettu arkiliikunta ei tuota rasittavaa päivää', () => {
    const conf = session({ date: MON, activityTypeId: activityTypeId('outdoor_play'), durationMin: 120, minutes: { light: 40, moderate: 40, vigorous: 30 }, estimateConfirmed: true });
    const d = dayTotals(MON, [conf], [], types);
    expect(d.logged.vigorous).toBe(30);
    expect(d.sessionVigorous).toBe(0);
    expect(isVigorousDay(d, 15)).toBe(false);
    expect(isVigorousDay(dayTotals(MON, [training()], [], types), 10)).toBe(true);
  });
});
