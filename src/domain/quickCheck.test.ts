import { describe, expect, it } from 'vitest';
import { BUILT_IN_ACTIVITY_TYPES } from '../seed/activityTypes';
import { recommendationGroup } from './groups';
import { apportion, computeQuick, prefillFromQuick, quickGroup, schoolQuestionNeeded, type Level, type QuickAnswers } from './quickCheck';

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

const shares = (key: string) => BUILT_IN_ACTIVITY_TYPES.find((t) => t.key === key)!.shares;
const mvpaOf = (key: string) => shares(key).moderate + shares(key).vigorous;

describe('pikatesti: laskenta', () => {
  it('aktiivinen koululainen: osat lasketaan ohjelman teho-osuuksilla ja summautuvat päälukuun', () => {
    const r = computeQuick({ ...base, hobbies: [{ key: 'football', perWeek: 3, minutes: 90 }], commute: 'walk', commuteMin: 20, recess: 2 });
    // viikossa: jalkapallo 270 × 0,45 = 121,5; koulu 90 × 0,4 + 225 × 0,4 = 126; matkat 100 × 0,4 = 40; leikki 420 × 0,4 = 168
    expect(r.parts.map((p) => +(p.mvpa * 7).toFixed(4))).toEqual([121.5, 126, 40, 168]);
    expect(r.mvpa).toBe(65); // 455,5 / 7 = 65,07
    expect(r.headline).toBe(65);
    expect(r.parts.map((p) => p.shown)).toEqual([17, 18, 6, 24]);
    expect(r.parts.reduce((s, p) => s + p.shown, 0)).toBe(r.headline);
    expect(r.status).toBe('meets');
    expect(r.checks.every((c) => c.ok)).toBe(true);
    expect(r.tips).toEqual([]); // suositus täyttyy eikä päivärajoja puutu
  });

  it('vähän liikkuva koululainen: alle, ja kaksi suurinta vinkkiä nykytilanteesta laskettuna', () => {
    const r = computeQuick({ ...base, age: 9, recess: 0, play: 0, vigorousDays: 1, strengthDays: 0 });
    // koulu 90 × 0,4 + 150 × 0,1 = 51; leikki 140 × 0,4 = 56 → 107 / 7 = 15,3
    expect(r.mvpa).toBe(15);
    expect(r.status).toBe('below');
    expect(r.checks.map((c) => c.ok)).toEqual([false, false, false]);
    expect(r.tips.map((t) => t.gain)).toEqual([16, 16]);
    expect(r.tips[0].text).toBe('Kävellen tai pyörällä kouluun (15 min suuntaansa) toisi noin 9–16 min reipasta liikuntaa päivässä.');
    expect(r.tips[1].text).toBe('40 min lisää ulkoleikkiä päivässä toisi noin 16 min reipasta liikuntaa.');
  });

  it('lähellä: 75 % tavoitteesta; välituntivinkki lasketaan erotuksena', () => {
    const r = computeQuick({ ...base, commute: 'bike', commuteMin: 30, recess: 1, play: 1 });
    // koulu 36 + 67,5; pyörä 150 × 0,75 = 112,5; leikki 168 → 384 / 7 = 54,9
    expect(r.mvpa).toBe(55);
    expect(r.status).toBe('near');
    expect(r.tips.map((t) => t.gain)).toEqual([24, 3]); // leikki +60 min; välitunnit 45 × (0,4 − 0,3) × 5 / 7
  });

  it('välituntien kolme tasoa eroavat toisistaan', () => {
    const v = ([0, 1, 2] as Level[]).map((recess) => computeQuick({ ...base, recess }).parts[1].mvpa * 7);
    expect(v.map((x) => +x.toFixed(4))).toEqual([36 + 15, 36 + 67.5, 36 + 90]);
  });

  it('"Muu ohjattu harrastus" on lajien keskitasoa, ei ohjelman varovaista Muu-lajia', () => {
    const other = computeQuick({ ...base, hobbies: [{ key: 'other', perWeek: 1, minutes: 70 }] }).parts[0].mvpa * 7;
    expect(other).toBeCloseTo(35); // 70 × 0,5
    const football = computeQuick({ ...base, hobbies: [{ key: 'football', perWeek: 1, minutes: 70 }] }).parts[0].mvpa * 7;
    expect(other).toBeGreaterThan(football);
    expect(other).toBeLessThan(70 * mvpaOf('floorball'));
  });

  it('jo kävelevälle ehdotetaan pyörää lisäyksenä, ei koko matkaa', () => {
    const r = computeQuick({ ...base, commute: 'walk', commuteMin: 10, recess: 0, play: 0 });
    const t = r.tips.find((x) => x.text.includes('Pyörällä'))!;
    expect(t.gain).toBe(Math.round((150 * 0.75 - 50 * 0.4) / 7)); // 13
  });

  it('alle kouluikäinen päiväkodissa: pääluku kaikki liikkuminen, tila heikomman tavoitteen mukaan', () => {
    const r = computeQuick({ ...base, age: 4, daycare: true, play: 1 });
    // päiväkoti 600 min (0,33 / 1,0), leikki 630 min (0,4 / 0,85)
    expect(r.group).toBe('early_years');
    expect(r.total).toBe(162);
    expect(r.mvpa).toBe(64);
    expect(r.headline).toBe(162);
    expect(r.headlineTarget).toBe(180);
    expect(r.status).toBe('near');
    expect(r.parts.map((p) => p.shown)).toEqual([0, 86, 0, 76]);
    expect(r.tips[0].text).toBe('60 min lisää ulkoleikkiä päivässä toisi noin 51 min liikkumista, josta noin 24 min vauhdikasta.');
    expect(r.tips[1].text).toBe('Kävely päiväkotiin (15 min suuntaansa) toisi noin 21 min liikkumista lisää päivässä.');
  });

  it('erittelyn rivit kertovat, mistä viikon keskiarvo tulee', () => {
    const r = computeQuick({ ...base, age: 4, daycare: true, play: 1, hobbies: [{ key: 'football', perWeek: 1, minutes: 60 }] });
    const basis = Object.fromEntries(r.parts.map((p) => [p.key, p.basis]));
    expect(basis.hobbies).toBe('Viikossa 1 × 60 min');
    expect(basis.daycare).toBe('Arkipäivisin noin 120 min liikkumista');
    expect(basis.play).toMatch(/^Joka päivä noin \d+ min$/);
    const two = computeQuick({ ...base, hobbies: [{ key: 'football', perWeek: 3, minutes: 90 }, { key: 'dance', perWeek: 2, minutes: 60 }] });
    expect(two.parts[0].basis).toBe('Viikossa 3 × 90 min ja 2 × 60 min (yhteensä 390 min)');
  });

  it('kotona hoidettava: leikkiä enemmän, ei matkaa eikä matkavinkkiä', () => {
    const r = computeQuick({ ...base, age: 3, daycare: false, commute: 'walk', commuteMin: 30, play: 2 });
    expect(r.parts.find((p) => p.key === 'commute')!.mvpa).toBe(0);
    expect(r.total).toBe(204); // 240 × 0,85
    expect(r.status).toBe('meets');
    const low = computeQuick({ ...base, age: 3, daycare: false, play: 0 });
    expect(low.status).toBe('below');
    expect(low.tips.some((t) => t.text.includes('päiväkotiin'))).toBe(false);
    expect(low.tips.length).toBeGreaterThan(0);
  });

  it('jaon pyöristys säilyttää summan', () => {
    expect(apportion([1.5, 1.5, 1.0], 4)).toEqual([2, 1, 1]);
    expect(apportion([0.4, 0.4, 0.4], 1)).toEqual([1, 0, 0]);
    expect(apportion([10.2, 3.9], 14)).toEqual([10, 4]);
  });
});

