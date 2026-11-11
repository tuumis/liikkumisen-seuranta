// SPEC 14, hyväksymiskriteerit A1–A16 (laskenta).

import { describe, expect, it } from 'vitest';
import { computeSessionMinutes } from './intensity';
import { dayTotals, evaluatePeriod, estimateShare, validDays } from './aggregate';
import { recommendationGroup } from './groups';
import { planAdherence } from './adherence';
import { DEFAULT_SETTINGS } from './recommendations';
import { weekPeriod } from './dates';
import {
  builtIn,
  estimate,
  mvpaMin,
  planned,
  profile,
  session,
  typesMap,
  WEEK_MON,
  weekDates,
  weekOfTotals,
} from './test-helpers';
import type { ActivityType, DayFlag, Settings } from './types';

const settings: Settings = { ...DEFAULT_SETTINGS };
const training = builtIn('football_training'); // 0,35 / 0,30 / 0,15
const game = builtIn('football_game'); // 0,20 / 0,45 / 0,30
const trampoline = builtIn('trampoline'); // 0,30 / 0,30 / 0,30

describe('A1–A5 kerran minuutit (tehomalli)', () => {
  it('lähtöprofiilit vastaavat SPECin taulukkoa', () => {
    expect(training.shares).toEqual({ light: 0.35, moderate: 0.3, vigorous: 0.15 });
    expect(game.shares).toEqual({ light: 0.2, moderate: 0.45, vigorous: 0.3 });
    expect(trampoline.shares).toEqual({ light: 0.3, moderate: 0.3, vigorous: 0.3 });
  });

  it('A1 treeni 75 min, tavallinen → 26 / 23 / 11', () => {
    const r = computeSessionMinutes(training, { durationMin: 75, effort: 0 });
    expect(r.minutes).toEqual({ light: 26, moderate: 23, vigorous: 11 });
    expect(r.minutes.moderate + r.minutes.vigorous).toBe(34); // SPEC 5 esimerkki: MVPA 34
    expect(r.snapshot).toEqual(training.shares);
  });

  it('A2 treeni 75 min, kovempi (e = 1,25) → 26 / 28 / 14', () => {
    const r = computeSessionMinutes(training, { durationMin: 75, effort: 1 });
    expect(r.minutes).toEqual({ light: 26, moderate: 28, vigorous: 14 });
  });

  it('A3 peli 90 min, pelattu 40 min → 8 / 18 / 12', () => {
    const r = computeSessionMinutes(game, { durationMin: 90, playedMin: 40, effort: 0 });
    expect(r.minutes).toEqual({ light: 8, moderate: 18, vigorous: 12 });
  });

  it('A3b peli ilman pelattuja minuutteja käyttää kestoa', () => {
    const r = computeSessionMinutes(game, { durationMin: 40, effort: 0 });
    expect(r.minutes).toEqual({ light: 8, moderate: 18, vigorous: 12 });
  });

  it('A3c treenissä playedMin ei vaikuta (usesPlayedMinutes = false)', () => {
    const r = computeSessionMinutes(training, { durationMin: 75, playedMin: 10, effort: 0 });
    expect(r.minutes).toEqual({ light: 26, moderate: 23, vigorous: 11 });
  });

  it('A4 trampoliini 40 min, kovempi → 10 / 15 / 15 (kevyt rajautuu 0,25:een)', () => {
    const r = computeSessionMinutes(trampoline, { durationMin: 40, effort: 1 });
    expect(r.minutes).toEqual({ light: 10, moderate: 15, vigorous: 15 });
  });

  it('A4b m′ + v′ > 1 skaalataan summaan 1, kevyt 0', () => {
    const run = builtIn('running'); // 0 / 0,40 / 0,60, kovempi → 0,5 + 0,75 = 1,25
    const r = computeSessionMinutes(run, { durationMin: 50, effort: 1 });
    expect(r.minutes).toEqual({ light: 0, moderate: 20, vigorous: 30 });
  });

  it('A4c kevyempi ponnistelu (e = 0,75)', () => {
    const r = computeSessionMinutes(training, { durationMin: 60, effort: -1 });
    // m' = 0,225 → 13,5 → 14; v' = 0,1125 → 6,75 → 7; l' = 0,35 → 21
    expect(r.minutes).toEqual({ light: 21, moderate: 14, vigorous: 7 });
  });

  it('A5 käsin syötetyt minuutit sellaisinaan, ei snapshotia', () => {
    const manual = { light: 7, moderate: 13, vigorous: 2 };
    const r = computeSessionMinutes(training, { durationMin: 75, effort: 1, manual });
    expect(r.minutes).toEqual(manual);
    expect(r.minutes).not.toBe(manual);
    expect(r.snapshot).toBeUndefined();
    expect('snapshot' in r).toBe(false);
  });

  it('snapshot ei muutu, jos lajin profiilia muutetaan myöhemmin', () => {
    const t: ActivityType = { ...training, shares: { ...training.shares } };
    const r = computeSessionMinutes(t, { durationMin: 75, effort: 0 });
    t.shares.moderate = 0.9;
    expect(r.snapshot).toEqual({ light: 0.35, moderate: 0.3, vigorous: 0.15 });
  });
});

