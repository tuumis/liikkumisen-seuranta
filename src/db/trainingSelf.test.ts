// Treenin omatoiminen alku- ja loppuverryttely (17.11.2026): linkitetty "Jalkapallo – omatoiminen" -kerta.

import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type Repositories } from './repositories';
import { foldTrainingSelves, footballPeriodSummary, trainingSelfStart } from '../domain/football';
import { sessionSchema, templateItemSchema } from '../domain/schemas';
import { BUILT_IN_ACTIVITY_TYPES } from '../seed/activityTypes';

let n = 0;
const dbs: AppDB[] = [];
async function device(name: string): Promise<{ db: AppDB; repo: Repositories }> {
  const db = new AppDB(`self-${name}-${++n}`);
  dbs.push(db);
  const repo = createRepositories(db);
  await repo.initialize();
  return { db, repo };
}
afterEach(async () => {
  while (dbs.length) await dbs.pop()!.delete();
});

const TODAY = '2026-11-12';
const TRAINING = 't:football_training';

async function setup(self?: { selfBeforeMin?: number; selfAfterMin?: number }) {
  const d = await device('x');
  const item = await d.repo.createTemplateItem('p1', { activityTypeId: TRAINING, weekdays: [2, 4], startTime: '17:00', durationMin: 90, validFrom: '2026-11-02', ...self }, TODAY);
  await d.repo.backfillTemplateItem(item.id, TODAY);
  return { ...d, item, planId: `p:${item.id}:2026-11-10` };
}

