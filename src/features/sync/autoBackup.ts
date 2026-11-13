// PC:n automaattinen varmuuskopio (SPEC 16): kerran viikossa synkronointikansion alikansioon
// "varmuuskopiot", 8 uusinta säilytetään. Ei verkkoliikennettä: kansio on käyttäjän valitsema
// (esim. pilvipalvelun kansio), ja kirjoitus käyttää jo annettua käyttölupaa.

import { buildBackup, toJson } from '../../db/backup';
import { repo } from '../../db/repositories';
import { db } from '../../db/schema';
import { localDateOf } from '../../domain/dates';
import type { ISODate, Timestamp } from '../../domain/types';

export const AUTO_BACKUP_DIR = 'varmuuskopiot';
export const AUTO_BACKUP_KEEP = 8;
export const AUTO_BACKUP_EVERY_DAYS = 7;
const NAME_RE = /^liikkumisseuranta-varmuuskopio-(\d{4}-\d{2}-\d{2})\.json$/;

export const autoBackupName = (date: ISODate) => `liikkumisseuranta-varmuuskopio-${date}.json`;

/** Onko varmuuskopio ajankohtainen: ei koskaan tehty tai edellisestä vähintään 7 vuorokautta. */
export function autoBackupDue(last: Timestamp | undefined, now: Date): boolean {
  if (!last) return true;
  return now.getTime() - new Date(last).getTime() >= AUTO_BACKUP_EVERY_DAYS * 86_400_000;
}

/** Poistettavat vanhat varmuuskopiot: vain sovelluksen nimeämät, vanhimmat ensin, `keep` uusinta jää. */
export function backupsToRemove(names: string[], keep = AUTO_BACKUP_KEEP): string[] {
  const ours = names.filter((n) => NAME_RE.test(n)).sort();
  return ours.slice(0, Math.max(0, ours.length - keep));
}

/**
 * Kirjoittaa varmuuskopion, jos se on ajankohtainen; palauttaa tiedoston nimen tai null.
 * Merkitsee myös lastExportAt-ajan, jolloin varmuuskopiomuistutus ei näy turhaan.
 */
export async function runAutoBackup(folder: FileSystemDirectoryHandle, now = new Date()): Promise<string | null> {
  if (!autoBackupDue(await repo.getMeta<Timestamp>('autoBackupAt'), now)) return null;
  const dir = await folder.getDirectoryHandle(AUTO_BACKUP_DIR, { create: true });
  const file = await buildBackup(db);
  const name = autoBackupName(localDateOf(now));
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(toJson(file));
  await w.close();
  const names: string[] = [];
  for await (const key of (dir as unknown as { keys(): AsyncIterable<string> }).keys()) names.push(key);
  for (const old of backupsToRemove(names)) await dir.removeEntry(old).catch(() => undefined);
  await repo.setMeta('autoBackupAt', file.exportedAt);
  await repo.setMeta('lastExportAt', file.exportedAt);
  return name;
}
