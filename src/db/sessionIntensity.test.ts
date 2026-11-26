// Kerran teho jälkikäteen (27.11.2026): jalkapallon lisätiedoista pikakuittauksen jälkeen.
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories } from './repositories';

let n = 0;
const dbs: AppDB[] = [];
afterEach(async () => {
  while (dbs.length) await dbs.pop()!.delete();
});

describe('setSessionIntensity', () => {
  it('vaihtaa tehon ja laskee minuutit uudelleen; muut tiedot säilyvät', async () => {
    const db = new AppDB(`intensity-${++n}`);
    dbs.push(db);
    const repo = createRepositories(db);
    await repo.initialize();
    const p = await repo.createProfile({ name: 'Lapsi', kind: 'child', birthYear: 2017, birthMonth: 5, color: '#0891b2' });
    const s = await repo.createSession({ profileId: p.id, activityTypeId: 't:football_training', date: '2026-11-25', startTime: '17:30', durationMin: 60, effort: 0, muscle: false, bone: false, label: 'Talenttitreeni' });
    const hard = await repo.setSessionIntensity(s.id, 'vigorous');
    expect(hard).toMatchObject({ intensityPreset: 'vigorous', startTime: '17:30', label: 'Talenttitreeni', durationMin: 60 });
    expect(hard.minutes.vigorous).toBeGreaterThan(s.minutes.vigorous);
    const back = await repo.setSessionIntensity(s.id, undefined);
    expect(back.intensityPreset).toBeUndefined();
    expect(back.minutes).toEqual(s.minutes);
  });
});