describe('omatoiminen verryttely', () => {
  it('aloitusaika: treenin alku − ennen, tai treenin loppu', () => {
    expect(trainingSelfStart('17:00', 90, 10)).toBe('16:50');
    expect(trainingSelfStart('17:00', 90, 0)).toBe('18:30');
    expect(trainingSelfStart(undefined, 90, 10)).toBeUndefined();
    expect(trainingSelfStart('00:05', 60, 10)).toBeUndefined();
  });

  it('viikkorytmin oletus luo kuitatessa linkitetyn kerran', async () => {
    const { db, repo, item, planId } = await setup({ selfBeforeMin: 10, selfAfterMin: 5 });
    expect(item).toMatchObject({ selfBeforeMin: 10, selfAfterMin: 5 });
    expect(templateItemSchema.safeParse(item).success).toBe(true);
    const { session } = await repo.confirmPlanned(planId, TODAY);
    const c = (await db.sessions.get(`w:${session.id}`))!;
    expect(c).toMatchObject({
      activityTypeId: 't:football_self',
      date: '2026-11-10',
      startTime: '16:50',
      durationMin: 15,
      linkedTo: session.id,
      selfBeforeMin: 10,
      selfAfterMin: 5,
      label: 'Alku- ja loppuverryttely',
      effort: 0,
    });
    expect(c.minutes.moderate).toBeGreaterThan(0); // lajin oma tehoprofiili
    expect(c.plannedSessionId).toBeUndefined();
    expect(sessionSchema.safeParse(c).success).toBe(true);
    // Treeni itse ei muutu.
    expect(session.durationMin).toBe(90);
    // Toinen kuittaus ei luo uutta.
    await repo.confirmPlanned(planId, TODAY);
    expect((await db.sessions.toArray()).filter((s) => s.linkedTo)).toHaveLength(1);
  });

  it('ilman oletusta ei kerran viereen tule mitään; kertaan voi lisätä, muuttaa ja poistaa', async () => {
    const { db, repo, planId } = await setup();
    const { session } = await repo.confirmPlanned(planId, TODAY);
    expect(await db.sessions.get(`w:${session.id}`)).toBeUndefined();
    expect(await repo.getTrainingSelf(session.id)).toEqual({ before: 0, after: 0 });

    await repo.setTrainingSelf(session.id, { before: 0, after: 20 });
    expect(await db.sessions.get(`w:${session.id}`)).toMatchObject({ startTime: '18:30', durationMin: 20, label: 'Loppuverryttely', selfAfterMin: 20 });
    expect((await db.sessions.get(`w:${session.id}`))!.selfBeforeMin).toBeUndefined();

    await repo.setTrainingSelf(session.id, { before: 15, after: 0 });
    expect(await repo.getTrainingSelf(session.id)).toEqual({ before: 15, after: 0 });
    expect(await db.sessions.get(`w:${session.id}`)).toMatchObject({ startTime: '16:45', label: 'Alkuverryttely' });

    await repo.setTrainingSelf(session.id, { before: 0, after: 0 });
    expect((await db.sessions.get(`w:${session.id}`))!.deletedAt).toBeDefined();
    // Uudelleen lisäys herättää saman tunnisteen henkiin.
    await repo.setTrainingSelf(session.id, { before: 5, after: 5 });
    expect((await db.sessions.get(`w:${session.id}`))!.deletedAt).toBeUndefined();
    // Vain seuran treeniin.
    const own = await repo.createSession({ profileId: 'p1', activityTypeId: 't:football_self', date: TODAY, durationMin: 30, effort: 0, muscle: false, bone: true });
    await expect(repo.setTrainingSelf(own.id, { before: 5, after: 0 })).rejects.toThrow();
  });

  it('seuraa treenin päivää ja aikaa; poisto ja kumoaminen koskevat molempia', async () => {
    const { db, repo, planId } = await setup({ selfBeforeMin: 10 });
    const { session } = await repo.confirmPlanned(planId, TODAY);
    await repo.updateSession(session.id, { activityTypeId: TRAINING, date: '2026-11-11', startTime: '18:00', durationMin: 75, effort: 0, muscle: false, bone: true });
    expect(await db.sessions.get(`w:${session.id}`)).toMatchObject({ date: '2026-11-11', startTime: '17:50', durationMin: 10 });

    const undo = await repo.deleteSession(session.id);
    expect(undo.companion?.id).toBe(`w:${session.id}`);
    expect((await db.sessions.get(`w:${session.id}`))!.deletedAt).toBeDefined();
    await repo.undoDelete(undo);
    expect((await db.sessions.get(`w:${session.id}`))!.deletedAt).toBeUndefined();
    expect((await db.sessions.get(session.id))!.deletedAt).toBeUndefined();

    // Kuittauksen kumoaminen poistaa myös verryttelyn.
    await repo.undoConfirm([session.id]);
    expect((await db.sessions.get(`w:${session.id}`))!.deletedAt).toBeDefined();
  });

  it('verryttelyn kesto muokattuna suoraan jakautuu ennen/jälkeen-osiin', async () => {
    const { db, repo, planId } = await setup({ selfBeforeMin: 10, selfAfterMin: 5 });
    const { session } = await repo.confirmPlanned(planId, TODAY);
    const c = (await db.sessions.get(`w:${session.id}`))!;
    await repo.updateSession(c.id, { activityTypeId: c.activityTypeId, date: c.date, startTime: c.startTime, durationMin: 25, effort: 0, muscle: false, bone: true });
    expect(await repo.getTrainingSelf(session.id)).toEqual({ before: 10, after: 15 });
    await repo.updateSession(c.id, { activityTypeId: c.activityTypeId, date: c.date, startTime: c.startTime, durationMin: 8, effort: 0, muscle: false, bone: true });
    expect(await repo.getTrainingSelf(session.id)).toEqual({ before: 8, after: 0 });
  });

  it('menneiden treenien täydennys valitusta päivästä ja kumoaminen', async () => {
    const { db, repo, item } = await setup();
    const ids = [];
    for (const d of ['2026-11-03', '2026-11-05', '2026-11-10']) ids.push((await repo.confirmPlanned(`p:${item.id}:${d}`, TODAY)).session.id);
    const loose = await repo.createSession({ profileId: 'p1', activityTypeId: TRAINING, date: '2026-11-08', durationMin: 60, effort: 0, muscle: false, bone: true });
    await repo.createSession({ profileId: 'p1', activityTypeId: 't:football_game', date: '2026-11-09', durationMin: 60, effort: 0, muscle: false, bone: true });
    await repo.setTrainingSelf(ids[2], { before: 20, after: 0 });

    const cand = await repo.trainingsWithoutSelf('p1', '2026-11-05', TODAY);
    expect(cand.map((s) => s.date)).toEqual(['2026-11-05', '2026-11-08']);
    const added = await repo.addTrainingSelfFrom('p1', '2026-11-05', TODAY, { before: 10, after: 5 });
    expect(added.sort()).toEqual([`w:${ids[1]}`, `w:${loose.id}`].sort());
    expect(await repo.getTrainingSelf(ids[2])).toEqual({ before: 20, after: 0 }); // olemassa oleva ei muutu
    expect(await repo.getTrainingSelf(ids[0])).toEqual({ before: 0, after: 0 }); // ennen alkupäivää
    expect(await repo.trainingsWithoutSelf('p1', '2026-11-05', TODAY)).toEqual([]);

    // Treenimäärä ei kasva verryttelyistä.
    const types = new Map(BUILT_IN_ACTIVITY_TYPES.map((t) => [t.id, t]));
    const sessions = (await db.sessions.toArray()).filter((s) => !s.deletedAt);
    const sum = footballPeriodSummary({ sessions, details: new Map(), types, planned: [], today: TODAY }, { start: '2026-11-01', end: '2026-11-30' } as never);
    expect(sum.training.count).toBe(4);
    expect(sum.sessions).toBe(5);

    await repo.removeTrainingSelves(added);
    expect(await repo.trainingsWithoutSelf('p1', '2026-11-05', TODAY)).toHaveLength(2);
    expect(await repo.addTrainingSelfFrom('p1', '2026-11-05', TODAY, { before: 0, after: 0 })).toEqual([]);
  });
});

describe('verryttely treenin rivillä (17.11.2026)', () => {
  it('verryttely pois listasta, kun treeni on samassa listassa; orpo jää näkyviin', () => {
    const list = [{ id: 'a' }, { id: 'w:a', linkedTo: 'a' }, { id: 'b' }, { id: 'w:x', linkedTo: 'x' }];
    const f = foldTrainingSelves(list);
    expect(f.rows.map((s) => s.id)).toEqual(['a', 'b', 'w:x']);
    expect(f.selfOf('a')?.id).toBe('w:a');
    expect(f.selfOf('b')).toBeUndefined();
  });
});
