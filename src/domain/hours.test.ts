import { describe, expect, it } from 'vitest';
import { formatHours, hoursBand, HOURS_BANDS, weeklyHours } from './hours';
import { weekPeriod } from './dates';
import { activityTypeId } from './ids';
import { estimate, planned, session, typesMap } from './test-helpers';

const WEEK = weekPeriod('2026-11-11'); // ma 9.11. – su 15.11.
const TRAINING = activityTypeId('football_training');
const RECESS = activityTypeId('school_recess');
const M = { light: 0, moderate: 0, vigorous: 0 };
const recess = estimate({ category: 'school_recess', weekdayMin: 60, weekendMin: 0, validFrom: '2026-01-01' });
const commute = estimate({ category: 'commute', weekdayMin: 20, weekendMin: 0, validFrom: '2026-01-01' });

const base = { period: WEEK, sessions: [], planned: [], estimates: [], flags: [], types: typesMap(), today: '2026-11-15' };

describe('viikon liikuntatunnit', () => {
  it('arvio = suunnitellut + perusarvio; toteuma = kirjatut + perusarvio puuttuville', () => {
    const plans = ['2026-11-10', '2026-11-12', '2026-11-14'].map((date) => planned({ date, activityTypeId: TRAINING, durationMin: 90 }));
    const sessions = [
      session({ date: '2026-11-10', activityTypeId: TRAINING, durationMin: 85, minutes: M }),
      session({ date: '2026-11-12', activityTypeId: TRAINING, durationMin: 90, minutes: M }),
    ];
    const h = weeklyHours({ ...base, planned: plans, sessions, estimates: [recess, commute] });
    // Arvio: 3 × 90 = 270 + välitunnit 5 × 60 = 300 + koulumatka 5 × 20 = 100 → 670
    expect(h.expected).toEqual({ sessions: 270, estimate: 400 });
    expect(h.expectedMin).toBe(670);
    // Toteuma: 85 + 90 = 175 + perusarviot (ei kirjauksia näissä kategorioissa) 400 → 575
    expect(h.actual).toEqual({ sessions: 175, estimate: 400 });
    expect(h.actualMin).toBe(575);
    expect(h.byCategory.map((c) => c.category)).toEqual(['hobby', 'school_recess', 'commute']);
    expect(h.byCategory[0]).toMatchObject({ expected: { sessions: 270, estimate: 0 }, actual: { sessions: 175, estimate: 0 } });
    expect(formatHours(h.expectedMin)).toBe('11,2 h');
  });

  it('korvausperiaate: kirjattu välituntikerta korvaa saman päivän perusarvion toteumassa', () => {
    const s = session({ date: '2026-11-11', activityTypeId: RECESS, durationMin: 40, minutes: M });
    const h = weeklyHours({ ...base, sessions: [s], estimates: [recess] });
    const wed = h.days.find((d) => d.date === '2026-11-11')!;
    expect(wed).toMatchObject({ expectedMin: 60, actualMin: 40, actualLoggedMin: 40 });
    expect(h.actual).toEqual({ sessions: 40, estimate: 240 });
  });

  it('suunnitelma korvaa saman kategorian perusarvion arviossa', () => {
    const hobbyEst = estimate({ category: 'hobby', weekdayMin: 30, weekendMin: 30, validFrom: '2026-01-01' });
    const h = weeklyHours({ ...base, estimates: [hobbyEst], planned: [planned({ date: '2026-11-10', activityTypeId: TRAINING, durationMin: 90 })] });
    expect(h.expected).toEqual({ sessions: 90, estimate: 6 * 30 });
  });

  it('kesken oleva viikko: tulevat päivät eivät kerrytä toteumaa; arvio tähän mennessä', () => {
    const h = weeklyHours({ ...base, today: '2026-11-11', estimates: [recess] });
    expect(h.expectedMin).toBe(300);
    expect(h.expectedToDateMin).toBe(180);
    expect(h.actualMin).toBe(180);
    expect(h.days.filter((d) => d.future)).toHaveLength(4);
  });

  it('sairaspäivänä toteumaan ei lisätä perusarviota, arvio säilyy', () => {
    const flags = [{ id: 'f', profileId: 'p1', date: '2026-11-11', reason: 'sick' as const, updatedAt: 'x', updatedBy: 'd' }];
    const h = weeklyHours({ ...base, estimates: [recess], flags });
    const wed = h.days.find((d) => d.date === '2026-11-11')!;
    expect(wed).toMatchObject({ expectedMin: 60, actualMin: 0, flagged: true });
    expect(h.actualMin).toBe(240);
  });

  it('poistetut kerrat ja suunnitelmat ohitetaan', () => {
    const h = weeklyHours({
      ...base,
      planned: [planned({ date: '2026-11-10', durationMin: 90, deletedAt: 'x' })],
      sessions: [session({ date: '2026-11-10', durationMin: 60, minutes: M, deletedAt: 'x' })],
    });
    expect(h.expectedMin).toBe(0);
    expect(h.actualMin).toBe(0);
    expect(h.byCategory).toEqual([]);
  });
});