describe('pikatesti: koulu vai ei', () => {
  it('kysytään vain, kun ikä ei ratkaise', () => {
    expect(schoolQuestionNeeded(6, 11)).toBe(true); // syksy: osa 6-vuotiaista koulussa
    expect(schoolQuestionNeeded(6, 3)).toBe(false);
    expect(schoolQuestionNeeded(7, 3)).toBe(true); // kevät: osa 7-vuotiaista esikoulussa
    expect(schoolQuestionNeeded(7, 11)).toBe(false);
    expect(quickGroup(6, true)).toBe('school_age');
    expect(quickGroup(7, false)).toBe('early_years');
    expect(quickGroup(7)).toBe('school_age');
    expect(quickGroup(6)).toBe('early_years');
  });

  it('esitäytetty profiili saa ohjelmassa saman suositusryhmän kuin pikatesti (kaikki iät ja kuukaudet)', () => {
    for (let month = 1; month <= 12; month++) {
      const on = `2027-${String(month).padStart(2, '0')}-20`;
      for (let age = 1; age <= 17; age++) {
        const options = schoolQuestionNeeded(age, month) ? [true, false] : [undefined];
        for (const inSchool of options) {
          const a = { ...base, age, inSchool, daycare: true };
          const p = prefillFromQuick(a, 2027, month);
          const app = recommendationGroup({ birthYear: p.birthYear, birthMonth: 1, schoolStart: { year: p.schoolStartYear, month: 8 } }, on);
          expect(app, `ikä ${age}, kk ${month}, koulussa ${inSchool}`).toBe(quickGroup(age, inSchool));
        }
      }
    }
  });
});