describe('A6–A9 kouluikäiset', () => {
  const mvpa = [50, 70, 60, 80, 40, 65, 55];

  it('A6 MVPA 50,70,60,80,40,65,55 → ka. 60,0, met, aktiivisia päiviä 4', () => {
    const ev = evaluatePeriod('school_age', weekOfTotals(mvpa.map(mvpaMin)), settings);
    expect(ev.evaluable).toBe(true);
    expect(ev.n).toBe(7);
    expect(ev.schoolAge!.mvpaAvg.logged.actual).toBeCloseTo(60.0, 10);
    expect(ev.schoolAge!.mvpaAvg.logged.status).toBe('met');
    expect(ev.schoolAge!.mvpaAvg.combined.status).toBe('met');
    expect(ev.schoolAge!.activeDays.logged).toBe(4);
  });

  it('A7 sama viikko, 40 min päivä sairaana → N = 6, ka. 63,3, met', () => {
    const p = profile();
    const flags: DayFlag[] = [
      { id: 'f:p1:2026-11-13', profileId: 'p1', date: '2026-11-13', reason: 'sick', updatedAt: 'x', updatedBy: 'd' },
    ];
    const days = validDays(weekPeriod(WEEK_MON), p, flags, '2026-11-30');
    expect(days).toHaveLength(6);
    expect(days).not.toContain('2026-11-13');
    const all = weekOfTotals(mvpa.map(mvpaMin));
    const ev = evaluatePeriod('school_age', all.filter((d) => days.includes(d.date)), settings);
    expect(ev.n).toBe(6);
    expect(Math.round(ev.schoolAge!.mvpaAvg.logged.actual * 10) / 10).toBe(63.3);
    expect(ev.schoolAge!.mvpaAvg.logged.status).toBe('met');
  });

  it('A8 kolme lihaskertaa samana tiistaina → lihaspäiviä 1', () => {
    const tue = weekDates()[1];
    const sessions = [1, 2, 3].map(() => session({ date: tue, minutes: mvpaMin(20), muscle: true }));
    const days = weekDates().map((d) => dayTotals(d, sessions, [], typesMap()));
    const ev = evaluatePeriod('school_age', days, settings);
    expect(ev.schoolAge!.muscleDays.actual).toBe(1);
    expect(ev.schoolAge!.muscleDays.status).toBe('below');
  });

  it('A9 rasittava 12,9,10,0,30,5,0, raja 10 → rasittavia päiviä 3, met', () => {
    const v = [12, 9, 10, 0, 30, 5, 0];
    const ev = evaluatePeriod(
      'school_age',
      weekOfTotals(v.map((x) => ({ light: 0, moderate: 0, vigorous: x }))),
      { ...settings, vigorousDayMin: 10 },
    );
    expect(ev.schoolAge!.vigorousDays.actual).toBe(3);
    expect(ev.schoolAge!.vigorousDays.status).toBe('met');
  });

  it('A9b rasittavan päivän raja tulee asetuksista', () => {
    const v = [12, 9, 10, 0, 30, 5, 0];
    const ev = evaluatePeriod(
      'school_age',
      weekOfTotals(v.map((x) => ({ light: 0, moderate: 0, vigorous: x }))),
      { ...settings, vigorousDayMin: 11 },
    );
    expect(ev.schoolAge!.vigorousDays.actual).toBe(2);
  });
});

