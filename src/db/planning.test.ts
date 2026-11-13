// Vaihe 3: viikkopohja, ensurePlanned, kuittaus ja ohitus. SPEC 14: B1–B3, B6, F1 (tunnisteet), F10.

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type Repositories, type TemplateItemInput } from './repositories';
import { activityTypeId, plannedSessionId, sessionIdFromPlanned } from '../domain/ids';
import { defaultPlanningThrough, farWeekPlanning, planningFrom, planningThroughForWeek, templateItemDates } from '../domain/planning';

let n = 0;
let db: AppDB;
let repo: Repositories;
const extra: AppDB[] = [];

beforeEach(async () => {
  db = new AppDB(`planning-${++n}`);
  repo = createRepositories(db);
  await repo.initialize();
});
afterEach(async () => {
  await db.delete();
  while (extra.length) await extra.pop()!.delete();
});

const TRAINING = activityTypeId('football_training');
// Ti 10.11. ja to 12.11.2026, 90 min.
const tueThu = (over: Partial<TemplateItemInput> = {}): TemplateItemInput => ({
  activityTypeId: TRAINING,
  weekdays: [2, 4],
  durationMin: 90,
  startTime: '17:30',
  validFrom: '2026-08-01',
  ...over,
});

const MON = '2026-11-09';
const WED = '2026-11-11';

describe('domain: suunnittelun rajat', () => {
  it('oletusraja on ensi viikon sunnuntai; selattava viikko enintään +8 viikkoa', () => {
    expect(defaultPlanningThrough(WED)).toBe('2026-11-22');
    expect(planningThroughForWeek(WED, '2026-12-02')).toBe('2026-12-06');
    expect(planningThroughForWeek(WED, '2027-06-01')).toBe('2027-01-10');
    expect(planningThroughForWeek(WED, '2026-10-01')).toBe('2026-11-22');
  });

  it('aloitus: ensimmäisellä ajolla tänään; muuten max(plannedThrough + 1, tänään − 14)', () => {
    expect(planningFrom(undefined, WED)).toBe(WED);
    expect(planningFrom('2026-11-15', WED)).toBe('2026-11-16');
    expect(planningFrom('2026-09-01', WED)).toBe('2026-10-28');
  });

  it('pohjarivin päivät voimassaolon ja viikonpäivien mukaan', () => {
    const item = { weekdays: [2, 4] as (2 | 4)[], validFrom: '2026-11-11', validTo: '2026-11-19' };
    expect(templateItemDates(item, MON, '2026-11-22')).toEqual(['2026-11-12', '2026-11-17', '2026-11-19']);
  });
});

