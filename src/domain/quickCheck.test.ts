import { describe, expect, it } from 'vitest';
import { computeQuick, prefillFromQuick, quickGroup, type QuickAnswers } from './quickCheck';

const base: QuickAnswers = {
  age: 10,
  hobbies: [],
  commute: 'car',
  commuteMin: 0,
  recess: 1,
  daycare: false,
  play: 1,
  vigorousDays: 3,
  strengthDays: 3,
};

describe('pikatesti', () => {
  it('ikäryhmä: 7 vuotta täyttänyt on koululainen', () => {
    expect(quickGroup(6)).toBe('early_years');
    expect(quickGroup(7)).toBe('school_age');
  });

  it('aktiivinen koululainen: harrastus, kävely, välitunnit ja leikki ylittävät 60 min/pv', () => {
    const r = computeQuick({ ...base, hobbies: [{ key: 'football', perWeek: 3, minutes: 90 }], commute: 'walk', commuteMin: 20, recess: 2 });
    // jalkapallo 270 × 0,45 + koulu (90 × 0,4 + 225 × 0,3) + matkat 100 × 0,4 + leikki 420 × 0,4 = 433 min/vko
    expect(r.mvpa).toBe(62);
    expect(r.headline).toBe(62);
    expect(r.headlineTarget).toBe(60);
    expect(r.status).toBe('meets');
    expect(r.parts.map((p) => p.key)).toEqual(['hobbies', 'school', 'commute', 'play']);
    expect(r.checks.every((c) => c.ok)).toBe(true);
  });

  it('vähän liikkuva koululainen jää alle ja saa kaksi suurinta vinkkiä', () => {
    const r = computeQuick({ ...base, age: 9, recess: 0, play: 0, vigorousDays: 1, strengthDays: 0 });
    expect(r.mvpa).toBe(15);
    expect(r.status).toBe('below');
    expect(r.checks.map((c) => c.ok)).toEqual([false, false, false]);
    expect(r.tips).toHaveLength(2);
    expect(r.tips[0].text).toContain('kouluun');
    expect(r.tips[1].text).toContain('ulkoleikkiä');
  });

  it('raja "lähellä" on 75 % tavoitteesta', () => {
    const r = computeQuick({ ...base, commute: 'bike', commuteMin: 30, recess: 2, play: 1 });
    expect(r.mvpa).toBeGreaterThanOrEqual(45);
    expect(r.mvpa).toBeLessThan(60);
    expect(r.status).toBe('near');
  });

  it('alle kouluikäinen: pääluku on kaikki liikkuminen, tila heikomman tavoitteen mukaan', () => {
    const r = computeQuick({ ...base, age: 4, daycare: true, play: 1 });
    expect(r.group).toBe('early_years');
    expect(r.total).toBe(162);
    expect(r.mvpa).toBe(64);
    expect(r.headline).toBe(162);
    expect(r.headlineTarget).toBe(180);
    expect(r.status).toBe('near');
    expect(r.parts.map((p) => p.key)).toEqual(['hobbies', 'daycare', 'commute', 'play']);
    expect(r.checks).toHaveLength(2);
  });

  it('auto ei tuo matkaliikuntaa, ja kotona oleva pienokainen ei saa matkavinkkiä', () => {
    const r = computeQuick({ ...base, age: 3, daycare: false, commute: 'walk', commuteMin: 30, play: 2 });
    expect(r.parts.find((p) => p.key === 'commute')!.mvpa).toBe(0);
    expect(r.tips.some((t) => t.text.includes('päiväkotiin'))).toBe(false);
  });

  it('esitäyttö: syntymävuosi, jalkapallo, harrastukset ja arkiliikunnan arviot', () => {
    const p = prefillFromQuick({ ...base, hobbies: [{ key: 'football', perWeek: 3, minutes: 90 }, { key: 'dance', perWeek: 0, minutes: 60 }], commute: 'walk', commuteMin: 20, recess: 2 }, 2026);
    expect(p.birthYear).toBe(2016);
    expect(p.football).toBe(true);
    expect(p.hobbies).toEqual([{ typeKey: 'football_training', label: 'Jalkapallo', icon: '⚽', perWeek: 3, minutes: 90 }]);
    expect(p.estimates).toEqual([
      { category: 'school_recess', weekdayMin: 45, weekendMin: 0 },
      { category: 'commute', weekdayMin: 20, weekendMin: 0 },
      { category: 'self_directed', weekdayMin: 60, weekendMin: 60 },
    ]);
    const small = prefillFromQuick({ ...base, age: 4, daycare: true, play: 2 }, 2026);
    expect(small.estimates).toEqual([
      { category: 'daycare', weekdayMin: 120, weekendMin: 0 },
      { category: 'self_directed', weekdayMin: 150, weekendMin: 150 },
    ]);
  });
});