describe('A10 alle kouluikäiset', () => {
  it('130/40/15 ei täyty (MVPA 55); 120/45/20 täyttyy (185 ja 65)', () => {
    const days = weekOfTotals([
      { light: 130, moderate: 40, vigorous: 15 },
      { light: 120, moderate: 45, vigorous: 20 },
    ]).slice(0, 2);
    expect(days[0].total).toBe(185);
    expect(days[0].mvpa).toBe(55);
    expect(days[1].total).toBe(185);
    expect(days[1].mvpa).toBe(65);
    const ev = evaluatePeriod('early_years', days, settings);
    expect(ev.earlyYears!.daysMet.logged.actual).toBe(1);
    expect(ev.earlyYears!.daysMet.logged.target).toBe(2);
    expect(ev.earlyYears!.daysMet.logged.status).toBe('below'); // 50 %
    const second = evaluatePeriod('early_years', [days[1]], settings);
    expect(second.earlyYears!.daysMet.logged.status).toBe('met');
  });
});

describe('A11 aikuiset', () => {
  const week = (moderate: number, vigorous: number) =>
    weekOfTotals([{ light: 0, moderate, vigorous }, ...Array(6).fill({ light: 0, moderate: 0, vigorous: 0 })]);

  it('reipas 100 + rasittava 25 → W = 150, met', () => {
    const ev = evaluatePeriod('adult', week(100, 25), settings);
    expect(ev.adult!.weighted.logged.actual).toBe(150);
    expect(ev.adult!.weighted.logged.target).toBe(150);
    expect(ev.adult!.weighted.logged.status).toBe('met');
  });

  it('reipas 100 + rasittava 20 → W = 140, near', () => {
    const ev = evaluatePeriod('adult', week(100, 20), settings);
    expect(ev.adult!.weighted.logged.actual).toBe(140);
    expect(ev.adult!.weighted.logged.status).toBe('near');
  });

  it('kesken oleva viikko: tavoite 150 · N/7', () => {
    const ev = evaluatePeriod('adult', week(70, 0).slice(0, 3), settings);
    expect(ev.adult!.weighted.logged.target).toBeCloseTo((150 * 3) / 7, 10);
    expect(ev.adult!.weighted.logged.status).toBe('met');
  });
});

describe('A12 suositusryhmä', () => {
  it('syntynyt 2019/03, koulu 2026/08 → 15.7.2026 early_years, 1.8.2026 school_age', () => {
    const p = profile({ birthYear: 2019, birthMonth: 3, schoolStart: { year: 2026, month: 8 } });
    expect(recommendationGroup(p, '2026-07-15')).toBe('early_years');
    expect(recommendationGroup(p, '2026-07-31')).toBe('early_years');
    expect(recommendationGroup(p, '2026-08-01')).toBe('school_age');
  });

  it('syntynyt 2019/01 ilman koulun alkua → 1.2.2026 school_age', () => {
    expect(recommendationGroup(profile({ birthYear: 2019, birthMonth: 1 }), '2026-02-01')).toBe('school_age');
  });

  it('syntynyt 2008/11 → 20.11.2026 adult', () => {
    const p = profile({ birthYear: 2008, birthMonth: 11 });
    expect(recommendationGroup(p, '2026-11-20')).toBe('adult');
    expect(recommendationGroup(p, '2026-11-14')).toBe('school_age'); // syntymäpäivä oletetaan 15. päiväksi
  });

  it('käsin asetettu ryhmä ohittaa säännöt', () => {
    const p = profile({ birthYear: 2019, birthMonth: 3, groupOverride: 'adult' });
    expect(recommendationGroup(p, '2026-07-15')).toBe('adult');
  });
});