describe('viikkopohjan luonti', () => {
  it('uusi rivi luo suunnitelmat tästä päivästä ensi viikon loppuun, ei menneitä', async () => {
    const item = await repo.createTemplateItem('p1', tueThu(), WED);
    const plans = await repo.plansInRange('p1', '2026-11-01', '2026-12-31');
    expect(plans.map((p) => p.date)).toEqual(['2026-11-12', '2026-11-17', '2026-11-19']);
    expect(plans[0]).toMatchObject({
      id: plannedSessionId(item.id, '2026-11-12'),
      templateItemId: item.id,
      status: 'open',
      durationMin: 90,
      startTime: '17:30',
    });
  });

  it('B1: ensurePlanned kahdesti peräkkäin ei kasvata määrää', async () => {
    await repo.createTemplateItem('p1', tueThu(), WED);
    const through = defaultPlanningThrough(WED);
    await repo.ensurePlanned('p1', through, WED);
    const count = await db.plannedSessions.count();
    expect(await repo.ensurePlanned('p1', through, WED)).toBe(0);
    expect(await db.plannedSessions.count()).toBe(count);
    expect(await repo.getPlannedThrough('p1')).toBe(through);
  });

  it('selattava tuleva viikko laajentaa suunnitelmia', async () => {
    await repo.createTemplateItem('p1', tueThu(), WED);
    await repo.ensurePlanned('p1', defaultPlanningThrough(WED), WED);
    const created = await repo.ensurePlanned('p1', planningThroughForWeek(WED, '2026-12-02'), WED);
    expect(created).toBe(4); // vkot 48–49: ti + to
    expect(await repo.getPlannedThrough('p1')).toBe('2026-12-06');
    // Taaksepäin selaaminen ei pienennä rajaa.
    await repo.ensurePlanned('p1', '2026-11-15', WED);
    expect(await repo.getPlannedThrough('p1')).toBe('2026-12-06');
  });

  it('B6: kuuden viikon tauon jälkeen enintään 14 päivää taaksepäin', async () => {
    await repo.createTemplateItem('p1', tueThu({ weekdays: [1, 2, 3, 4, 5, 6, 7] }), '2026-09-01');
    await repo.ensurePlanned('p1', defaultPlanningThrough('2026-09-01'), '2026-09-01'); // → su 13.9.
    const later = '2026-10-28'; // yli kuusi viikkoa myöhemmin
    await repo.ensurePlanned('p1', defaultPlanningThrough(later), later);
    const plans = await repo.plansInRange('p1', '2026-09-14', '2026-11-08');
    expect(plans[0].date).toBe('2026-10-14'); // 28.10. − 14 pv
    expect(plans.some((p) => p.date < '2026-10-14')).toBe(false);
  });

  it('F1: kaksi laitetta tuottaa samat tunnisteet, joten yhdistäminen ei tuplaa', async () => {
    const db2 = new AppDB(`planning-other-${n}`);
    extra.push(db2);
    const repo2 = createRepositories(db2);
    await repo2.initialize();
    const item = await repo.createTemplateItem('p1', tueThu(), WED);
    await db2.templateItems.put({ ...item }); // sama pohja synkronoituna
    await repo.ensurePlanned('p1', defaultPlanningThrough(WED), WED);
    await repo2.ensurePlanned('p1', defaultPlanningThrough(WED), WED);
    const ids1 = (await db.plannedSessions.toArray()).map((p) => p.id).sort();
    const ids2 = (await db2.plannedSessions.toArray()).map((p) => p.id).sort();
    expect(ids2).toEqual(ids1);
    expect(new Set([...ids1, ...ids2]).size).toBe(3);
  });
});

