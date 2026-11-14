// Alle kouluikäisen päiväsuositus kestona (käyttäjän päätös 14.11.2026) ja päiväkodin osuus.
import { describe, expect, it } from 'vitest';
import { daycareDay, dayTotals, earlyYearsDay, evaluatePeriod } from './aggregate';
import { dayGoalMet } from './dayTarget';
import { heatLevel } from './heatmap';
import { computeSessionMinutes } from './intensity';
import { activityTypeId } from './ids';
import { DEFAULT_SETTINGS } from './recommendations';
import { builtIn, estimate, session, typesMap } from './test-helpers';

const D = '2026-11-11'; // keskiviikko

describe('alle kouluikäisen päiväsuositus', () => {
  it('3 h leikki täyttää 3 h -ehdon kestona, vaikka tehominuutteja on vähemmän', () => {
    const t = builtIn('outdoor_play');
    const s = session({ date: D, activityTypeId: t.id, durationMin: 180, intensitySource: 'profile', minutes: computeSessionMinutes(t, { durationMin: 180, effort: 0 }).minutes });
    const d = dayTotals(D, [s], [], typesMap());
    expect(d.total).toBeLessThan(180); // kevyt + reipas + rasittava ≈ 153
    expect(d.moving).toBe(180);
    expect(d.mvpa).toBe(72);
    expect(earlyYearsDay(d)).toMatchObject({ moving: 180, met: true });
    expect(dayGoalMet('early_years', d)).toBe(true);
    const ev = evaluatePeriod('early_years', [d], DEFAULT_SETTINGS);
    expect(ev.earlyYears!.daysMet.combined.actual).toBe(1);
    expect(ev.earlyYears!.totalAvg.combined.actual).toBe(180);
  });

  it('arkiliikunnan minuutit lasketaan kestoon; kirjaus korvaa saman kategorian arvion', () => {
    const daycare = estimate({ category: 'daycare', label: 'Päiväkotipäivä', weekdayMin: 120, shares: builtIn('daycare_day').shares });
    const t = builtIn('kick_scooter');
    const s = session({ date: D, activityTypeId: t.id, durationMin: 60, intensitySource: 'profile', minutes: computeSessionMinutes(t, { durationMin: 60, effort: 0 }).minutes });
    const d = dayTotals(D, [s], [daycare], typesMap());
    expect(d.moving).toBe(60);
    expect(d.movingCombined).toBe(180);
    expect(d.byCategory.daycare).toMatchObject({ source: 'estimate', durationMin: 120 });
    expect(daycareDay(d)).toEqual({ moving: 120, mvpa: 40, met: true });
    expect(earlyYearsDay(d).met).toBe(d.mvpaCombined >= 60);
    // Pelkkä 1 h vauhdikas ei riitä ilman 3 h:ta.
    expect(dayGoalMet('early_years', dayTotals(D, [s], [], typesMap()))).toBe(false);
    // Koululaisella tavoite on edelleen reipas + rasittava.
    expect(dayGoalMet('school_age', d)).toBe(d.mvpaCombined >= 60);
  });

  it('kartta: alle kouluikäisen tavoitetaso vaatii molemmat ehdot', () => {
    expect(heatLevel('target', { mvpa: 70, total: 100, sessions: 1, target: 60, moving: 120, movingTarget: 180 })).toBe(2);
    expect(heatLevel('target', { mvpa: 70, total: 150, sessions: 1, target: 60, moving: 190, movingTarget: 180 })).toBe(3);
    expect(heatLevel('target', { mvpa: 70, total: 100, sessions: 1, target: 60 })).toBe(3);
  });

  it('päiväkotipäivä on sisäänrakennettu laji', () => {
    expect(typesMap().get(activityTypeId('daycare_day'))).toMatchObject({ category: 'daycare', name: 'Päiväkotipäivä' });
  });
});
