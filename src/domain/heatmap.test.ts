// Aktiivisuuskartta (SPEC 16): tasot, ruudukko, kuukausiotsikot ja putket.

import { describe, expect, it } from 'vitest';
import { heatColumns, heatLevel, heatRange, heatStats, last12Months, longestStreak, monthLabels, type HeatDay } from './heatmap';

const day = (p: Partial<HeatDay>): HeatDay => ({ date: '2026-01-01', mvpa: 0, total: 0, sessions: 0, target: 60, ...p });

describe('heatLevel', () => {
  it('tavoite: ei, alle 50 %, alle 100 %, tavoite, 150 %', () => {
    expect(heatLevel('target', day({ mvpa: 0 }))).toBe(0);
    expect(heatLevel('target', day({ mvpa: 29 }))).toBe(1);
    expect(heatLevel('target', day({ mvpa: 30 }))).toBe(2);
    expect(heatLevel('target', day({ mvpa: 59.6 }))).toBe(3); // pyöristyy 60 minuuttiin
    expect(heatLevel('target', day({ mvpa: 89 }))).toBe(3);
    expect(heatLevel('target', day({ mvpa: 90 }))).toBe(4);
  });
  it('minuutit: 1–30, 31–60, 61–90, yli 90', () => {
    expect([0, 1, 30, 31, 60, 61, 90, 91].map((total) => heatLevel('minutes', day({ total })))).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
  });
  it('kerrat: 1, 2, 3, 4+', () => {
    expect([0, 1, 2, 3, 4, 7].map((sessions) => heatLevel('sessions', day({ sessions })))).toEqual([0, 1, 2, 3, 4, 4]);
  });
});

describe('longestStreak', () => {
  it('peräkkäiset aktiiviset päivät; tauko tai aukko katkaisee', () => {
    const on = new Set(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-05', '2026-01-06']);
    const dates = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05', '2026-01-06'];
    expect(longestStreak(dates, (d) => on.has(d))).toBe(3);
    // Puuttuva päivä listassa (esim. jakson raja) katkaisee myös.
    expect(longestStreak(['2026-01-01', '2026-01-03'], () => true)).toBe(1);
    expect(longestStreak([], () => true)).toBe(0);
  });
});

describe('ruudukko', () => {
  it('vuosi 2026: 53 viikkosaraketta, jakson ulkopuoliset päivät tyhjiä', () => {
    const cols = heatColumns('2026-01-01', '2026-12-31');
    expect(cols).toHaveLength(53);
    expect(cols[0].weekStart).toBe('2025-12-29');
    expect(cols[0].days.slice(0, 3)).toEqual([null, null, null]);
    expect(cols[0].days[3]).toBe('2026-01-01');
    expect(cols.at(-1)!.days[3]).toBe('2026-12-31');
    expect(cols.at(-1)!.days[4]).toBeNull();
  });
  it('kuukausiotsikot kuukauden ensimmäisen päivän sarakkeeseen', () => {
    const labels = monthLabels(heatColumns('2026-01-01', '2026-12-31'));
    expect(labels).toHaveLength(12);
    expect(labels[0]).toEqual({ col: 0, label: 'tammi' });
    expect(labels[1].label).toBe('helmi');
    expect(labels.at(-1)!.label).toBe('joulu');
  });
  it('12 kk: alku kesken kuukauden saa otsikon vain, jos kuukautta on jäljellä', () => {
    const r = last12Months('2026-11-13');
    expect(r.start).toBe('2025-11-10');
    expect(r.end).toBe('2026-11-15');
    const labels = monthLabels(heatColumns(r.start, r.end));
    expect(labels[0]).toEqual({ col: 0, label: 'marras' });
    expect(monthLabels(heatColumns('2025-11-24', '2026-01-31'))[0].label).toBe('joulu');
  });
  it('arvot vain seurannan alusta tähän päivään', () => {
    expect(heatRange('2026-01-01', '2026-12-31', '2026-09-01', '2026-09-03')).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
    expect(heatRange('2025-01-01', '2025-12-31', '2026-09-01', '2026-09-03')).toEqual([]);
  });
});

describe('heatStats', () => {
  it('tunnit, aktiiviset päivät, putki ja tavoitepäivät', () => {
    const days = [
      day({ date: '2026-03-01', total: 60, mvpa: 60, sessions: 1 }),
      day({ date: '2026-03-02', total: 30, mvpa: 10, sessions: 0 }),
      day({ date: '2026-03-03', total: 0 }),
      day({ date: '2026-03-04', total: 90, mvpa: 90, sessions: 2 }),
    ];
    expect(heatStats(days, 'minutes')).toEqual({ hours: 3, activeDays: 3, days: 4, longestStreak: 2, targetDays: 2 });
    // Kerrat-mittarilla päivä ilman kirjattua kertaa ei ole aktiivinen.
    expect(heatStats(days, 'sessions')).toMatchObject({ activeDays: 2, longestStreak: 1 });
  });
});