describe('pohjan muokkaus ja poisto', () => {
  async function setupWithHistory() {
    // Pohja luotu ma 2.11.; ti 3.11. kuitattu, to 5.11. avoin, ti 10.11. kuitattu.
    const item = await repo.createTemplateItem('p1', tueThu(), '2026-11-02');
    await repo.ensurePlanned('p1', defaultPlanningThrough('2026-11-02'), '2026-11-02');
    await repo.confirmPlanned(plannedSessionId(item.id, '2026-11-03'), WED);
    await repo.confirmPlanned(plannedSessionId(item.id, '2026-11-10'), WED);
    return item;
  }

  it('B2: kesto 90 → 75 keskiviikkona: menneet ja kuitatut 90, avoimet tästä päivästä 75', async () => {
    const item = await setupWithHistory();
    await repo.updateTemplateItem(item.id, tueThu({ durationMin: 75 }), WED);
    const byDate = Object.fromEntries((await repo.plansInRange('p1', '2026-11-01', '2026-11-30')).map((p) => [p.date, p]));
    expect(byDate['2026-11-03']).toMatchObject({ status: 'done', durationMin: 90 });
    expect(byDate['2026-11-05']).toMatchObject({ status: 'open', durationMin: 90 }); // mennyt avoin ei muutu
    expect(byDate['2026-11-10']).toMatchObject({ status: 'done', durationMin: 90 });
    expect(byDate['2026-11-12']).toMatchObject({ status: 'open', durationMin: 75 });
    expect(byDate['2026-11-17']).toMatchObject({ status: 'open', durationMin: 75 });
    expect((await db.sessions.get(sessionIdFromPlanned(plannedSessionId(item.id, '2026-11-03'))))!.durationMin).toBe(90);
  });

  it('viikonpäivän vaihto: tulevat avoimet poistuvat ja uudet syntyvät; poistettu ei palaa ensurePlannedissa', async () => {
    const item = await repo.createTemplateItem('p1', tueThu(), WED);
    await repo.updateTemplateItem(item.id, tueThu({ weekdays: [3, 5] }), WED);
    let open = (await repo.plansInRange('p1', WED, '2026-11-30')).map((p) => p.date);
    expect(open).toEqual(['2026-11-11', '2026-11-13', '2026-11-18', '2026-11-20']);
    await repo.ensurePlanned('p1', defaultPlanningThrough(WED), WED);
    open = (await repo.plansInRange('p1', WED, '2026-11-30')).map((p) => p.date);
    expect(open).toEqual(['2026-11-11', '2026-11-13', '2026-11-18', '2026-11-20']);
    // Palautetaan torstai: sama tunniste herätetään henkiin.
    await repo.updateTemplateItem(item.id, tueThu({ weekdays: [4] }), WED);
    open = (await repo.plansInRange('p1', WED, '2026-11-30')).map((p) => p.date);
    expect(open).toEqual(['2026-11-12', '2026-11-19']);
  });

  it('poisto: active = false, tulevat avoimet poistuvat, kuitatut ja menneet säilyvät', async () => {
    const item = await setupWithHistory();
    await repo.deleteTemplateItem(item.id, WED);
    expect((await db.templateItems.get(item.id))!.active).toBe(false);
    expect(await repo.listTemplateItems('p1')).toEqual([]);
    const plans = await repo.plansInRange('p1', '2026-11-01', '2026-11-30');
    expect(plans.map((p) => `${p.date}:${p.status}`)).toEqual(['2026-11-03:done', '2026-11-05:open', '2026-11-10:done']);
    await repo.ensurePlanned('p1', '2026-11-29', WED);
    expect(await repo.plansInRange('p1', '2026-11-11', '2026-11-30')).toEqual([]);
  });

  it('poiston kumoaminen palauttaa rivin ja tulevat kerrat, myös yksittäin muutetun', async () => {
    const item = await setupWithHistory();
    const before = await repo.plansInRange('p1', WED, '2026-11-30');
    await repo.updatePlannedOccurrence(before[0].id, { durationMin: 45 });
    const removed = await repo.deleteTemplateItem(item.id, WED);
    expect(removed.length).toBe(before.length);
    await repo.restoreTemplateItem(item.id, WED, removed);
    expect((await db.templateItems.get(item.id))!.active).toBe(true);
    const after = await repo.plansInRange('p1', WED, '2026-11-30');
    expect(after.map((p) => p.id)).toEqual(expect.arrayContaining(before.map((p) => p.id)));
    expect(after.find((p) => p.id === before[0].id)!.durationMin).toBe(45); // yksittäin muutettu säilyi
  });
});

