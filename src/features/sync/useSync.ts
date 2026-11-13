// Synkronoinnin toiminnot ja tila (SPEC 10, "Synkronointi PC ↔ puhelin").

import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { defaultPlanningThrough } from '../../domain/planning';
import { SYNC_FILE_NAME } from '../../domain/version';
import type { Timestamp } from '../../domain/types';
import { buildSyncFile, changedSince, markSent, mergeAnyFile, mergeSyncFile, pendingCount, toJson, type MergeSummary } from '../../db/backup';
import { repo } from '../../db/repositories';
import { db } from '../../db/schema';
import { today } from '../../ui/today';
import { runAutoBackup } from './autoBackup';
import { folderPermission, pickFolder, pickTextFile, readFolderFile, shareOrDownload, supportsFolder, writeFolderFile, downloadText } from './fileIO';

export interface SyncState {
  role?: 'pc' | 'phone';
  deviceId?: string;
  lastSyncAt?: Timestamp;
  lastSyncRunAt?: Timestamp;
  lastSentAt?: Timestamp;
  lastIncomingExportedAt?: Timestamp;
  hasFolder: boolean;
  pending: number;
}

/** Synkronointitiedoston kirjoittanut laite (tiedoston sisällöstä); undefined, jos ei luettavissa. */
export function syncFileDevice(text: string): string | undefined {
  try {
    const v = JSON.parse(text) as { format?: string; deviceId?: string };
    return v.format === 'liikkumisseuranta-sync' ? v.deviceId : undefined;
  } catch {
    return undefined;
  }
}

/** Yhdistää kaksi yhteenvetoa (yhteinen tiedosto + vanha puhelimen tiedosto samassa synkronoinnissa). */
function combine(a: MergeSummary | undefined, b: MergeSummary): MergeSummary {
  if (!a) return b;
  return { ...b, added: a.added + b.added, updated: a.updated + b.updated, deleted: a.deleted + b.deleted, conflicts: [...a.conflicts, ...b.conflicts] };
}

async function ensurePlannedAll() {
  const t = today();
  for (const p of await repo.listProfiles()) await repo.ensurePlanned(p.id, defaultPlanningThrough(t), t);
}

/**
 * Välituntisiivous myös yhdistämisen jälkeen (ei vain käynnistyksessä): toisen laitteen tiedosto voi
 * tuoda avoimen välituntikerran tai -rivin, jonka tämä laite on jo siivonnut. Idempotentti.
 */
const foldEstimateOnly = async () => {
  await repo.foldEstimateOnlySessions(today()).catch(() => 0);
  await repo.applyHolidaySkips().catch(() => 0); // lomajaksot: toisen laitteen tuomat kerrat/jaksot
};

export function useSyncState(): SyncState | undefined {
  return useLiveQuery(async () => {
    // Vain lukuja: live-kyselyssä ei saa avata kirjoitustransaktiota (repo.deviceId() voi luoda tunnisteen).
    const deviceId = (await repo.getMeta<string>('deviceId')) ?? '';
    const [role, lastSyncAt, lastSyncRunAt, lastSentAt, lastIncomingExportedAt, folder] = await Promise.all([
      repo.getDeviceRole(),
      repo.getMeta<Timestamp>('lastSyncAt'),
      repo.getMeta<Timestamp>('lastSyncRunAt'),
      repo.getMeta<Timestamp>('lastSentAt'),
      repo.getMeta<Timestamp>('lastIncomingExportedAt'),
      repo.getMeta<FileSystemDirectoryHandle>('syncFolderHandle'),
    ]);
    return { role, deviceId, lastSyncAt, lastSyncRunAt, lastSentAt, lastIncomingExportedAt, hasFolder: !!folder, pending: await pendingCount(db, deviceId) };
  }, []);
}

export type SyncOutcome = { summary?: MergeSummary; wrote?: boolean; message: string };

