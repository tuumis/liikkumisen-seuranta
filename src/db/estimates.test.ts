// Vaihe 4: perusarvioiden tallennus – "uusi arvio päättää vanhan".

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type EstimateInput, type Repositories } from './repositories';
import { dayTotals } from '../domain/aggregate';
import { BUILT_IN_ACTIVITY_TYPES } from '../seed/activityTypes';

let n = 0;
let db: AppDB;
let repo: Repositories;
beforeEach(async () => {
  db = new AppDB(`estimates-${++n}`);
  repo = createRepositories(db);
  await repo.initialize();
});
afterEach(async () => {
  await db.delete();
});

const recess = (over: Partial<EstimateInput> = {}): EstimateInput => ({
  category: 'school_recess',
  label: 'Välitunnit ja pihaleikit',
  weekdayMin: 60,
  weekendMin: 0,
  shares: { light: 0.5, moderate: 0.25, vigorous: 0.05 },
  ...over,
});
const types = new Map(BUILT_IN_ACTIVITY_TYPES.map((t) => [t.id, t]));

describe('perusarviot', () => {
  it('uusi arvio alkaa tänään; muutos myöhemmin päättää vanhan eiliseen', async () => {
    const a = await repo.saveEstimate('p1', recess(), '2026-11-02');
    expect(a.validFrom).toBe('2026-11-02');
    const b = await repo.saveEstimate('p1', recess({ weekdayMin: 40 }), '2026-11-11');
    expect(b.id).not.toBe(a.id);
    expect((await db.estimates.get(a.id))!.validTo).toBe('2026-11-10');
    expect((await repo.activeEstimates('p1', '2026-11-11')).map((e) => e.weekdayMin)).toEqual([40]);

    // Menneen päivän luku ei muutu.
    const all = await repo.listEstimates('p1');
    expect(dayTotals('2026-11-09', [], all, types).estimate.moderate).toBe(15); // 60 · 0,25
    expect(dayTotals('2026-11-11', [], all, types).estimate.moderate).toBe(10); // 40 · 0,25
  });

  it('samana päivänä alkanut arvio päivitetään paikallaan', async () => {
    const a = await repo.saveEstimate('p1', recess(), '2026-11-11');
    const b = await repo.saveEstimate('p1', recess({ weekendMin: 30, label: ' Välitunnit ' }), '2026-11-11');
    expect(b.id).toBe(a.id);
    expect(b.label).toBe('Välitunnit');
    expect(await db.estimates.count()).toBe(1);
  });

  it('eri kategoriat ovat erillisiä; muut profiilit eivät näy', async () => {
    await repo.saveEstimate('p1', recess(), '2026-11-11');
    await repo.saveEstimate('p1', recess({ category: 'commute', label: 'Koulumatkat', weekdayMin: 20 }), '2026-11-11');
    await repo.saveEstimate('p2', recess(), '2026-11-11');
    expect((await repo.activeEstimates('p1', '2026-11-11')).map((e) => e.category).sort()).toEqual(['commute', 'school_recess']);
  });

  it('lopetus: aiemmin alkanut päätetään eiliseen, tänään alkanut poistetaan', async () => {
    const a = await repo.saveEstimate('p1', recess(), '2026-11-02');
    await repo.endEstimate(a.id, '2026-11-11');
    expect((await db.estimates.get(a.id))!.validTo).toBe('2026-11-10');
    expect(await repo.activeEstimates('p1', '2026-11-11')).toEqual([]);
    expect(await repo.listEstimates('p1')).toHaveLength(1); // historia säilyy

    const b = await repo.saveEstimate('p1', recess({ category: 'commute', label: 'Koulumatkat' }), '2026-11-11');
    await repo.endEstimate(b.id, '2026-11-11');
    expect((await db.estimates.get(b.id))!.deletedAt).toBeDefined();
  });
});

describe('alkamispäivän muutos (lisäys 16)', () => {
  it('uusi arvio voi alkaa menneestä päivästä, ei tulevasta', async () => {
    const a = await repo.saveEstimate('p1', recess(), '2026-11-12', '2026-09-01');
    expect(a.validFrom).toBe('2026-09-01');
    expect((await repo.activeEstimates('p1', '2026-11-12')).map((e) => e.id)).toEqual([a.id]);
    await expect(repo.saveEstimate('p1', recess(), '2026-11-12', '2026-11-20')).rejects.toThrow();
  });

  it('korjaus siirtää alkamispäivää ja arvoja paikallaan; aiempi arvio väistyy', async () => {
    const old = await repo.saveEstimate('p1', recess({ weekdayMin: 30 }), '2026-10-01');
    const cur = await repo.saveEstimate('p1', recess({ weekdayMin: 60 }), '2026-11-11');
    expect((await db.estimates.get(old.id))!.validTo).toBe('2026-11-10');

    // Korjataan nykyinen alkamaan 15.10.: vanha päättyy 14.10.
    const fixed = await repo.correctEstimate(cur.id, recess({ weekdayMin: 45 }), '2026-10-15', '2026-11-12');
    expect(fixed).toMatchObject({ id: cur.id, validFrom: '2026-10-15', weekdayMin: 45 });
    expect((await db.estimates.get(old.id))!.validTo).toBe('2026-10-14');

    // Korjataan alkamaan ennen vanhaa: vanha poistuu kokonaan.
    await repo.correctEstimate(cur.id, recess({ weekdayMin: 45 }), '2026-09-01', '2026-11-12');
    expect((await db.estimates.get(old.id))!.deletedAt).toBeTruthy();
    expect((await repo.listEstimates('p1')).map((e) => e.validFrom)).toEqual(['2026-09-01']);
  });
});

describe('seurannan alku', () => {
  it('profiilin trackingStart korvaa luontipäivän; tyhjennys palauttaa luontipäivän', async () => {
    const { trackingStart } = await import('../domain/aggregate');
    const p = await repo.createProfile({ name: 'A', kind: 'child', birthYear: 2018, birthMonth: 5, color: '#000' });
    await repo.updateProfile(p.id, { trackingStart: '2026-08-15' });
    expect(trackingStart((await db.profiles.get(p.id))!)).toBe('2026-08-15');
    await repo.updateProfile(p.id, { trackingStart: undefined });
    const again = (await db.profiles.get(p.id))!;
    expect('trackingStart' in again).toBe(false);
    expect(trackingStart(again)).toBe(trackingStart({ createdAt: p.createdAt }));
  });
});