describe('kuittaus ja ohitus', () => {
  async function onePlan() {
    const item = await repo.createTemplateItem('p1', tueThu(), '2026-11-09');
    return plannedSessionId(item.id, '2026-11-10');
  }

  it('B3: kuittaus luo kerran suunnitellulla kestolla; kerran muokkaus ei muuta suunnitelmaa; toinen kuittaus ei luo toista', async () => {
    const planId = await onePlan();
    const r = await repo.confirmPlanned(planId, WED);
    expect(r.created).toBe(true);
    expect(r.session).toMatchObject({
      id: sessionIdFromPlanned(planId),
      plannedSessionId: planId,
      durationMin: 90,
      date: '2026-11-10',
      startTime: '17:30',
      bone: true, // jalkapallo: luusto = yes
      muscle: false, // lihas = ask
    });
    expect(r.session.minutes).toEqual({ light: 32, moderate: 27, vigorous: 14 }); // 90 · 0,35/0,30/0,15 (31,5 → 32; 13,5 → 14)
    expect(await db.plannedSessions.get(planId)).toMatchObject({ status: 'done', sessionId: r.session.id, durationMin: 90 });

    await repo.updateSession(r.session.id, {
      activityTypeId: TRAINING, date: '2026-11-10', durationMin: 85, effort: 0, muscle: false, bone: true,
    });
    expect((await db.plannedSessions.get(planId))!.durationMin).toBe(90);

    const again = await repo.confirmPlanned(planId, WED);
    expect(again.created).toBe(false);
    expect(again.session.durationMin).toBe(85);
    expect(await db.sessions.count()).toBe(1);
  });

  it('kuittaus muokatulla kestolla', async () => {
    const planId = await onePlan();
    const r = await repo.confirmPlanned(planId, WED, { durationMin: 60 });
    expect(r.session.durationMin).toBe(60);
    expect((await db.plannedSessions.get(planId))!.durationMin).toBe(90);
  });

  it('tulevaa ei voi kuitata tehdyksi', async () => {
    const item = await repo.createTemplateItem('p1', tueThu(), WED);
    await expect(repo.confirmPlanned(plannedSessionId(item.id, '2026-11-12'), WED)).rejects.toThrow();
  });

  it('kerran poisto palauttaa suunnitelman; uusi kuittaus herättää saman tunnisteen henkiin', async () => {
    const planId = await onePlan();
    const r = await repo.confirmPlanned(planId, WED);
    await repo.deleteSession(r.session.id);
    expect((await db.plannedSessions.get(planId))!.status).toBe('open');
    const again = await repo.confirmPlanned(planId, WED);
    expect(again.created).toBe(true);
    expect(again.session.id).toBe(r.session.id);
    expect((await db.sessions.get(r.session.id))!.deletedAt).toBeUndefined();
    expect(await db.sessions.count()).toBe(1);
  });

  it('F10: sama suunnitelma kuitataan kahdella laitteella → sama kerran tunniste', async () => {
    const planId = await onePlan();
    const plan = (await db.plannedSessions.get(planId))!;
    const db2 = new AppDB(`planning-f10-${n}`);
    extra.push(db2);
    const repo2 = createRepositories(db2);
    await repo2.initialize();
    await db2.plannedSessions.put({ ...plan });
    const a = await repo.confirmPlanned(planId, WED);
    const b = await repo2.confirmPlanned(planId, WED);
    expect(b.session.id).toBe(a.session.id);
  });

  it('ohitus syyllä, palautus avoimeksi; kuitattua ei ohiteta', async () => {
    const planId = await onePlan();
    await repo.skipPlanned(planId, 'sick');
    expect(await db.plannedSessions.get(planId)).toMatchObject({ status: 'skipped', skipReason: 'sick' });
    await repo.skipPlanned(planId);
    expect('skipReason' in (await db.plannedSessions.get(planId))!).toBe(false);
    await repo.reopenPlanned(planId);
    expect((await db.plannedSessions.get(planId))!.status).toBe('open');
    await repo.confirmPlanned(planId, WED);
    await expect(repo.skipPlanned(planId, 'other')).rejects.toThrow();
    // Ohitetun kuittaus tehdyksi on sallittu (väärin merkitty ohitus).
  });

  it('kuittaamattomat, "merkitse loput tehdyiksi" ja kumoaminen', async () => {
    await repo.createTemplateItem('p1', tueThu({ weekdays: [1, 2, 3] }), MON);
    let pending = await repo.unconfirmedPlans('p1', WED);
    expect(pending.map((p) => p.date)).toEqual(['2026-11-09', '2026-11-10']); // ke 11.11. = tänään, ei vielä
    await repo.skipPlanned(pending[0].id, 'cancelled');
    pending = await repo.unconfirmedPlans('p1', WED);
    expect(pending).toHaveLength(1);

    const created = await repo.confirmMany(pending.map((p) => p.id), WED);
    expect(created).toHaveLength(1);
    expect(await repo.unconfirmedPlans('p1', WED)).toEqual([]);
    await repo.undoConfirm(created);
    expect((await repo.unconfirmedPlans('p1', WED)).map((p) => p.date)).toEqual(['2026-11-10']);
    expect(await repo.sessionsInRange('p1', MON, WED)).toEqual([]);
  });
});