describe('arvio koko viikolle (ennuste)', () => {
  // Keskiviikko 11.11.: ma ja ti menneitä, ke tänään, to–su tulevia.
  const today = '2026-11-11';
  it('= toteutunut + avoimet suunnitelmat + loppuviikon perusarvio; ylimääräinen kirjaus mukana', () => {
    const plans = [
      planned({ date: '2026-11-10', activityTypeId: TRAINING, durationMin: 90, status: 'done' }),
      planned({ date: '2026-11-12', activityTypeId: TRAINING, durationMin: 90 }),
      planned({ date: '2026-11-14', activityTypeId: TRAINING, durationMin: 60 }),
    ];
    const sessions = [
      session({ date: '2026-11-10', activityTypeId: TRAINING, durationMin: 90, minutes: M }),
      // suunnittelematon turnaus maanantaina
      session({ date: '2026-11-09', activityTypeId: activityTypeId('football_tournament'), durationMin: 300, minutes: M }),
    ];
    const h = weeklyHours({ ...base, today, planned: plans, sessions, estimates: [recess] });
    // toteutunut: 300 + 90 + välitunnit ma–ke 3 × 60 = 570; avoimet: 90 + 60 = 150; perusarvio to–pe 2 × 60 = 120
    expect(h.forecast).toEqual({ actual: 570, openPlans: 150, estimateAhead: 120 });
    expect(h.forecastMin).toBe(840);
    expect(h.actualMin).toBe(570);
    // suunnitelma (vertailukohta): kolme suunniteltua kertaa + välitunnit 5 × 60, ei turnausta
    expect(h.expectedMin).toBe(90 + 90 + 60 + 300);
  });

  it('"Ei tehty" pudottaa kerran pois; kuittaamaton mennyt kerta on mukana, kunnes se merkitään', () => {
    const open = planned({ date: '2026-11-10', activityTypeId: TRAINING, durationMin: 90 });
    const h1 = weeklyHours({ ...base, today, planned: [open] });
    expect(h1.forecast.openPlans).toBe(90);
    const h2 = weeklyHours({ ...base, today, planned: [{ ...open, status: 'skipped' }] });
    expect(h2.forecastMin).toBe(0);
    // kirjattu saman kategorian kerta samana päivänä: kuittaamatonta ei lasketa toiseen kertaan
    const s = session({ date: '2026-11-10', activityTypeId: TRAINING, durationMin: 80, minutes: M });
    const h3 = weeklyHours({ ...base, today, planned: [open], sessions: [s] });
    expect(h3.forecastMin).toBe(80);
  });

  it('mennyt viikko: arvio = toteuma', () => {
    const s = session({ date: '2026-11-10', activityTypeId: TRAINING, durationMin: 80, minutes: M });
    const h = weeklyHours({ ...base, sessions: [s], estimates: [recess] });
    expect(h.forecastMin).toBe(h.actualMin);
  });
});

describe('viikon liikuntamäärän luokat', () => {
  it('rajat kuuluvat ylempään luokkaan; 20 h ja yli on ylin', () => {
    const at = (h: number) => hoursBand(h * 60).label;
    expect(at(0)).toBe('Alle suosituksen');
    expect(at(6.99)).toBe('Alle suosituksen');
    expect(at(7)).toBe('Suosituksen mukainen');
    expect(at(10)).toBe('Aktiivinen');
    expect(at(11.9)).toBe('Aktiivinen');
    expect(at(12)).toBe('Erittäin aktiivinen');
    expect(at(15)).toBe('Paljon liikuntaa');
    expect(at(20)).toBe('Erittäin suuri liikuntamäärä');
    expect(at(40)).toBe('Erittäin suuri liikuntamäärä');
    expect(HOURS_BANDS).toHaveLength(6);
  });
});
