import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type Repositories } from './repositories';
import { buildSyncFile, mergeSyncFile, toJson } from './backup';

let n = 0;
const dbs: AppDB[] = [];
async function device(name: string): Promise<{ db: AppDB; repo: Repositories; id: string }> {
  const db = new AppDB(`digest-${name}-${++n}`);
  dbs.push(db);
  const repo = createRepositories(db);
  await repo.initialize();
  return { db, repo, id: await repo.deviceId() };
}
afterEach(async () => {
  while (dbs.length) await dbs.pop()!.delete();
});
const send = async (from: { db: AppDB; id: string }, to: { db: AppDB; id: string }, role: 'pc' | 'phone') =>
  mergeSyncFile(to.db, toJson(await buildSyncFile(from.db, from.id, role)), to.id);

describe('viime viikon koosteen sulkeminen synkronoituu', () => {
  it('suljettu viikko tallentuu profiiliin, vain uudempi viikko korvaa', async () => {
    const pc = await device('pc');
    const p = await pc.repo.createProfile({ name: 'Aino', kind: 'child', birthYear: 2016, birthMonth: 5, color: '#0891b2' });
    await pc.repo.markDigestSeen(p.id, '2026-11-02');
    const after = (await pc.db.profiles.get(p.id))!;
    expect(after.digestSeenWeek).toBe('2026-11-02');
    await pc.repo.markDigestSeen(p.id, '2026-10-26'); // vanhempi viikko: ei muutosta
    expect(await pc.db.profiles.get(p.id)).toEqual(after);
  });

  it('PC:llä suljettu ei näy puhelimella; molemmilla suljettu ei ole ristiriita', async () => {
    const pc = await device('pc2');
    const phone = await device('phone2');
    const p = await pc.repo.createProfile({ name: 'Aino', kind: 'child', birthYear: 2016, birthMonth: 5, color: '#0891b2' });
    await send(pc, phone, 'pc');
    await send(phone, pc, 'phone'); // molemmat ovat synkronoineet kerran (lastSyncAt asetettu)
    await new Promise((r) => setTimeout(r, 5));
    await pc.repo.markDigestSeen(p.id, '2026-11-02');
    await new Promise((r) => setTimeout(r, 5));
    await phone.repo.markDigestSeen(p.id, '2026-11-09');
    const r = await send(phone, pc, 'phone');
    expect(r.conflicts).toEqual([]);
    expect((await pc.db.profiles.get(p.id))!.digestSeenWeek).toBe('2026-11-09');
    // Toiseen suuntaan: puhelimen versio voittaa, mutta suurempi viikko säilyy joka tapauksessa.
    const r2 = await send(pc, phone, 'pc');
    expect(r2.conflicts).toEqual([]);
    expect((await phone.db.profiles.get(p.id))!.digestSeenWeek).toBe('2026-11-09');
  });

  it('todellinen profiilin muutos molemmilla on edelleen ristiriita', async () => {
    const pc = await device('pc3');
    const phone = await device('phone3');
    const p = await pc.repo.createProfile({ name: 'Aino', kind: 'child', birthYear: 2016, birthMonth: 5, color: '#0891b2' });
    await send(pc, phone, 'pc');
    await send(phone, pc, 'phone');
    await new Promise((r) => setTimeout(r, 5));
    await pc.repo.updateProfile(p.id, { name: 'Aino K' });
    await new Promise((r) => setTimeout(r, 5));
    await phone.repo.markDigestSeen(p.id, '2026-11-09');
    const r = await send(phone, pc, 'phone');
    expect(r.conflicts).toHaveLength(1);
  });
});