describe('suunnitellun kerran poisto kokonaan', () => {
  it('poistettu kerta katoaa, ensurePlanned ja pohjan muokkaus eivät palauta sitä; kumoa palauttaa', async () => {
    const item = await repo.createTemplateItem('p1', tueThu(), WED);
    await repo.ensurePlanned('p1', defaultPlanningThrough(WED), WED);
    const id = plannedSessionId(item.id, '2026-11-12');
    await repo.deletePlanned(id);
    const dates = async () => (await repo.plansInRange('p1', '2026-11-09', '2026-11-22')).map((p) => p.date);
    expect(await dates()).toEqual(['2026-11-17', '2026-11-19']);
    await repo.ensurePlanned('p1', defaultPlanningThrough(WED), WED);
    await repo.updateTemplateItem(item.id, tueThu({ durationMin: 75 }), WED);
    expect(await dates()).not.toContain('2026-11-12');
    await repo.restorePlanned(id);
    expect(await dates()).toContain('2026-11-12');
  });

  it('kuitattua kertaa ei poisteta; pelikalenterin tiedot poistuvat kerran mukana', async () => {
    const item = await repo.createTemplateItem('p1', tueThu(), MON);
    await repo.ensurePlanned('p1', defaultPlanningThrough(MON), MON);
    const done = plannedSessionId(item.id, '2026-11-10');
    await repo.confirmPlanned(done, WED);
    await expect(repo.deletePlanned(done)).rejects.toThrow();
    const fx = await repo.createFixture('p1', { kind: 'game', date: '2026-11-14', durationMin: 60, opponent: 'HJK' });
    await repo.deletePlanned(fx.plan.id);
    expect(await repo.listFixtures('p1')).toEqual([]);
    expect((await db.fixtures.get(fx.plan.id))?.deletedAt).toBeTruthy();
  });
});

describe('takautuvat kerrat viikkopohjasta', () => {
  it('menneet kerrat alkupäivästä eiliseen avoimiksi; olemassa olevat ja poistetut eivät muutu; toisto ei tuplaa', async () => {
    const item = await repo.createTemplateItem('p1', tueThu({ validFrom: '2026-10-26' }), WED);
    // ilman takautusta: vain tästä päivästä eteenpäin
    expect((await repo.plansInRange('p1', '2026-10-26', '2026-11-10')).length).toBe(0);
    await repo.deletePlanned(plannedSessionId(item.id, '2026-11-12'));
    const added = await repo.backfillTemplateItem(item.id, WED);
    // ti 27.10., to 29.10., ti 3.11., to 5.11., ti 10.11.
    expect(added).toBe(5);
    const past = await repo.plansInRange('p1', '2026-10-26', '2026-11-10');
    expect(past.map((p) => [p.date, p.status])).toEqual([
      ['2026-10-27', 'open'],
      ['2026-10-29', 'open'],
      ['2026-11-03', 'open'],
      ['2026-11-05', 'open'],
      ['2026-11-10', 'open'],
    ]);
    expect(await repo.backfillTemplateItem(item.id, WED)).toBe(0);
    // kuittaamattomat menneet näkyvät läpikäynnissä
    expect((await repo.unconfirmedPlans('p1', WED)).length).toBeGreaterThanOrEqual(5);
  });

  it('enintään 12 viikkoa taaksepäin', async () => {
    const item = await repo.createTemplateItem('p1', tueThu({ validFrom: '2026-01-01' }), WED);
    await repo.backfillTemplateItem(item.id, WED);
    const all = await repo.plansInRange('p1', '2026-01-01', '2026-11-10');
    expect(all[0].date >= '2026-08-19').toBe(true);
  });
});

