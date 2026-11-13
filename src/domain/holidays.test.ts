import { describe, expect, it } from 'vitest';
import { dayTotals } from './aggregate';
import { weekPeriod } from './dates';
import { estimateBaseMin, holidayDates, holidayError, holidayOn, sortHolidays, type Holiday } from './holidays';
import { weeklyHours } from './hours';
import { activityTypeId } from './ids';
import { planAdherence } from './adherence';
import { estimate, planned, typesMap } from './test-helpers';

const syys: Holiday = { id: 'h1', label: 'Syysloma', start: '2026-10-12', end: '2026-10-16' };
const vainP2: Holiday = { id: 'h2', label: 'Leiri', start: '2026-11-10', end: '2026-11-11', profileIds: ['p2'] };
const recess = estimate({ category: 'school_recess', weekdayMin: 60, weekendMin: 0, validFrom: '2026-01-01' });
const commute = estimate({ category: 'commute', weekdayMin: 20, weekendMin: 10, validFrom: '2026-01-01' });

describe('lomajaksot', () => {
  it('päivät jaksolta, rajaus profiiliin ja hakujaksoon', () => {
    expect([...holidayDates([syys, vainP2], 'p1', '2026-10-14', '2026-11-30')]).toEqual(['2026-10-14', '2026-10-15', '2026-10-16']);
    expect([...holidayDates([syys, vainP2], 'p2', '2026-11-01', '2026-11-30')]).toEqual(['2026-11-10', '2026-11-11']);
    expect(holidayOn([syys], 'p1', '2026-10-12')?.label).toBe('Syysloma');
    expect(holidayOn([syys], 'p1', '2026-10-17')).toBeUndefined();
    expect(holidayDates(undefined, 'p1', '2026-01-01', '2026-12-31').size).toBe(0);
  });
  it('lomapäivänä perusarvio viikonlopun arvoilla', () => {
    expect(estimateBaseMin(recess, '2026-10-13')).toBe(60);
    expect(estimateBaseMin(recess, '2026-10-13', true)).toBe(0);
    expect(estimateBaseMin(commute, '2026-10-13', true)).toBe(10);
    const types = typesMap();
    const shared = estimate({ category: 'school_recess', weekdayMin: 60, weekendMin: 0, validFrom: '2026-01-01', shares: { light: 0.5, moderate: 0.3, vigorous: 0.2 } });
    expect(dayTotals('2026-10-13', [], [shared], types).totalCombined).toBe(60);
    expect(dayTotals('2026-10-13', [], [shared], types, true).totalCombined).toBe(0);
  });
  it('viikon tunnit: lomapäivä viikonloppuna, lomalla ohitettu suunnitelma ei ole arviossa', () => {
    const week = weekPeriod('2026-10-14');
    const pe = planned({ date: '2026-10-13', activityTypeId: activityTypeId('school_pe'), durationMin: 45, status: 'skipped', skipReason: 'holiday' });
    const base = { period: week, sessions: [], planned: [pe], estimates: [recess], flags: [], types: typesMap(), today: '2026-10-18' };
    const normal = weeklyHours(base);
    const hol = weeklyHours({ ...base, holidays: holidayDates([syys], 'p1', week.start, week.end) });
    expect(normal.expectedMin).toBe(5 * 60);
    expect(hol.expectedMin).toBe(0);
    expect(hol.days.filter((d) => d.holiday).map((d) => d.date)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16']);
  });
  it('loma ei ole poisjäänti toteutumisasteessa', () => {
    const a = planAdherence(
      [planned({ date: '2026-10-13', status: 'skipped', skipReason: 'holiday' }), planned({ date: '2026-10-20', status: 'done' })],
      [],
      '2026-10-30',
    );
    expect(a.skippedByReason.holiday).toBe(1);
    expect(a.adherenceRate).toBe(1);
  });
  it('tarkistus ja järjestys', () => {
    expect(holidayError({ label: ' ', start: '2026-10-12', end: '2026-10-16' })).toMatch(/nimi/);
    expect(holidayError({ label: 'X', start: '2026-10-16', end: '2026-10-12' })).toMatch(/ennen/);
    expect(holidayError({ label: 'X', start: '2026-06-01', end: '2026-12-01' })).toMatch(/120/);
    expect(holidayError(syys)).toBeNull();
    expect(sortHolidays([syys, vainP2]).map((h) => h.id)).toEqual(['h2', 'h1']);
  });
});
