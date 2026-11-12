// Synkronoinnin toiminnot ja tila (SPEC 10, "Synkronointi PC ↔ puhelin").

import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { defaultPlanningThrough } from '../../domain/planning';
import { SYNC_FILE_NAME } from '../../domain/version';
import type { Timestamp } from '../../domain/types';
import { buildSyncFile, markSent, mergeAnyFile, mergeSyncFile, pendingCount, toJson, type MergeSummary } from '../../db/backup';
import { repo } from '../../db/repositories';
import { db } from '../../db/schema';
import { today } from '../../ui/today';
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
    await ensurePlannedAll();
    // 3) Kirjoitetaan yhdistetty tilannekuva yhteiseen tiedostoon ja muistetaan oma kirjoitusaika.
    await writeFolderFile(handle, SYNC_FILE_NAME.shared, toJson(await buildSyncFile(db, deviceId, 'pc')));
    await repo.setMeta('syncFileWrittenAt', (await readFolderFile(handle, SYNC_FILE_NAME.shared))?.lastModified ?? Date.now());
    await repo.setMeta('lastSyncRunAt', new Date().toISOString());
    return { summary, wrote: true, message: summary ? summaryText(summary) : 'Tiedosto liikkuminen.json päivitetty; puhelimelta ei uutta' };
  }, []);

  /** PC ilman kansiotukea: tuo puhelimen tiedosto. */
  const importFile = useCallback(async (): Promise<SyncOutcome | null> => {
    const f = await pickTextFile();
    if (!f) return null;
    const me = await repo.deviceId();
    // Oma tiedosto (esim. puhelin tallensi liikkuminen.json, eikä PC ole vielä synkronoinut): ei yhdistettävää.
    if (syncFileDevice(f.text) === me) return { message: 'Tiedosto on tämän laitteen oma tallennus – toinen laite ei ole vielä päivittänyt sitä' };
    // Hyväksyy sekä synkronointitiedoston että varmuuskopion (tunnistus sisällöstä).
    const summary = await mergeAnyFile(db, f.text, me);
    await ensurePlannedAll();
    await repo.setMeta('lastSyncRunAt', new Date().toISOString());
    return { summary, message: summaryText(summary) };
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

export function summaryText(s: MergeSummary): string {
  const base = `Yhdistetty: ${s.added} uutta, ${s.updated} päivitettyä, ${s.deleted} poistettu`;
  return s.conflicts.length ? `${base} · ${s.conflicts.length} ristiriitaa` : base;
}

export const ROLE_GEN: Record<'pc' | 'phone', string> = { pc: 'PC:n', phone: 'puhelimen' };