describe('viikkorytmi kahdella laitteella (käyttäjän havainto 13.11.2026)', () => {
  const THROUGH = '2026-12-06'; // selattu kolme viikkoa eteenpäin
  const live = async (d: AppDB) =>
    (await d.plannedSessions.toArray())
      .filter((p) => !p.deletedAt)
      .map((p) => p.date)
      .sort();

  async function other() {
    const db2 = new AppDB(`planning-sync-${n}`);
    extra.push(db2);
    const repo2 = createRepositories(db2);
    await repo2.initialize();
    return { db2, repo2 };
  }

  it('toiselta laitteelta saapunut rivi saa kerrat myös päiville, jotka tämä laite on jo käynyt läpi', async () => {
    await repo.ensurePlanned('p1', THROUGH, WED); // PC on selannut eteenpäin ennen riviä
    const { db2, repo2 } = await other();
    const item = await repo2.createTemplateItem('p1', tueThu(), WED); // puhelin: kerrat 22.11. asti
    await db.templateItems.put(item);
    await db.plannedSessions.bulkPut(await db2.plannedSessions.toArray());
    await repo.ensurePlanned('p1', THROUGH, WED);
    expect(await live(db)).toEqual(['2026-11-12', '2026-11-17', '2026-11-19', '2026-11-24', '2026-11-26', '2026-12-01', '2026-12-03']);
  });

  it('pohjamuokkaus ei poista toiselta laitteelta saapuneita kauempia kertoja; järjestelmän poistamat palaavat, käyttäjän eivät', async () => {
    const item = await repo.createTemplateItem('p1', tueThu(), WED);
    await repo.ensurePlanned('p1', THROUGH, WED);
    const { db2, repo2 } = await other();
    await db2.templateItems.put(item);
    await db2.plannedSessions.bulkPut(await db.plannedSessions.toArray());
    // Puhelin (suunniteltu vain oletusväli) muuttaa kellonajan: myös 1.12. ja 3.12. päivittyvät.
    await repo2.updateTemplateItem(item.id, tueThu({ startTime: '18:00' }), WED);
    const phone = (await db2.plannedSessions.toArray()).filter((p) => !p.deletedAt && p.date >= WED);
    expect(phone.map((p) => [p.date, p.startTime])).toEqual(expect.arrayContaining([['2026-12-01', '18:00'], ['2026-12-03', '18:00']]));
    expect(phone.length).toBe(7);

    // Vanhan version poistomerkinnät (ilman käyttäjän poistoa) herätetään; käyttäjän poistama pysyy poissa.
    for (const d of ['2026-12-01', '2026-12-03']) {
      const p = (await db.plannedSessions.get(plannedSessionId(item.id, d)))!;
      await db.plannedSessions.put({ ...p, deletedAt: p.updatedAt });
    }
    await repo.deletePlanned(plannedSessionId(item.id, '2026-11-24'));
    await repo.ensurePlanned('p1', THROUGH, WED);
    expect(await live(db)).toEqual(['2026-11-12', '2026-11-17', '2026-11-19', '2026-11-26', '2026-12-01', '2026-12-03']);
  });

  it('toisella laitteella muutettu tai poistettu rivi korjaa tulevat avoimet kerrat; kuitatut ja yksittäin muutetut säilyvät', async () => {
    const item = await repo.createTemplateItem('p1', tueThu(), '2026-11-02');
    await repo.ensurePlanned('p1', THROUGH, '2026-11-02');
    await repo.confirmPlanned(plannedSessionId(item.id, '2026-11-10'), WED);
    await repo.updatePlannedOccurrence(plannedSessionId(item.id, '2026-11-19'), { durationMin: 45 });
    const later = (ms: number) => new Date(Date.parse(item.updatedAt) + ms).toISOString();

    // Synkronoinnissa saapuu uusi versio: kesto 60 min ja vain tiistaisin.
    await db.templateItems.put({ ...item, durationMin: 60, weekdays: [2], updatedAt: later(1000) });
    await repo.ensurePlanned('p1', THROUGH, WED);
    const byDate = Object.fromEntries((await repo.plansInRange('p1', '2026-11-01', THROUGH)).map((p) => [p.date, p]));
    expect(byDate['2026-11-05']).toMatchObject({ durationMin: 90 }); // mennyt ei muutu
    expect(byDate['2026-11-10']).toMatchObject({ status: 'done', durationMin: 90 });
    expect(byDate['2026-11-12']).toBeUndefined(); // torstai poistui
    expect(byDate['2026-11-17']).toMatchObject({ status: 'open', durationMin: 60 });
    expect(byDate['2026-11-19']).toMatchObject({ durationMin: 45 }); // yksittäin muutettu säilyy
    expect(byDate['2026-11-26']).toBeUndefined();
    expect(byDate['2026-12-01']).toMatchObject({ durationMin: 60 });
    expect(await repo.ensurePlanned('p1', THROUGH, WED)).toBe(0); // idempotentti

    // Rivi poistettu toisella laitteella: tulevat avoimet pois, kuitattu säilyy.
    await db.templateItems.put({ ...item, deletedAt: later(2000), updatedAt: later(2000) });
    await repo.ensurePlanned('p1', THROUGH, WED);
    const left = (await repo.plansInRange('p1', WED, THROUGH)).map((p) => p.date);
    expect(left).toEqual(['2026-11-19']);
    expect((await db.plannedSessions.get(plannedSessionId(item.id, '2026-11-10')))!.status).toBe('done');
  });

  it('kaksi laitetta korjaa samat kerrat samoiksi tietueiksi', async () => {
    const item = await repo.createTemplateItem('p1', tueThu(), WED);
    await repo.ensurePlanned('p1', THROUGH, WED);
    const { db2, repo2 } = await other();
    await db2.plannedSessions.bulkPut(await db.plannedSessions.toArray());
    const v2 = { ...item, durationMin: 75, updatedAt: new Date(Date.parse(item.updatedAt) + 1000).toISOString() };
    await db.templateItems.put(v2);
    await db2.templateItems.put(v2);
    await repo.ensurePlanned('p1', THROUGH, WED);
    await repo2.ensurePlanned('p1', THROUGH, WED);
    const a = (await db.plannedSessions.toArray()).sort((x, y) => x.id.localeCompare(y.id));
    const b = (await db2.plannedSessions.toArray()).sort((x, y) => x.id.localeCompare(y.id));
    expect(b).toEqual(a);
  });
});

