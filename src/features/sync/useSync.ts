// Synkronoinnin toiminnot ja tila (SPEC 10, "Synkronointi PC ↔ puhelin").

import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { defaultPlanningThrough } from '../../domain/planning';
import { SYNC_FILE_NAME } from '../../domain/version';
import type { Timestamp } from '../../domain/types';
import { buildSyncFile, markSent, mergeSyncFile, pendingCount, toJson, type MergeSummary } from '../../db/backup';
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
    const phoneFile = await readFolderFile(handle, SYNC_FILE_NAME.phone);
    const readAt = (await repo.getMeta<number>('phoneFileReadAt')) ?? 0;
    if (phoneFile && phoneFile.lastModified > readAt) {
      summary = await mergeSyncFile(db, await phoneFile.text(), deviceId);
      await repo.setMeta('phoneFileReadAt', phoneFile.lastModified);
    }
    await ensurePlannedAll();
    await writeFolderFile(handle, SYNC_FILE_NAME.pc, toJson(await buildSyncFile(db, deviceId, 'pc')));
    await repo.setMeta('lastSyncRunAt', new Date().toISOString());
    return { summary, wrote: true, message: summary ? summaryText(summary) : 'PC:n tiedosto päivitetty; puhelimelta ei uutta' };
  }, []);

  /** PC ilman kansiotukea: tuo puhelimen tiedosto. */
  const importFile = useCallback(async (): Promise<SyncOutcome | null> => {
    const f = await pickTextFile();
    if (!f) return null;
    const summary = await mergeSyncFile(db, f.text, await repo.deviceId());
    await ensurePlannedAll();
    await repo.setMeta('lastSyncRunAt', new Date().toISOString());
    return { summary, message: summaryText(summary) };
  }, []);

  /** PC ilman kansiotukea: lataa PC:n tiedosto. */
  const downloadPcFile = useCallback(async () => {
    downloadText(SYNC_FILE_NAME.pc, toJson(await buildSyncFile(db, await repo.deviceId(), 'pc')));
    await repo.setMeta('lastSyncRunAt', new Date().toISOString());
  }, []);

  /** Puhelin: "Lähetä PC:lle" – jako tai lataus nimellä liikkuminen-puhelin.json. */
  const phoneSend = useCallback(async (): Promise<string> => {
    const text = toJson(await buildSyncFile(db, await repo.deviceId(), 'phone'));
    const r = await shareOrDownload(SYNC_FILE_NAME.phone, text);
    if (r === 'cancelled') return 'Lähetys peruttiin';
    await markSent(db);
    return r === 'shared' ? 'Tiedosto jaettu – tallenna se pilvikansioon nimellä liikkuminen-puhelin.json' : 'Tiedosto ladattu – siirrä se pilvikansioon';
  }, []);

  return { pcSync, importFile, downloadPcFile, phoneSend };
}

export function summaryText(s: MergeSummary): string {
  const base = `Yhdistetty: ${s.added} uutta, ${s.updated} päivitettyä, ${s.deleted} poistettu`;
  return s.conflicts.length ? `${base} · ${s.conflicts.length} ristiriitaa` : base;
}

export const ROLE_GEN: Record<'pc' | 'phone', string> = { pc: 'PC:n', phone: 'puhelimen' };
