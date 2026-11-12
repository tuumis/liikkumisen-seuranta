// Vaihe 3: viikkopohja, ensurePlanned, kuittaus ja ohitus. SPEC 14: B1–B3, B6, F1 (tunnisteet), F10.

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type Repositories, type TemplateItemInput } from './repositories';
import { activityTypeId, plannedSessionId, sessionIdFromPlanned } from '../domain/ids';
import { defaultPlanningThrough, planningFrom, planningThroughForWeek, templateItemDates } from '../domain/planning';

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