/** Kansion tiedostojen luku ja yhdistäminen (PC); palauttaa yhteenvedon, jos jotain yhdistettiin. */
async function mergeFromFolder(handle: FileSystemDirectoryHandle, deviceId: string): Promise<MergeSummary | undefined> {
  let summary: MergeSummary | undefined;
  // 1) Yhteinen tiedosto: jos joku muu (puhelin) on tallentanut sen PC:n oman kirjoituksen jälkeen, yhdistetään.
  const shared = await readFolderFile(handle, SYNC_FILE_NAME.shared);
  const ownWrite = (await repo.getMeta<number>('syncFileWrittenAt')) ?? 0;
  if (shared && shared.lastModified > ownWrite) {
    const text = await shared.text();
    const by = syncFileDevice(text);
    if (by && by !== deviceId) summary = await mergeSyncFile(db, text, deviceId);
  }
  // 2) Vanha puhelimen tiedosto (ennen yhteistä nimeä), jos se on muuttunut edellisen lukukerran jälkeen.
  const legacy = await readFolderFile(handle, SYNC_FILE_NAME.legacyPhone);
  const readAt = (await repo.getMeta<number>('phoneFileReadAt')) ?? 0;
  if (legacy && legacy.lastModified > readAt) {
    summary = combine(summary, await mergeSyncFile(db, await legacy.text(), deviceId));
    await repo.setMeta('phoneFileReadAt', legacy.lastModified);
  }
  return summary;
}

/** Viikoittainen varmuuskopio kansioon; epäonnistuminen ei estä synkronointia. */
async function weeklyBackup(handle: FileSystemDirectoryHandle) {
  try {
    await runAutoBackup(handle);
  } catch {
    /* esim. kansio vain luku -tilassa; yritetään seuraavalla synkronoinnilla */
  }
}

/** Kirjoittaa yhdistetyn tilannekuvan yhteiseen tiedostoon ja muistaa oman kirjoitusajan. */
async function writeToFolder(handle: FileSystemDirectoryHandle, deviceId: string) {
  await ensurePlannedAll();
  await writeFolderFile(handle, SYNC_FILE_NAME.shared, toJson(await buildSyncFile(db, deviceId, 'pc')));
  await repo.setMeta('syncFileWrittenAt', (await readFolderFile(handle, SYNC_FILE_NAME.shared))?.lastModified ?? Date.now());
  await repo.setMeta('lastSyncRunAt', new Date().toISOString());
}

/**
 * PC:n automaattinen synkronointi (työpöytätila): ei kysy kansiota eikä lupaa (vain jo annettu lupa),
 * ja kirjoittaa tiedoston vain, jos puhelimelta tuli uutta tai PC:llä on muutoksia edellisen kerran jälkeen.
 * Palauttaa null, jos synkronointi ei ole mahdollista tai mitään ei tarvinnut tehdä.
 */
export async function pcAutoSync(): Promise<SyncOutcome | null> {
  if (!supportsFolder() || (await repo.getDeviceRole()) !== 'pc') return null;
  const handle = await repo.getMeta<FileSystemDirectoryHandle>('syncFolderHandle');
  if (!handle || !(await folderPermission(handle, false))) return null;
  const deviceId = await repo.deviceId();
  const summary = await mergeFromFolder(handle, deviceId);
  await foldEstimateOnly();
  await weeklyBackup(handle);
  const since = await repo.getMeta<Timestamp>('lastSyncRunAt');
  const localChanged = !since || (await changedSince(db, since)) > 0;
  if (!summary && !localChanged) {
    await repo.setMeta('lastSyncRunAt', new Date().toISOString()); // ajan tasalla: tarkistettu juuri nyt
    return null;
  }
  await writeToFolder(handle, deviceId);
  return { summary, wrote: true, message: summary ? summaryText(summary) : 'liikkuminen.json päivitetty' };
}

/** Onko automaattiselle synkronoinnille lupa (kansio valittu ja lupa voimassa ilman kysymistä). */
export async function autoSyncReady(): Promise<'ok' | 'no-folder' | 'no-permission' | 'unsupported'> {
  if (!supportsFolder()) return 'unsupported';
  const handle = await repo.getMeta<FileSystemDirectoryHandle>('syncFolderHandle');
  if (!handle) return 'no-folder';
  return (await folderPermission(handle, false)) ? 'ok' : 'no-permission';
}