describe('kaukainen tuleva viikko (käyttäjän havainto 13.11.2026)', () => {
  it('yli +8 viikon päässä selattu viikko saa kerrat; väliin jääviä ei luoda eikä merkintä siirry', async () => {
    const item = await repo.createTemplateItem('p1', tueThu(), WED);
    await repo.ensurePlanned('p1', defaultPlanningThrough(WED), WED);
    expect(farWeekPlanning(WED, '2026-12-30')).toBeUndefined(); // +7 vko: yhtenäinen jakso riittää
    const far = farWeekPlanning(WED, '2027-01-27')!; // vk 4
    expect(far).toEqual({ from: '2027-01-25', through: '2027-01-31' });
    await repo.ensurePlanned('p1', far.through, WED, { from: far.from });
    expect((await repo.plansInRange('p1', '2027-01-25', '2027-01-31')).map((p) => p.date)).toEqual(['2027-01-26', '2027-01-28']);
    expect(await repo.plansInRange('p1', '2026-12-07', '2027-01-24')).toEqual([]);
    expect(await repo.getPlannedThrough('p1')).toBe('2026-11-22');
    expect(await repo.ensurePlanned('p1', far.through, WED, { from: far.from })).toBe(0);
    expect(item.id).toBeDefined();
  });
});
