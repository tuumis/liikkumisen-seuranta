// Arkiliikunnan vahvistus sellaisenaan ei muuta päivän tehoja (tarkastuksen havainto 2, 17.11.2026).
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type Repositories } from './repositories';
import { dayTotals } from '../domain/aggregate';
import { activityTypeId } from '../domain/ids';
import { BUILT_IN_ACTIVITY_TYPES } from '../seed/activityTypes';

let n = 0;
let db: AppDB;
let repo: Repositories;
beforeEach(async () => {
  db = new AppDB(`confirmations-${++n}`);
  repo = createRepositories(db);
  await repo.initialize();
});
afterEach(async () => {
  await db.delete();
});

const types = new Map(BUILT_IN_ACTIVITY_TYPES.map((t) => [t.id, t]));
const DAY = '2026-11-10';
// Pyöräillen kuljettu koulumatka: eri profiili kuin kategorian oletuslajilla.
const shares = { light: 0.2, moderate: 0.6, vigorous: 0.15 };

async function setup() {
  await repo.saveEstimate('p1', { category: 'commute', label: 'Koulumatkat', weekdayMin: 40, weekendMin: 0, shares }, '2026-11-01');
  return repo.listEstimates('p1');
}

describe('vahvistus arvion tehoprofiililla', () => {
  it('vahvistus sellaisenaan: reipas ja rasittava pysyy samana; muokkaus säilyttää profiilin', async () => {
    const estimates = await setup();
    const before = dayTotals(DAY, [], estimates, types);
    const s = await repo.createSession({
      profileId: 'p1',
      activityTypeId: activityTypeId('commute_walk'),
      date: DAY,
      durationMin: 40,
      effort: 0,
      muscle: false,
      bone: false,
      label: 'Koulumatkat',
      estimateConfirmed: true,
      shares,
    });
    const after = dayTotals(DAY, await repo.sessionsInRange('p1', DAY, DAY), estimates, types);
    expect(after.mvpaCombined).toBe(before.mvpaCombined);
    expect(after.mvpa).toBe(before.mvpaCombined);
    const edited = await repo.updateSession(s.id, { activityTypeId: s.activityTypeId, date: DAY, durationMin: 20, effort: 0, muscle: false, bone: false, label: s.label });
    expect(edited.minutes).toEqual({ light: 4, moderate: 12, vigorous: 3 });
    // "Laske uudelleen" lajin profiililla ei koske vahvistusta.
    expect(await repo.recalculateSessions(s.activityTypeId, '2026-01-01')).toBe(0);
  });

  it('aiemmat vahvistukset korjataan kerran arvion profiilille', async () => {
    const estimates = await setup();
    const old = await repo.createSession({ profileId: 'p1', activityTypeId: activityTypeId('commute_walk'), date: DAY, durationMin: 40, effort: 0, muscle: false, bone: false, label: 'Koulumatkat', estimateConfirmed: true });
    const expected = dayTotals(DAY, [], estimates, types).estimate;
    expect(old.minutes).not.toEqual(expected);
    await db.meta.delete('confirmationSharesAligned');
    await repo.initialize();
    expect((await db.sessions.get(old.id))!.minutes).toEqual(expected);
  });
});
