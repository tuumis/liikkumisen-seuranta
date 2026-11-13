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

describe('välitunnit vain arkiliikunnassa', () => {
  it('erillinen välituntikerta muuttuu vahvistukseksi arviopäivinä; minuutit ja luvut säilyvät', async () => {
    await repo.saveEstimate('p1', recess(), '2026-11-02');
    const inside = await repo.createSession({ profileId: 'p1', activityTypeId: 't:school_recess', date: '2026-11-05', durationMin: 45, effort: 0, muscle: false, bone: true });
    const before = await repo.createSession({ profileId: 'p1', activityTypeId: 't:school_recess', date: '2026-10-30', durationMin: 30, effort: 0, muscle: false, bone: false });
    const other = await repo.createSession({ profileId: 'p1', activityTypeId: 't:commute_walk', date: '2026-11-05', durationMin: 20, effort: 0, muscle: false, bone: false });
    const all = await repo.listEstimates('p1');
    const totalsBefore = dayTotals('2026-11-05', await repo.sessionsInRange('p1', '2026-11-05', '2026-11-05'), all, types);

    expect(await repo.foldEstimateOnlySessions('2026-11-13')).toBe(1);
    const s = (await db.sessions.get(inside.id))!;
    expect(s.estimateConfirmed).toBe(true);
    expect(s.label).toBe('Välitunnit ja pihaleikit');
    expect(s.durationMin).toBe(45);
    expect(s.bone).toBe(true);
    expect((await db.sessions.get(before.id))!.estimateConfirmed).toBeUndefined(); // ennen arviota
    expect((await db.sessions.get(other.id))!.estimateConfirmed).toBeUndefined(); // muu kategoria
    // Päivän luvut eivät muutu; välituntien minuutit lasketaan nyt arkiliikunnan vahvistukseksi.
    const after = dayTotals('2026-11-05', await repo.sessionsInRange('p1', '2026-11-05', '2026-11-05'), all, types);
    expect({ ...after, confirmedMvpa: 0 }).toEqual(totalsBefore);
    expect(after.confirmedMvpa).toBeGreaterThan(0);

    // Idempotentti.
    expect(await repo.foldEstimateOnlySessions('2026-11-13')).toBe(0);
  });
});

describe('välituntien viikkorytmi', () => {
  it('välituntirivi poistuu käytöstä ja sen avoimet suunnitelmat poistuvat; muut rivit säilyvät', async () => {
    const today = '2026-11-13';
    await repo.saveEstimate('p1', recess(), '2026-11-02');
    const rec = await repo.createTemplateItem('p1', { activityTypeId: 't:school_recess', weekdays: [1, 2, 3, 4, 5], durationMin: 45, validFrom: today }, today);
    const pe = await repo.createTemplateItem('p1', { activityTypeId: 't:school_pe', weekdays: [1], durationMin: 90, validFrom: today }, today);
    const open = (id: string) => repo.plansInRange('p1', today, '2026-11-30').then((ps) => ps.filter((p) => p.templateItemId === id && p.status === 'open').length);
    expect(await open(rec.id)).toBeGreaterThan(0);

    expect(await repo.foldEstimateOnlySessions(today)).toBeGreaterThan(0);
    expect((await db.templateItems.get(rec.id))!.active).toBe(false);
    expect(await open(rec.id)).toBe(0);
    expect((await db.templateItems.get(pe.id))!.active).toBe(true);
    expect(await open(pe.id)).toBeGreaterThan(0);
    expect(await repo.foldEstimateOnlySessions(today)).toBe(0);
  });

  it('ilman välituntiarviota viikkorytmi säilyy', async () => {
    const today = '2026-11-13';
    const rec = await repo.createTemplateItem('p1', { activityTypeId: 't:school_recess', weekdays: [1, 2], durationMin: 45, validFrom: today }, today);
    expect(await repo.foldEstimateOnlySessions(today)).toBe(0);
    expect((await db.templateItems.get(rec.id))!.active).toBe(true);
  });
});
