import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { coachPartOf, coachSummary, coachTitle, coachView, DEFAULT_COACH_OPTIONS, fi1, type CoachInput } from './coachSummary';
import { activityTypeId } from './ids';
import { planned, session, typesMap } from './test-helpers';
import type { ActivityType } from './types';

const types = typesMap();
const floorball: ActivityType = { ...types.get(activityTypeId('other'))!, id: 'floorball', name: 'Salibandy', category: 'hobby', builtIn: false };
types.set(floorball.id, floorball);

const MON = '2026-11-02'; // vk 45
const m = (min: number, vig = 0) => ({ light: min - vig, moderate: 0, vigorous: vig });
const at = (n: number) => addDays(MON, n);

function input(over: Partial<CoachInput> = {}): CoachInput {
  return { start: MON, end: addDays(MON, 27), today: addDays(MON, 27), sessions: [], plans: [], flags: [], types, vigorousMin: 20, ...over };
}

describe('coachSummary', () => {
  it('jakaa kerrat jalkapalloon, omatoimiseen, muihin lajeihin ja koululiikuntaan', () => {
    const tr = session({ id: 'tr', date: at(0), activityTypeId: activityTypeId('football_training'), minutes: m(90) });
    const wu = session({ id: 'w:tr', linkedTo: 'tr', date: at(0), activityTypeId: activityTypeId('football_self'), minutes: m(15) });
    const recess = session({ date: at(1), activityTypeId: activityTypeId('school_recess'), minutes: m(30) });
    const pe = session({ date: at(1), activityTypeId: activityTypeId('school_pe'), minutes: m(45) });
    const fb = session({ date: at(2), activityTypeId: 'floorball', minutes: m(60) });
    const est = session({ date: at(3), activityTypeId: activityTypeId('other'), minutes: m(30), estimateConfirmed: true });
    expect(coachPartOf(tr, types)).toBe('football');
    expect(coachPartOf(wu, types)).toBe('own');
    expect(coachPartOf(recess, types)).toBeUndefined();
    expect(coachPartOf(pe, types)).toBe('school');
    expect(coachPartOf(fb, types)).toBe('other');
    expect(coachPartOf(est, types)).toBeUndefined();

    const r = coachSummary(input({ sessions: [tr, wu, recess, pe, fb, est] }));
    expect(r.minutes).toEqual({ football: 90, own: 15, other: 60, school: 45 });
    expect(r.title).toBe('vk 45–48');
    expect(r.buckets.map((b) => b.label)).toEqual(['vk 45', 'vk 46', 'vk 47', 'vk 48']);
    expect(r.buckets[0].total).toBe(210);
    expect(r.buckets.map((b) => b.partial)).toEqual([false, false, false, false]);
    expect(r.footballShare).toBeCloseTo(105 / 210);
    expect(r.hoursPerWeek).toBeCloseTo(210 / 4 / 60);
    expect(r.otherTypes).toEqual([{ name: 'Salibandy', count: 1, perWeek: 0.25 }]);
    expect(r.clubTrainings.count).toBe(1);
    // Lepopäiviä = päivät ilman koosteeseen kuuluvaa kertaa (välitunti ei riitä).
    expect(r.restDaysPerWeek).toBeCloseTo(((28 - 3) / 28) * 7);
  });

  it('laskee osallistumisen ja poissaolot suunnitelluista kerroista; peruttu ei ole poissaolo', () => {
    const plans = [
      planned({ date: at(0), status: 'done' }),
      planned({ date: at(2), status: 'done' }),
      planned({ date: at(7), status: 'skipped', skipReason: 'sick' }),
      planned({ date: at(9), status: 'skipped', skipReason: 'cancelled' }),
      planned({ date: at(14), activityTypeId: activityTypeId('football_game'), status: 'skipped', skipReason: 'holiday' }),
      planned({ date: at(27), status: 'open' }), // tämä päivä, avoin: ei vielä mukana
    ];
    const r = coachSummary(input({ plans }));
    expect(r.clubTrainings).toMatchObject({ attended: 2, planned: 3 });
    expect(r.absences.count).toBe(2);
    expect(r.absences.reasons.map((x) => x.reason).sort()).toEqual(['holiday', 'sick']);
  });

  it('rasittavat päivät, pelit ja turnaukset sekä huomio peräkkäisistä rasittavista päivistä', () => {
    const sessions = [
      session({ date: at(7), activityTypeId: activityTypeId('football_training'), minutes: m(90, 25) }),
      session({ date: at(8), activityTypeId: activityTypeId('football_game'), minutes: m(60, 25) }),
      session({ date: at(9), activityTypeId: activityTypeId('football_tournament'), minutes: m(120, 40) }),
      session({ date: at(10), activityTypeId: activityTypeId('football_friendly'), minutes: m(60, 5) }),
    ];
    const r = coachSummary(input({ sessions }));
    expect(r.vigorousDaysPerWeek).toBeCloseTo(3 / 4);
    expect(r.games).toEqual({ count: 2, tournaments: 1, tournamentLabels: ['vk 46'] });
    expect(r.observations[0]).toBe('Kolme rasittavaa päivää peräkkäin vk 46 (ma–ke).');
  });

  it('huomio viikon kasvusta ja viikosta ilman lepopäivää', () => {
    const sessions = [
      ...[0, 2].map((d) => session({ date: at(d), activityTypeId: activityTypeId('football_training'), minutes: m(90) })),
      ...[7, 8, 9, 10, 11, 12, 13].map((d) => session({ date: at(d), activityTypeId: activityTypeId('football_training'), minutes: m(60) })),
    ];
    const r = coachSummary(input({ sessions }));
    expect(r.observations).toEqual(['Viikolla 46 liikuntaa oli 133 % enemmän kuin edellisellä viikolla.', 'Viikolla 46 ei ollut lepopäivää.']);
  });

  it('rajaa jakson tähän päivään ja käyttää pitkällä jaksolla kuukausia', () => {
    const r = coachSummary(input({ start: '2026-09-01', end: '2026-12-31', today: '2026-11-25' }));
    expect(r.end).toBe('2026-11-25');
    expect(r.bucketKind).toBe('month');
    expect(r.buckets.map((b) => b.label)).toEqual(['syys', 'loka', 'marras']);
    expect(r.buckets.map((b) => b.partial)).toEqual([false, false, true]);
    expect(r.title).toBe('1.9.–25.11.2026');
    expect(r.footballShare).toBeNull();
  });

  it('otsikko ja luvut', () => {
    expect(coachTitle('2026-11-23', '2026-11-25', '2026-11-25')).toBe('vk 48');
    expect(coachTitle('2026-11-02', '2026-11-29', '2026-11-25')).toBe('vk 45–48');
    expect(coachTitle('2026-11-03', '2026-11-29', '2026-11-25')).toBe('3.11.–29.11.2026');
    expect(fi1(2.46)).toBe('2,5');
    expect(fi1(3)).toBe('3');
  });
});

