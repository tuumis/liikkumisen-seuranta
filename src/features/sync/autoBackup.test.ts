import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { autoBackupDue, autoBackupName, backupsToRemove, runAutoBackup } from './autoBackup';
import { repo } from '../../db/repositories';

/** Muistinvarainen kansio File System Access -rajapinnan osajoukolla. */
function fakeFolder() {
  const files = new Map<string, string>();
  const dir = {
    files,
    async getFileHandle(name: string) {
      return {
        async createWritable() {
          let buf = '';
          return { write: async (t: string) => void (buf += t), close: async () => void files.set(name, buf) };
        },
      };
    },
    async removeEntry(name: string) {
      files.delete(name);
    },
    async *keys() {
      yield* files.keys();
    },
  };
  const root = { async getDirectoryHandle(n: string) { expect(n).toBe('varmuuskopiot'); return dir; } };
  return { root: root as unknown as FileSystemDirectoryHandle, dir };
}

describe('automaattinen varmuuskopio', () => {
  it('ajankohtainen kerran viikossa', () => {
    const now = new Date('2026-11-13T12:00:00Z');
    expect(autoBackupDue(undefined, now)).toBe(true);
    expect(autoBackupDue('2026-11-07T12:00:01Z', now)).toBe(false);
    expect(autoBackupDue('2026-11-06T12:00:00Z', now)).toBe(true);
  });
  it('8 uusinta säilyy, muihin tiedostoihin ei kosketa', () => {
    const names = Array.from({ length: 10 }, (_, i) => autoBackupName(`2026-0${Math.floor(i / 9) + 1}-${String((i % 9) + 1).padStart(2, '0')}`));
    const remove = backupsToRemove([...names, 'oma-tiedosto.json', 'liikkumisseuranta-varmuuskopio-2025-01-01 (1).json']);
    expect(remove).toEqual([names[0], names[1]]);
    expect(backupsToRemove(names.slice(0, 3))).toEqual([]);
  });
  it('kirjoittaa varmuuskopion, poistaa vanhimmat ja ei toista viikon sisällä', async () => {
    await repo.initialize();
    const { root, dir } = fakeFolder();
    for (let d = 1; d <= 8; d++) dir.files.set(autoBackupName(`2026-10-0${d}`), '{}');
    const name = await runAutoBackup(root, new Date('2026-11-13T12:00:00Z'));
    expect(name).toBe('liikkumisseuranta-varmuuskopio-2026-11-13.json');
    expect(dir.files.size).toBe(8);
    expect(dir.files.has(autoBackupName('2026-10-01'))).toBe(false);
    expect(JSON.parse(dir.files.get(name!)!).format).toBe('liikkumisseuranta-backup');
    expect(await repo.getMeta('lastExportAt')).toBeDefined();
    expect(await runAutoBackup(root, new Date())).toBeNull();
  });
});