describe('A13–A14 korvausperiaate', () => {
  const recess = estimate({
    category: 'school_recess',
    weekdayMin: 60,
    weekendMin: 0,
    shares: { light: 0.5, moderate: 0.25, vigorous: 0.05 },
  });
  const wed = '2026-11-11';
  const thu = '2026-11-12';

  it('A13 keskiviikko ilman välituntikirjausta → +30/15/3', () => {
    const d = dayTotals(wed, [], [recess], typesMap());
    expect(d.estimate).toEqual({ light: 30, moderate: 15, vigorous: 3 });
    expect(d.combined).toEqual({ light: 30, moderate: 15, vigorous: 3 });
    expect(d.logged).toEqual({ light: 0, moderate: 0, vigorous: 0 });
    expect(d.estimatedCategories).toEqual(['school_recess']);
  });

  it('A13 torstaina kirjattu välituntikerta 40 min → arvio ei käytössä', () => {
    const recessType = builtIn('school_recess');
    const { minutes } = computeSessionMinutes(recessType, { durationMin: 40, effort: 0 });
    const s = session({ date: thu, activityTypeId: recessType.id, minutes, intensitySource: 'profile' });
    const d = dayTotals(thu, [s], [recess], typesMap());
    expect(d.estimate).toEqual({ light: 0, moderate: 0, vigorous: 0 });
    expect(d.combined).toEqual(d.logged);
    expect(d.estimatedCategories).toEqual([]);
    expect(d.byCategory.school_recess?.source).toBe('logged');
  });

  it('A13b kirjaus toisessa kategoriassa ei estä arviota', () => {
    const s = session({ date: thu, activityTypeId: training.id, minutes: { light: 26, moderate: 23, vigorous: 11 } });
    const d = dayTotals(thu, [s], [recess], typesMap());
    expect(d.estimate).toEqual({ light: 30, moderate: 15, vigorous: 3 });
    expect(d.combined).toEqual({ light: 56, moderate: 38, vigorous: 14 });
    expect(d.mvpa).toBe(34);
    expect(d.mvpaCombined).toBe(52);
  });

  it('A13c viikonloppuna käytetään viikonloppuarvoa; voimassaolo päivämäärillä', () => {
    const e = estimate({ category: 'family', weekdayMin: 10, weekendMin: 100, shares: { light: 0.7, moderate: 0.3, vigorous: 0 }, validFrom: '2026-11-01', validTo: '2026-11-14' });
    expect(dayTotals('2026-11-14', [], [e], typesMap()).estimate).toEqual({ light: 70, moderate: 30, vigorous: 0 });
    expect(dayTotals('2026-11-15', [], [e], typesMap()).estimate).toEqual({ light: 0, moderate: 0, vigorous: 0 });
    expect(dayTotals('2026-10-31', [], [e], typesMap()).estimate).toEqual({ light: 0, moderate: 0, vigorous: 0 });
  });

  it('A13d uusi arvio korvaa vanhan samassa kategoriassa', () => {
    const old = estimate({ category: 'commute', weekdayMin: 20, shares: { light: 0.5, moderate: 0.5, vigorous: 0 }, validFrom: '2026-01-01' });
    const neu = estimate({ category: 'commute', weekdayMin: 40, shares: { light: 0.5, moderate: 0.5, vigorous: 0 }, validFrom: '2026-11-01' });
    expect(dayTotals(wed, [], [old, neu], typesMap()).estimate).toEqual({ light: 20, moderate: 20, vigorous: 0 });
  });

  it('A14 arvion rasittavat minuutit eivät tuota rasittavaa eivätkä vahvistavaa päivää', () => {
    const heavy = estimate({
      category: 'self_directed',
      weekdayMin: 100,
      weekendMin: 100,
      shares: { light: 0, moderate: 0.4, vigorous: 0.6 },
    });
    const days = weekDates().map((d) => dayTotals(d, [], [heavy], typesMap()));
    expect(days.every((d) => d.combined.vigorous === 60)).toBe(true);
    expect(days.every((d) => !d.muscle && !d.bone)).toBe(true);
    const ev = evaluatePeriod('school_age', days, { ...settings, vigorousDayMin: 10 });
    expect(ev.schoolAge!.vigorousDays.actual).toBe(0);
    expect(ev.schoolAge!.muscleDays.actual).toBe(0);
    expect(ev.schoolAge!.boneDays.actual).toBe(0);
    expect(ev.schoolAge!.mvpaAvg.combined.actual).toBe(100);
    expect(ev.schoolAge!.mvpaAvg.logged.actual).toBe(0);
    const adult = evaluatePeriod('adult', days, settings);
    expect(adult.adult!.muscleDays.actual).toBe(0);
  });
});