describe('pikatesti: esitäyttö', () => {
  it('syntymävuosi, koulun alku, jalkapallo, harrastukset ja arkiliikunnan arviot lajeineen', () => {
    const p = prefillFromQuick(
      { ...base, hobbies: [{ key: 'football', perWeek: 3, minutes: 90 }, { key: 'dance', perWeek: 0, minutes: 60 }], commute: 'bike', commuteMin: 20, recess: 2 },
      2026,
      11,
    );
    expect(p.birthYear).toBe(2016);
    expect(p.schoolStartYear).toBe(2023);
    expect(p.football).toBe(true);
    expect(p.hobbies).toEqual([{ typeKey: 'football_training', label: 'Jalkapallo', icon: '⚽', perWeek: 3, minutes: 90 }]);
    expect(p.estimates).toEqual([
      { category: 'school_recess', typeKey: 'outdoor_play', weekdayMin: 45, weekendMin: 0 },
      { category: 'commute', typeKey: 'commute_bike', weekdayMin: 20, weekendMin: 0 },
      { category: 'self_directed', typeKey: 'outdoor_play', weekdayMin: 60, weekendMin: 60 },
    ]);
    const small = prefillFromQuick({ ...base, age: 4, daycare: true, play: 2 }, 2026, 11);
    expect(small.estimates).toEqual([
      { category: 'daycare', typeKey: 'daycare_day', weekdayMin: 120, weekendMin: 0 },
      { category: 'self_directed', typeKey: 'outdoor_play', weekdayMin: 150, weekendMin: 150 },
    ]);
  });

  it('ohjelma laskee esitäytetyistä tiedoista saman viikon kuin pikatesti (koululiikuntaa lukuun ottamatta)', () => {
    for (const recess of [0, 1, 2] as Level[])
      for (const play of [0, 1, 2] as Level[])
        for (const commute of ['car', 'walk', 'bike'] as const) {
          const a: QuickAnswers = { ...base, recess, play, commute, commuteMin: commute === 'car' ? 0 : 20, hobbies: [{ key: 'floorball', perWeek: 2, minutes: 75 }] };
          const r = computeQuick(a);
          const p = prefillFromQuick(a, 2026, 11);
          const week =
            p.estimates.reduce((s, e) => s + (5 * e.weekdayMin + 2 * e.weekendMin) * mvpaOf(e.typeKey), 0) +
            p.hobbies.reduce((s, h) => s + h.perWeek * h.minutes * mvpaOf(h.typeKey), 0) +
            90 * mvpaOf('school_pe');
          expect(week / 7, `välitunnit ${recess}, leikki ${play}, matka ${commute}`).toBeCloseTo(r.parts.reduce((s, x) => s + x.mvpa, 0), 6);
        }
  });
});