describe('coachView', () => {
  const tr = () => session({ date: at(0), activityTypeId: activityTypeId('football_training'), minutes: m(90) });
  const own = () => session({ date: at(1), activityTypeId: activityTypeId('football_self'), minutes: m(30) });
  const fb = () => session({ date: at(2), activityTypeId: 'floorball', minutes: m(60) });

  it('oletusvalinnoilla liikunta, jalkapallon osuus ja lepopäivät', () => {
    const s = coachSummary(input({ sessions: [tr(), own(), fb()], plans: [planned({ date: at(7), status: 'skipped', skipReason: 'sick' })] }));
    const v = coachView(s, DEFAULT_COACH_OPTIONS);
    expect(v.parts).toEqual(['football', 'own', 'other', 'school']);
    expect(v.tiles.map((t) => t.label)).toEqual(['Liikuntaa', 'Jalkapalloa', 'Lepopäiviä']);
    expect(v.tiles[1].value).toBe('67 %');
    expect(v.rows.find((r) => r.label === 'Muut lajit')?.value).toBe('salibandy 0,3 /vko');
    expect(v.rows.find((r) => r.label === 'Poissaolot')?.value).toBe('1 kerta');
    expect(v.notes).toEqual([]);
  });

  it('piilotetut osat jäävät pois summista; syyt näkyvät valittaessa', () => {
    const s = coachSummary(input({ sessions: [tr(), own(), fb()], plans: [planned({ date: at(7), status: 'skipped', skipReason: 'sick' })] }));
    const v = coachView(s, { other: false, own: false, days: false, absences: true, reasons: true, notes: false });
    expect(v.parts).toEqual(['football']);
    expect(v.buckets[0].total).toBe(90);
    expect(v.tiles.map((t) => t.label)).toEqual(['Jalkapalloa', 'Seuran treenejä', 'Pelejä ja turnauksia']);
    expect(v.rows.map((r) => r.label)).toEqual(['Seuran treenit', 'Pelit ja turnaukset', 'Poissaolot']);
    expect(v.rows[2].value).toBe('1 kerta (sairas 1)');
  });
});