describe('A15 suunnitelmat eivät ole liikuntaa', () => {
  it('kolme avointa 90 min suunnitelmaa → minuutit 0; 3 kuittaamatonta', () => {
    const [mon, , wed, , fri] = weekDates();
    const plans = [mon, wed, fri].map((date) => planned({ date, durationMin: 90 }));
    // dayTotals ei edes ota suunnitelmia vastaan: liikunta tulee vain kerroista ja arvioista.
    const days = weekDates().map((d) => dayTotals(d, [], [], typesMap()));
    expect(days.every((d) => d.totalCombined === 0 && d.mvpaCombined === 0)).toBe(true);
    const ev = evaluatePeriod('school_age', days, settings);
    expect(ev.schoolAge!.mvpaAvg.combined.actual).toBe(0);
    const adh = planAdherence(plans, [], '2026-11-16');
    expect(adh.planned).toBe(3);
    expect(adh.unconfirmed).toBe(3);
    expect(adh.done).toBe(0);
    expect(adh.adherenceRate).toBeNull();
  });

  it('A15b kuittaamattomaksi lasketaan vain open ja päivä < tänään', () => {
    const [mon, , wed, , fri] = weekDates();
    const plans = [mon, wed, fri].map((date) => planned({ date }));
    const adh = planAdherence(plans, [], wed);
    expect(adh.open).toBe(3);
    expect(adh.unconfirmed).toBe(1);
  });

  it('A15c toteutumisaste ei laske peruttuja; kestoparit', () => {
    const [mon, tue, wed, thu] = weekDates();
    const s = session({ date: mon, minutes: mvpaMin(85), durationMin: 85 });
    const plans = [
      planned({ id: 'a', date: mon, status: 'done', sessionId: s.id }),
      planned({ date: tue, status: 'skipped', skipReason: 'sick' }),
      planned({ date: wed, status: 'skipped', skipReason: 'cancelled' }),
      planned({ date: thu, status: 'skipped' }),
    ];
    const adh = planAdherence(plans, [{ ...s, plannedSessionId: 'a' }], '2026-11-30');
    expect(adh.adherenceRate).toBeCloseTo(1 / 3, 10);
    expect(adh.skippedByReason).toMatchObject({ sick: 1, cancelled: 1, unspecified: 1 });
    expect(adh.pairs).toEqual([{ plannedSessionId: 'a', sessionId: s.id, plannedMin: 90, actualMin: 85 }]);
  });
});

describe('A16 arvion osuus', () => {
  it('kirjattu MVPA 200, yhdistetty 250 → 20 %', () => {
    expect(estimateShare(200, 250)).toBeCloseTo(0.2, 10);
    expect(estimateShare(0, 0)).toBe(0);
  });

  it('jakson laatu laskee arvion osuuden päiväkoosteista', () => {
    const e = estimate({ category: 'commute', weekdayMin: 50, weekendMin: 50, shares: { light: 0, moderate: 1, vigorous: 0 } });
    const s = session({ date: WEEK_MON, activityTypeId: training.id, minutes: mvpaMin(200) });
    const d = dayTotals(WEEK_MON, [s], [e], typesMap());
    expect(d.mvpa).toBe(200);
    expect(d.mvpaCombined).toBe(250);
    const ev = evaluatePeriod('school_age', [d], settings);
    expect(ev.quality.estimateShare).toBeCloseTo(0.2, 10);
  });
});
