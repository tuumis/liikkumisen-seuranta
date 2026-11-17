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

describe('välitunnit kirjattavina (14.11.2026)', () => {
  it('välituntikerta pysyy omana kertanaan ja korvaa sen päivän välituntiarvion; viikkorytmi säilyy', async () => {
    const today = '2026-11-13';
    await repo.saveEstimate('p1', recess(), '2026-11-02');
    const s = await repo.createSession({ profileId: 'p1', activityTypeId: 't:school_recess', date: '2026-11-05', durationMin: 45, effort: 0, muscle: false, bone: true });
    const rec = await repo.createTemplateItem('p1', { activityTypeId: 't:school_recess', weekdays: [1, 2, 3, 4, 5], durationMin: 45, validFrom: today }, today);
    expect(await repo.foldEstimateOnlySessions(today)).toBe(0);
    expect((await db.sessions.get(s.id))!.estimateConfirmed).toBeUndefined();
    expect((await db.templateItems.get(rec.id))!.active).toBe(true);
    const d = dayTotals('2026-11-05', await repo.sessionsInRange('p1', '2026-11-05', '2026-11-05'), await repo.listEstimates('p1'), types);
    expect(d.byCategory.school_recess).toMatchObject({ source: 'logged', durationMin: 45 });
    expect(d.sessionCount).toBe(1);
  });
});

describe('arvion kategorian vaihto koko historiaan (17.11.2026)', () => {
  const daycare = (over: Partial<EstimateInput> = {}) => recess({ category: 'daycare', label: 'Päiväkoti', weekdayMin: 120, ...over });

  it('Muu-arvio siirtyy Päiväkotiin, päättyy uudemman alkuun ja vahvistukset siirtyvät; päiväkoti ei näy kahdesti', async () => {
    const old = await repo.saveEstimate('p1', daycare({ category: 'other', label: 'Päiväkotipäivä' }), '2026-11-17', '2026-09-01');
    const fresh = await repo.saveEstimate('p1', daycare(), '2026-11-17', '2026-10-15');
    const base = { profileId: 'p1', durationMin: 120, effort: 0 as const, muscle: false, bone: false, estimateConfirmed: true };
    const sep = await repo.createSession({ ...base, activityTypeId: 't:other', date: '2026-09-10' });
    const dupOld = await repo.createSession({ ...base, activityTypeId: 't:other', date: '2026-10-20' });
    const dupNew = await repo.createSession({ ...base, activityTypeId: 't:daycare_day', date: '2026-10-20' });
    const lone = await repo.createSession({ ...base, activityTypeId: 't:other', date: '2026-10-21' });
    const plain = await repo.createSession({ ...base, estimateConfirmed: undefined, effort: 1 as const, activityTypeId: 't:other', date: '2026-09-11' });

    // Ennen: lokakuun 22. päivänä kaksi arviota (Muu + Päiväkoti).
    const before = dayTotals('2026-10-22', [], await repo.listEstimates('p1'), types);
    expect(before.estimatedCategories.sort()).toEqual(['daycare', 'other']);

    const r = await repo.changeEstimateCategory(old.id, 'daycare');
    expect(r).toMatchObject({ moved: 2, removed: 1, validTo: '2026-10-14', dropped: false });
    expect(await db.estimates.get(old.id)).toMatchObject({ category: 'daycare', validTo: '2026-10-14' });
    expect((await db.estimates.get(fresh.id))!.validTo).toBeUndefined();
    expect((await db.sessions.get(sep.id))!.activityTypeId).toBe('t:daycare_day');
    expect((await db.sessions.get(lone.id))!.activityTypeId).toBe('t:daycare_day');
    expect((await db.sessions.get(dupOld.id))!.deletedAt).toBeTruthy();
    expect((await db.sessions.get(dupNew.id))!.deletedAt).toBeUndefined();
    expect((await db.sessions.get(plain.id))!.activityTypeId).toBe('t:other'); // tavallinen kerta ei siirry

    const all = await repo.listEstimates('p1');
    expect(dayTotals('2026-10-22', [], all, types).estimatedCategories).toEqual(['daycare']);
    expect(dayTotals('2026-09-15', [], all, types).estimatedCategories).toEqual(['daycare']);
  });

  it('siirretty uudempi arvio päättää vanhemman kohdekategorian arvion; sama alkupäivä väistyy kokonaan', async () => {
    const older = await repo.saveEstimate('p1', daycare(), '2026-11-17', '2026-09-01');
    const moved = await repo.saveEstimate('p1', daycare({ category: 'other', label: 'Pk' }), '2026-11-17', '2026-10-01');
    await repo.changeEstimateCategory(moved.id, 'daycare');
    expect((await db.estimates.get(older.id))!.validTo).toBe('2026-09-30');
    expect(await db.estimates.get(moved.id)).toMatchObject({ category: 'daycare' });

    const same = await repo.saveEstimate('p1', daycare({ category: 'commute', label: 'X' }), '2026-11-17', '2026-10-01');
    const r = await repo.changeEstimateCategory(same.id, 'daycare');
    expect(r.dropped).toBe(true);
    expect((await db.estimates.get(same.id))!.deletedAt).toBeTruthy();
  });
});

describe('sisäänrakennettujen lajien uudelleennimeäminen (17.11.2026)', () => {
  it('vanha nimi "Liikuntapuisto (esim. Superpark)" muuttuu käynnistyksessä, muokattua nimeä ei kosketa', async () => {
    await db.activityTypes.update('t:activity_park', { name: 'Liikuntapuisto (esim. Superpark)' });
    await db.activityTypes.update('t:other', { name: 'Liikuntapuisto (esim. Superpark)', builtIn: false } as never);
    await repo.initialize();
    expect((await db.activityTypes.get('t:activity_park'))!.name).toBe('Liikuntapuisto');
    expect((await db.activityTypes.get('t:other'))!.name).toBe('Liikuntapuisto (esim. Superpark)');
  });
});

