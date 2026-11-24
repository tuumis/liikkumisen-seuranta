import 'fake-indexeddb/auto';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { AppDB, db } from '../../db/schema';
import { createRepositories, repo } from '../../db/repositories';
import { buildSyncFile, toJson } from '../../db/backup';
import { isSyncCopyName } from '../../domain/version';
import { exclusive, mergeFromFolder, syncStage, SyncTimeoutError, withTimeout } from './useSync';

/** Muistissa toimiva pilvikansio (File System Access API:n osajoukko). */
function fakeFolder(files: Record<string, { text: string; lastModified: number }>, opened: string[] = []) {
  const file = (name: string) => {
    opened.push(name);
    // Pilvikansion paikkamerkki, joka ei koskaan lataudu (vain muut kuin synkronoinnin tiedostot).
    if (name.startsWith('muistiinpanot')) return new Promise<File>(() => undefined);
    return new File([files[name].text], name, { lastModified: files[name].lastModified });
  };
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
    const opened: string[] = [];
    const summary = await mergeFromFolder(fakeFolder(files, opened), pcId);
    // Muita tiedostoja ei avata (24.11.2026: pilvikansion lataamaton tiedosto jumitti synkronoinnin).
    expect(opened).not.toContain('muistiinpanot.json');
    expect(summary?.added).toBeGreaterThan(0);
    expect((await repo.listProfiles()).map((x) => x.name)).toEqual(['Aino']);
    expect(Object.keys(files).sort()).toEqual(['liikkuminen 4.json', 'muistiinpanot.json']);
    // Toinen kierros: ei mitään yhdistettävää.
    expect(await mergeFromFolder(fakeFolder(files), pcId)).toBeUndefined();
  });
});

describe('jumiin jäävä kansio', () => {
  it('aikaraja keskeyttää vaiheen selkeällä viestillä', async () => {
    vi.useFakeTimers();
    try {
      const p = withTimeout(new Promise<never>(() => undefined), 'kopiotiedostojen haku', 30_000);
      expect(syncStage()).toBe('kopiotiedostojen haku');
      const check = expect(p).rejects.toBeInstanceOf(SyncTimeoutError);
      const msg = expect(p).rejects.toThrow('Synkronointi keskeytyi vaiheessa "kopiotiedostojen haku": ei valmistunut 30 sekunnissa.');
      await vi.advanceTimersByTimeAsync(30_000);
      await check;
      await msg;
      await expect(withTimeout(Promise.resolve(5), 'x')).resolves.toBe(5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('yksi synkronointi kerrallaan; epäonnistunut ei estä seuraavaa', async () => {
    const log: string[] = [];
    let release!: () => void;
    const first = exclusive(() => new Promise<void>((r) => (release = () => (log.push('1'), r()))));
    const failing = exclusive(async () => {
      log.push('2');
      throw new Error('virhe');
    });
    const third = exclusive(async () => log.push('3'));
    await Promise.resolve();
    expect(log).toEqual([]);
    release();
    await first;
    await expect(failing).rejects.toThrow('virhe');
    await third;
    expect(log).toEqual(['1', '2', '3']);
  });

  it('kokonaisaikaraja vapauttaa jonon ja kertoo jumiin jääneen vaiheen', async () => {
    vi.useFakeTimers();
    try {
      const stuck = exclusive(async () => {
        await withTimeout(Promise.resolve(), 'liikkuminen.json avaus');
        withTimeout(Promise.resolve(), 'tiedoston kokoaminen');
        return new Promise<never>(() => undefined); // esim. laitteen tietokanta ei vastaa
      }, 60_000);
      const next = exclusive(async () => 'valmis');
      const check = expect(stuck).rejects.toThrow('Synkronointi keskeytyi vaiheessa "tiedoston kokoaminen": synkronointi ei valmistunut 60 sekunnissa.');
      await vi.advanceTimersByTimeAsync(60_000);
      await check;
      await expect(next).resolves.toBe('valmis');
      await vi.advanceTimersByTimeAsync(0);
      expect(syncStage()).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('jumittuva kansion luettelointi keskeyttää synkronoinnin (ei jatketa muihin kansiovaiheisiin)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const handle = {
        getFileHandle: async () => {
          throw new DOMException('ei löydy', 'NotFoundError');
        },
        values: () => ({ [Symbol.asyncIterator]: () => ({ next: () => new Promise<never>(() => undefined) }) }),
      } as unknown as FileSystemDirectoryHandle;
      const p = mergeFromFolder(handle, 'pc');
      const check = expect(p).rejects.toThrow('vaiheessa "kopiotiedostojen haku"');
      // Tietokannan haut ennen luettelointia käyttävät oikeita ajastimia (vain setTimeout on valeaikaa).
      await vi.waitFor(() => expect(syncStage()).toBe('kopiotiedostojen haku'));
      await vi.advanceTimersByTimeAsync(30_000);
      await check;
    } finally {
      vi.useRealTimers();
    }
  });
});