export function useSyncActions() {
  /** PC: "Synkronoi" – lue puhelimen tiedosto (jos muuttunut), yhdistä, ensurePlanned, kirjoita PC:n tiedosto. */
  const pcSync = useCallback(async (): Promise<SyncOutcome> => {
    const deviceId = await repo.deviceId();
    if (!supportsFolder()) throw new Error('Selain ei tue kansion käsittelyä. Käytä tiedoston tuontia ja latausta.');
    let handle = await repo.getMeta<FileSystemDirectoryHandle>('syncFolderHandle');
    if (!handle) {
      handle = await pickFolder();
      await repo.setMeta('syncFolderHandle', handle);
    }
    if (!(await folderPermission(handle, true))) throw new Error('Kansion käyttöoikeus puuttuu.');
    const summary = await mergeFromFolder(handle, deviceId);
    await foldEstimateOnly();
    await weeklyBackup(handle);
    await writeToFolder(handle, deviceId);
    return { summary, wrote: true, message: summary ? summaryText(summary) : 'Tiedosto liikkuminen.json päivitetty; puhelimelta ei uutta' };
  }, []);

  /** PC ilman kansiotukea: tuo puhelimen tiedosto. */
  const importFile = useCallback(async (): Promise<SyncOutcome | null> => {
    const f = await pickTextFile();
    if (!f) return null;
    const me = await repo.deviceId();
    // Oma tiedosto (esim. puhelin tallensi liikkuminen.json, eikä PC ole vielä synkronoinut): ei yhdistettävää.
    if (syncFileDevice(f.text) === me) return { message: 'Tiedosto on tämän laitteen oma tallennus – toinen laite ei ole vielä päivittänyt sitä' };
    const before = await repo.getMeta<Timestamp>('lastIncomingExportedAt');
    // Hyväksyy sekä synkronointitiedoston että varmuuskopion (tunnistus sisällöstä).
    const summary = await mergeAnyFile(db, f.text, me);
    await foldEstimateOnly();
    await ensurePlannedAll();
    await repo.setMeta('lastSyncRunAt', new Date().toISOString());
    return { summary, message: importMessage(summary, before) };
  }, []);

  /** PC ilman kansiotukea: lataa PC:n tiedosto. */
  const downloadPcFile = useCallback(async () => {
    downloadText(SYNC_FILE_NAME.shared, toJson(await buildSyncFile(db, await repo.deviceId(), 'pc')));
    await repo.setMeta('lastSyncRunAt', new Date().toISOString());
  }, []);

  /** Puhelin: "Lähetä PC:lle" – jako tai lataus nimellä liikkuminen.json (korvaa PC:n tiedoston tai tallenna rinnalle). */
  const phoneSend = useCallback(async (): Promise<string> => {
    const text = toJson(await buildSyncFile(db, await repo.deviceId(), 'phone'));
    const r = await shareOrDownload(SYNC_FILE_NAME.shared, text);
    if (r === 'cancelled') return 'Lähetys peruttiin';
    await markSent(db);
    return r === 'shared'
      ? 'Tiedosto jaettu – tallenna pilvikansioon nimellä liikkuminen.json ("Korvaa" tai "Säilytä molemmat")'
      : 'Tiedosto ladattu – siirrä se pilvikansioon nimellä liikkuminen.json';
  }, []);

  return { pcSync, importFile, downloadPcFile, phoneSend };
}

/** Aikaleima lyhyesti: "tänään klo 9.41" tai "12.11. klo 18.05". */
export function savedAtText(ts: Timestamp, now = new Date()): string {
  const d = new Date(ts);
  const clock = `klo ${d.getHours()}.${String(d.getMinutes()).padStart(2, '0')}`;
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? `tänään ${clock}` : `${d.getDate()}.${d.getMonth() + 1}. ${clock}`;
}

/**
 * Tuonnin viesti: yhteenveto ja tiedoston tallennusaika. Jos tiedosto on sama (tai vanhempi) kuin
 * edellisellä tuonnilla eikä mitään muuttunut, kerrotaan se suoraan: PC tai pilvikansio ei ole
 * vielä ehtinyt päivittää tiedostoa.
 */
export function importMessage(s: MergeSummary & { kind?: 'backup' | 'sync' }, previousExportedAt: Timestamp | undefined, now = new Date()): string {
  if (s.kind === 'backup') return summaryText(s);
  const who = s.incomingRole === 'phone' ? 'Puhelin' : 'PC';
  const saved = `${who} tallensi tiedoston ${savedAtText(s.incomingExportedAt, now)}`;
  const nothing = !s.added && !s.updated && !s.deleted && !s.conflicts.length;
  if (nothing && previousExportedAt && s.incomingExportedAt <= previousExportedAt)
    return `Ei uutta: tiedosto on sama kuin edellisellä kerralla (tallennettu ${savedAtText(s.incomingExportedAt, now)}). Jos teit juuri muutoksia, odota hetki, että tiedosto ehtii päivittyä pilvikansioon, ja yritä uudelleen.`;
  return `${summaryText(s)} · ${saved}`;
}

export function summaryText(s: MergeSummary): string {
  const base = `Yhdistetty: ${s.added} uutta, ${s.updated} päivitettyä, ${s.deleted} poistettu`;
  return s.conflicts.length ? `${base} · ${s.conflicts.length} ristiriitaa` : base;
}

export const ROLE_GEN: Record<'pc' | 'phone', string> = { pc: 'PC:n', phone: 'puhelimen' };