describe('tupla päiväkoti vanhoilla päivillä (17.11.2026)', () => {
  const daycare = (over: Partial<EstimateInput> = {}) => recess({ category: 'daycare', label: 'Päiväkoti', weekdayMin: 120, ...over });
  const base = { profileId: 'p1', durationMin: 120, effort: 0 as const, muscle: false, bone: false, estimateConfirmed: true };

  it('päättynyt Muu-päiväkotiarvio ja irrallinen vahvistus löytyvät ja yhdistyvät Päiväkotiin', async () => {
    const old = await repo.saveEstimate('p1', daycare({ category: 'other', label: 'Päiväkotipäivä' }), '2026-11-17', '2026-08-15');
    await db.estimates.update(old.id, { validTo: '2026-11-16' }); // vanha lopetettu, ei näy voimassa olevissa
    await repo.saveEstimate('p1', daycare(), '2026-11-17', '2026-09-01');
    const confirmed = await repo.createSession({ ...base, activityTypeId: 't:other', date: '2026-10-05', label: 'Päiväkotipäivä' });
    const stray = await repo.createSession({ ...base, activityTypeId: 't:other', date: '2026-08-10', label: 'Päiväkoti' });
    const both = await repo.createSession({ ...base, activityTypeId: 't:daycare_day', date: '2026-08-10', label: 'Päiväkoti' });
    const other = await repo.createSession({ ...base, activityTypeId: 't:other', date: '2026-11-20', label: 'Leikki' });

    expect((await repo.activeEstimates('p1', '2026-11-17')).map((e) => e.category)).toEqual(['daycare']);
    expect(dayTotals('2026-10-20', [], await repo.listEstimates('p1'), types).estimatedCategories.sort()).toEqual(['daycare', 'other']);
    const found = await repo.daycareDoubles('p1');
    expect(found.estimates.map((e) => e.id)).toEqual([old.id]);
    expect(found.sessions).toBe(2);

    const r = await repo.mergeDaycareDoubles('p1');
    expect(r).toMatchObject({ estimates: 1 });
    expect(await db.estimates.get(old.id)).toMatchObject({ category: 'daycare', validTo: '2026-08-31' });
    expect(dayTotals('2026-10-20', [], await repo.listEstimates('p1'), types).estimatedCategories).toEqual(['daycare']);
    expect((await db.sessions.get(confirmed.id))!.activityTypeId).toBe('t:daycare_day');
    expect((await db.sessions.get(stray.id))!.deletedAt).toBeTruthy();
    expect((await db.sessions.get(both.id))!.deletedAt).toBeUndefined();
    expect((await db.sessions.get(other.id))!.activityTypeId).toBe('t:other');
    expect(await repo.daycareDoubles('p1')).toEqual({ estimates: [], sessions: 0 });
  });

  it('ilman Päiväkoti-kategoriaa ei ilmoitusta', async () => {
    await repo.saveEstimate('p1', daycare({ category: 'other', label: 'Päiväkoti' }), '2026-11-17', '2026-09-01');
    expect(await repo.daycareDoubles('p1')).toEqual({ estimates: [], sessions: 0 });
  });

  it('kuvakaappauksen tilanne: tuplan "ei tänä päivänä" poistuu eikä nollaa päiväkotia; ä-kirjaimen koodaus ei haittaa', async () => {
    const nfd = 'Päiväkotipäivä'.normalize('NFD');
    await repo.saveEstimate('p1', daycare({ category: 'other', label: nfd }), '2026-11-17', '2026-09-01');
    await repo.saveEstimate('p1', daycare(), '2026-10-15');
    // 2.11.: Päiväkoti vahvistettu 120, tupla merkitty 0. 3.11.: vain tupla merkitty 0, Päiväkoti arviona.
    const dc = await repo.createSession({ ...base, activityTypeId: 't:daycare_day', date: '2026-11-02', label: 'Päiväkotipäivä' });
    const zero1 = await repo.createSession({ ...base, durationMin: 0, activityTypeId: 't:other', date: '2026-11-02', label: `${nfd}: ei tänä päivänä` });
    const zero2 = await repo.createSession({ ...base, durationMin: 0, activityTypeId: 't:other', date: '2026-11-03', label: `${nfd}: ei tänä päivänä` });
    const early = await repo.createSession({ ...base, activityTypeId: 't:other', date: '2026-09-15', label: nfd });

    expect((await repo.daycareDoubles('p1')).estimates).toHaveLength(1);
    await repo.mergeDaycareDoubles('p1');
    expect((await db.sessions.get(dc.id))!.deletedAt).toBeUndefined();
    expect((await db.sessions.get(zero1.id))!.deletedAt).toBeTruthy();
    expect((await db.sessions.get(zero2.id))!.deletedAt).toBeTruthy();
    expect((await db.sessions.get(early.id))!.activityTypeId).toBe('t:daycare_day'); // ennen tuplajaksoa: siirtyy
    const all = await repo.listEstimates('p1');
    const nov3 = dayTotals('2026-11-03', await repo.sessionsInRange('p1', '2026-11-03', '2026-11-03'), all, types);
    expect(nov3.estimatedCategories).toEqual(['daycare']);
    expect(await repo.daycareDoubles('p1')).toEqual({ estimates: [], sessions: 0 });
  });
});
