// Äänet (SPEC 16): oma kirjaus ja kuittaus merkitään tuoreeksi; synkronoinnin yhdistäminen ei.

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type Repositories } from './repositories';
import { msSinceLocalChange } from './localChange';
import { activityTypeId } from '../domain/ids';
import { buildSyncFile, mergeSyncFile, toJson } from './backup';

let n = 0;
let db: AppDB;
let repo: Repositories;
beforeEach(async () => {
  db = new AppDB(`local-change-${++n}`);
  repo = createRepositories(db);
  await repo.initialize();
});
afterEach(async () => {
  vi.useRealTimers();
  await db.delete();
});

const TRAINING = activityTypeId('football_training');

describe('oma toiminta (äänet)', () => {
  it('kuittaus ja kirjaus päivittävät, synkronoinnin yhdistäminen ei', async () => {
    const p = await repo.createProfile({ name: 'Aino', kind: 'child', birthYear: 2016, birthMonth: 5, color: '#0891b2', trackingStart: '2026-09-01' });
    const plan = await repo.createPlannedOnce(p.id, { activityTypeId: TRAINING, date: '2026-11-12', durationMin: 60 });
    vi.useFakeTimers({ now: Date.now() + 60_000, toFake: ['Date'] });
    expect(msSinceLocalChange()).toBeGreaterThan(30_000);
    await repo.confirmPlanned(plan.id, '2026-11-13');
    expect(msSinceLocalChange()).toBeLessThan(1000);

    vi.setSystemTime(Date.now() + 60_000);
    await repo.createSession({ profileId: p.id, activityTypeId: TRAINING, date: '2026-11-13', durationMin: 30, effort: 0, muscle: false, bone: false });
    expect(msSinceLocalChange()).toBeLessThan(1000);

    const other = new AppDB(`local-change-other-${n}`);
    try {
      const repo2 = createRepositories(other);
      await repo2.initialize();
      const text = toJson(await buildSyncFile(db, await repo.deviceId(), 'pc'));
      vi.setSystemTime(Date.now() + 60_000);
      await mergeSyncFile(other, text, await repo2.deviceId());
      expect(msSinceLocalChange()).toBeGreaterThan(30_000);
    } finally {
      await other.delete();
    }
  });
});
