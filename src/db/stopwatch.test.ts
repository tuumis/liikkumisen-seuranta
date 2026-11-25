// Sekuntikello (25.11.2026): laitekohtaiset kellot ja kerran tarkka aika.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type Repositories } from './repositories';
import { buildBackup } from './backup';
import { activityTypeId } from '../domain/ids';
import { newStopwatch } from '../domain/stopwatch';

let n = 0;
let db: AppDB;
let repo: Repositories;
beforeEach(async () => {
  db = new AppDB(`stopwatch-${++n}`);
  repo = createRepositories(db);
  await repo.initialize();
});
afterEach(async () => {
  await db.delete();
});

const T = (k: string) => activityTypeId(k);
const base = { activityTypeId: T('trampoline'), date: '2026-11-25', effort: 0 as const, muscle: false, bone: false };

describe('sekuntikello', () => {
  it('yksi kello profiilia kohden; poisto koskee vain omaa', async () => {
    const at = new Date(2026, 10, 25, 17, 5);
    await repo.saveStopwatch(newStopwatch('a', undefined, at));
    await repo.saveStopwatch(newStopwatch('b', T('trampoline'), at));
    await repo.saveStopwatch({ ...newStopwatch('a', undefined, at), pausedAt: at.getTime() + 1000 });
    expect((await repo.listStopwatches()).map((x) => x.profileId).sort()).toEqual(['a', 'b']);
    await repo.removeStopwatch('a');
    expect((await repo.listStopwatches()).map((x) => x.profileId)).toEqual(['b']);
  });

  it('kello ei päädy varmuuskopioon', async () => {
    await repo.saveStopwatch(newStopwatch('a', undefined, new Date()));
    const file = await buildBackup(db);
    expect((file.data.meta ?? []).some((m) => m.key === 'stopwatches')).toBe(false);
  });

  it('tarkka aika tallentuu, kun kesto on sen pyöristys; käsin muutettu kesto poistaa sen', async () => {
    const p = await repo.createProfile({ name: 'Eino', kind: 'child', birthYear: 2021, birthMonth: 3, color: '#0891b2' });
    const s = await repo.createSession({ ...base, profileId: p.id, durationMin: 48, timedSec: 47 * 60 + 32, startTime: '17:05' });
    expect(s.timedSec).toBe(2852);
    expect(s.startTime).toBe('17:05');
    const other = await repo.createSession({ ...base, profileId: p.id, durationMin: 60, timedSec: 47 * 60 + 32 });
    expect(other.timedSec).toBeUndefined();
    const kept = await repo.updateSession(s.id, { ...base, durationMin: 48, startTime: '17:05', note: 'hyvä' });
    expect(kept.timedSec).toBe(2852);
    const changed = await repo.updateSession(s.id, { ...base, durationMin: 50 });
    expect(changed.timedSec).toBeUndefined();
  });

  it('suunnitellun kerran kuittaus kellotetulla ajalla ja todellisella alkamisajalla (vaihe 2)', async () => {
    const p = await repo.createProfile({ name: 'Aino', kind: 'child', birthYear: 2016, birthMonth: 5, color: '#0891b2' });
    const plan = await repo.createPlannedOnce(p.id, { activityTypeId: 't:swimming', date: '2026-11-25', durationMin: 45, startTime: '17:00' });
    const r = await repo.confirmPlanned(plan.id, '2026-11-25', { durationMin: 52, timedSec: 51 * 60 + 40, startTime: '17:08' });
    expect(r.created).toBe(true);
    expect(r.session).toMatchObject({ durationMin: 52, timedSec: 3100, startTime: '17:08', plannedSessionId: plan.id });
    // Tavallinen kuittaus ilman kelloa: suunniteltu alkamisaika, ei tarkkaa aikaa.
    const plan2 = await repo.createPlannedOnce(p.id, { activityTypeId: 't:swimming', date: '2026-11-24', durationMin: 45, startTime: '17:00' });
    const r2 = await repo.confirmPlanned(plan2.id, '2026-11-25');
    expect(r2.session.startTime).toBe('17:00');
    expect(r2.session.timedSec).toBeUndefined();
  });
});
