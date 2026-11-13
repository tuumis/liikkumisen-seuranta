import 'fake-indexeddb/auto';
import { afterAll, describe, expect, it } from 'vitest';
import { AppDB, db } from '../../db/schema';
import { createRepositories, repo } from '../../db/repositories';
import { buildSyncFile, toJson } from '../../db/backup';
import { isSyncCopyName } from '../../domain/version';
import { mergeFromFolder } from './useSync';

/** Muistissa toimiva pilvikansio (File System Access API:n osajoukko). */
function fakeFolder(files: Record<string, { text: string; lastModified: number }>) {
  const file = (name: string) => new File([files[name].text], name, { lastModified: files[name].lastModified });
  const handle = {
    async getFileHandle(name: string) {
      if (!files[name]) throw new DOMException('ei löydy', 'NotFoundError');
      return { kind: 'file', name, getFile: async () => file(name) };
    },
    async *values() {
      for (const name of Object.keys(files)) yield { kind: 'file', name, getFile: async () => file(name) };
    },
    async removeEntry(name: string) {
      if (!files[name]) throw new DOMException('ei löydy', 'NotFoundError');
      delete files[name];
    },
  };
  return handle as unknown as FileSystemDirectoryHandle;
}

const phoneDb = new AppDB('folder-phone');
afterAll(async () => {
  await phoneDb.delete();
  await db.delete();
});

describe('kopiotiedostot pilvikansiossa', () => {
  it('nimet: iPhonen "liikkuminen 2.json" ja selaimen "liikkuminen (1).json", ei vanhoja nimiä', () => {
    for (const n of ['liikkuminen 2.json', 'liikkuminen 12.json', 'liikkuminen (1).json', 'Liikkuminen-3.json']) expect(isSyncCopyName(n)).toBe(true);
    for (const n of ['liikkuminen.json', 'liikkuminen-pc.json', 'liikkuminen-puhelin.json', 'liikkumisseuranta-backup-2026-11-13.json', 'liikkuminen 2.csv']) expect(isSyncCopyName(n)).toBe(false);
  });

  it('PC yhdistää puhelimen kopion ja poistaa sen; muut tiedostot jäävät', async () => {
    await repo.initialize();
    const pcId = await repo.deviceId();
    const phone = createRepositories(phoneDb);
    await phone.initialize();
    const p = await phone.createProfile({ name: 'Aino', kind: 'child', birthYear: 2016, birthMonth: 5, color: '#0891b2' });
    await phone.createSession({ profileId: p.id, activityTypeId: 't:commute_walk', date: '2026-11-12', durationMin: 25, effort: 0, muscle: false, bone: false });
    const phoneFile = toJson(await buildSyncFile(phoneDb, await phone.deviceId(), 'phone'));
    const ownFile = toJson(await buildSyncFile(db, pcId, 'pc'));
    const files = {
      'liikkuminen 2.json': { text: phoneFile, lastModified: 2000 },
      'liikkuminen 3.json': { text: ownFile, lastModified: 1000 },
      'liikkuminen 4.json': { text: 'ei json', lastModified: 3000 },
      'muistiinpanot.json': { text: phoneFile, lastModified: 4000 },
    };
    const summary = await mergeFromFolder(fakeFolder(files), pcId);
    expect(summary?.added).toBeGreaterThan(0);
    expect((await repo.listProfiles()).map((x) => x.name)).toEqual(['Aino']);
    expect(Object.keys(files).sort()).toEqual(['liikkuminen 4.json', 'muistiinpanot.json']);
    // Toinen kierros: ei mitään yhdistettävää.
    expect(await mergeFromFolder(fakeFolder(files), pcId)).toBeUndefined();
  });
});
