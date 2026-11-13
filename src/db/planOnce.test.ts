import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories } from './repositories';

const dbs: AppDB[] = [];
afterEach(async () => {
  while (dbs.length) await dbs.pop()!.delete();
});

describe('yksittäinen suunniteltu kerta tulevalle päivälle', () => {
  it('näkyy suunnitelmana, säilyy suunnitelmien luonnissa ja kuitataan vasta päivänä', async () => {
    const db = new AppDB('plan-once');
    dbs.push(db);
    const repo = createRepositories(db);
    await repo.initialize();
    const p = await repo.createProfile({ name: 'Aino', kind: 'child', birthYear: 2016, birthMonth: 5, color: '#0891b2' });
    const plan = await repo.createPlannedOnce(p.id, { activityTypeId: 't:swimming', date: '2026-11-20', durationMin: 45, startTime: '17:00', label: '  Uintikoulu ' });
    expect(plan).toMatchObject({ status: 'open', date: '2026-11-20', durationMin: 45, startTime: '17:00', label: 'Uintikoulu' });
    expect(plan.templateItemId).toBeUndefined();
    await repo.ensurePlanned(p.id, '2026-11-29', '2026-11-13');
    const plans = await repo.plansInRange(p.id, '2026-11-16', '2026-11-22');
    expect(plans.filter((x) => !x.deletedAt).map((x) => x.id)).toContain(plan.id);
    await expect(repo.confirmPlanned(plan.id, '2026-11-13')).rejects.toThrow(/Tulevaa/);
    const r = await repo.confirmPlanned(plan.id, '2026-11-20');
    expect(r.session).toMatchObject({ date: '2026-11-20', durationMin: 45, activityTypeId: 't:swimming' });
    await expect(repo.createPlannedOnce(p.id, { activityTypeId: 't:swimming', date: '2026-11-21', durationMin: 0 })).rejects.toThrow();
  });
});
