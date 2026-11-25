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
});
