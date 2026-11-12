// Varmuuskopio, tuonti, synkronointitiedostot ja poistot (SPEC 10, 11).
//
// Tuonti: jäsennys → zod-validointi → tarkistussumma → migraatio → kaikkien taulujen
// tyhjennys ja lisäys YHDESSÄ rw-transaktiossa. Mikä tahansa virhe perii transaktion,
// eikä data muutu. Yhdistäminen (synkronointi) samoin yhdessä transaktiossa.

import { dataChecksum } from '../domain/checksum';
import { mergeSnapshot, type MergeResult } from '../domain/merge';
import { CURRENT_SCHEMA_VERSION, migrateToCurrent, SYNCED_TABLES, type SyncedTable } from '../domain/migrations';
import { backupFileSchema, fileHeaderSchema, syncFileSchema } from '../domain/schemas';
import type { DeviceId, MetaRow, SyncFields, Timestamp, UUID } from '../domain/types';
import { APP_VERSION, BACKUP_FORMAT, SYNC_FORMAT } from '../domain/version';
import { nowTimestamp } from './clock';
import type { AppDB } from './schema';

export type DeviceRole = 'pc' | 'phone';
type Rows = Record<string, unknown>[];
type TableMap = Partial<Record<SyncedTable, Rows>>;

/** Laitekohtaiset meta-avaimet, jotka säilyvät tuonnissa (vahvistettu tulkinta). */
export const DEVICE_META_KEYS = [
  'deviceId',
  'deviceRole',
  'syncFolderHandle',
  'lastSyncAt',
  'lastSyncRunAt',
  'lastSentAt',
  'lastIncomingExportedAt',
  'phoneFileReadAt',
];
/** Ei voi tallentaa JSONiin. */
const NON_EXPORTABLE_META = ['syncFolderHandle'];

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  appVersion: string;
  exportedAt: Timestamp;
  checksum: string;
  data: TableMap & { meta: MetaRow[] };
}

export interface SyncFile {
  format: typeof SYNC_FORMAT;
  schemaVersion: number;
  appVersion: string;
  exportedAt: Timestamp;
  checksum: string;
  deviceId: DeviceId;
  deviceRole: DeviceRole;
  data: TableMap;
}

export class ImportError extends Error {}

const tables = (db: AppDB) => SYNCED_TABLES.map((t) => db.table(t));

async function readSynced(db: AppDB): Promise<TableMap> {
  const out: TableMap = {};
  for (const t of SYNCED_TABLES) out[t] = (await db.table(t).toArray()) as Rows;
  return out;
}

const getMeta = async <T>(db: AppDB, key: string) => (await db.meta.get(key))?.value as T | undefined;

// ---------- vienti ----------

export async function buildBackup(db: AppDB): Promise<BackupFile> {
  // Luku yhdessä transaktiossa (yhtenäinen tilannekuva); tarkistussumma vasta sen jälkeen,
  // koska crypto.subtle-lupaus sulkisi Dexie-transaktion ennenaikaisesti.
  const data = await db.transaction('r', [...tables(db), db.meta], async () => {
    const synced = await readSynced(db);
    const meta = (await db.meta.toArray()).filter((m) => !NON_EXPORTABLE_META.includes(m.key));
    return { ...synced, meta };
  });
  return {
    format: BACKUP_FORMAT,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: nowTimestamp(),
    checksum: await dataChecksum(data),
    data,
  };
}

/** Synkronointitiedosto: kaikki synkronoitavat taulut poistomerkintöineen täytenä tilannekuvana. */
export async function buildSyncFile(db: AppDB, deviceId: DeviceId, deviceRole: DeviceRole): Promise<SyncFile> {
  const data = await db.transaction('r', tables(db), () => readSynced(db));
  return {
    format: SYNC_FORMAT,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: nowTimestamp(),
    checksum: await dataChecksum(data),
    deviceId,
    deviceRole,
    data,
  };
}

export const toJson = (f: BackupFile | SyncFile) => JSON.stringify(f, null, 1);

// ---------- jäsennys ja tarkistus ----------

export type FileKind = 'backup' | 'sync' | 'other-json' | 'not-json';

/**
 * Tunnistaa tiedoston tyypin sisällöstä (ei tiedostonimestä): iOS voi nimetä tiedoston uudelleen
 * tai käyttäjä voi valita synkronointitiedoston varmuuskopion sijaan.
 */
export function detectFileKind(text: string): FileKind {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/, '').trim());
  } catch {
    return 'not-json';
  }
  const format = (raw as { format?: unknown } | null)?.format;
  return format === BACKUP_FORMAT ? 'backup' : format === SYNC_FORMAT ? 'sync' : 'other-json';
}

/** Selkeä virheilmoitus tunnistetun tyypin mukaan. */
export function wrongFileMessage(kind: FileKind, text: string): string {
  if (kind === 'not-json') {
    const start = text.trim().slice(0, 20).toLowerCase();
    const wrapped = start.startsWith('<') || start.includes('bplist');
    return wrapped
      ? 'Tiedosto ei ole JSON-tiedosto: se näyttää tallentuneen verkkosivuna tai iOS-arkistona. Vie varmuuskopio uudelleen ja valitse jakovalikosta "Tallenna Tiedostoihin".'
      : 'Tiedosto ei ole JSON-tiedosto (esim. CSV-vienti ei käy tuontiin). Valitse liikkumisseuranta-varmuuskopio-….json tai liikkuminen.json.';
  }
  return 'Tiedosto on JSON-muodossa, mutta se ei ole liikkumisseurannan varmuuskopio eikä synkronointitiedosto.';
}

async function parse<T extends 'backup' | 'sync'>(text: string, kind: T): Promise<T extends 'backup' ? BackupFile : SyncFile> {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/, '').trim());
  } catch {
    throw new ImportError('Tiedosto ei ole kelvollinen JSON-tiedosto.');
  }
  const header = fileHeaderSchema.safeParse(raw);
  const expected = kind === 'backup' ? BACKUP_FORMAT : SYNC_FORMAT;
  if (!header.success || header.data.format !== expected) {
    throw new ImportError(kind === 'backup' ? 'Tiedosto ei ole liikkumisseurannan varmuuskopio.' : 'Tiedosto ei ole liikkumisseurannan synkronointitiedosto.');
  }
  if (header.data.schemaVersion > CURRENT_SCHEMA_VERSION) throw new ImportError('Päivitä sovellus tällä laitteella ensin');

  const parsed = (kind === 'backup' ? backupFileSchema : syncFileSchema).safeParse(raw);
  if (!parsed.success) throw new ImportError('Tiedoston sisältö ei ole kelvollinen.');

  // Tarkistussumma alkuperäisestä data-osasta (ennen oletusarvojen lisäystä).
  const rawData = (raw as { data: unknown }).data;
  if ((await dataChecksum(rawData)) !== parsed.data.checksum) {
    throw new ImportError('Tarkistussumma ei täsmää: tiedostoa on muutettu tai se on vioittunut. Tietoja ei tuotu.');
  }

  const file = parsed.data as unknown as { schemaVersion: number; data: Record<string, unknown[]> };
  const migrated = migrateToCurrent(file.data, file.schemaVersion);
  return { ...file, schemaVersion: CURRENT_SCHEMA_VERSION, data: migrated } as never;
}

export const parseBackup = (text: string) => parse(text, 'backup');
export const parseSyncFile = (text: string) => parse(text, 'sync');

// ---------- varmuuskopion tuonti (korvaa kaiken) ----------

/**
 * @param onSafetyBackup kutsutaan nykytilan varmuuskopiolla ENNEN tuontia (C4); käyttöliittymä lataa sen.
 */
export async function importBackup(db: AppDB, text: string, onSafetyBackup: (current: BackupFile) => void | Promise<void>): Promise<BackupFile> {
  const file = await parseBackup(text);
  await onSafetyBackup(await buildBackup(db));
  await db.transaction('rw', [...tables(db), db.meta], async () => {
    const keep = (await db.meta.bulkGet(DEVICE_META_KEYS)).filter((m): m is MetaRow => !!m);
    for (const t of SYNCED_TABLES) {
      await db.table(t).clear();
      const rows = (file.data as TableMap)[t] ?? [];
      if (rows.length) await db.table(t).bulkAdd(rows);
    }
    await db.meta.clear();
    const meta = (file.data.meta ?? []).filter((m) => !DEVICE_META_KEYS.includes(m.key));
    if (meta.length) await db.meta.bulkAdd(meta);
    if (keep.length) await db.meta.bulkPut(keep);
    await db.meta.put({ key: 'schemaVersion', value: CURRENT_SCHEMA_VERSION });
  });
  return file;
}

// ---------- synkronointi ----------

export interface MergeSummary extends MergeResult {
  incomingDevice: DeviceId;
  incomingRole: DeviceRole;
  incomingExportedAt: Timestamp;
}

/** Yhdistää toisen laitteen tiedoston yhdessä rw-transaktiossa. */
export async function mergeSyncFile(db: AppDB, text: string, thisDevice: DeviceId): Promise<MergeSummary> {
  const file = await parseSyncFile(text);
  return db.transaction('rw', [...tables(db), db.meta], async () => {
    const local = await readSynced(db);
    const lastSyncAt = await getMeta<Timestamp>(db, 'lastSyncAt');
    const result = mergeSnapshot(local as never, file.data as never, { thisDevice, incomingDevice: file.deviceId, lastSyncAt });
    for (const [t, rows] of Object.entries(result.writes)) await db.table(t).bulkPut(rows!);
    await db.meta.bulkPut([
      { key: 'lastSyncAt', value: nowTimestamp() },
      { key: 'lastIncomingExportedAt', value: file.exportedAt },
    ]);
    return { ...result, incomingDevice: file.deviceId, incomingRole: file.deviceRole, incomingExportedAt: file.exportedAt };
  });
}

/**
 * Yhdistää varmuuskopion tiedot nykyisiin (ei korvaa): samat säännöt kuin synkronoinnissa.
 * Käytetään, kun "Päivitä PC:ltä" -toiminnossa valitaan varmuuskopio synkronointitiedoston sijaan.
 */
export async function mergeBackupFile(db: AppDB, text: string, thisDevice: DeviceId): Promise<MergeSummary> {
  const file = await parseBackup(text);
  const incoming: TableMap = {};
  for (const t of SYNCED_TABLES) incoming[t] = (file.data as TableMap)[t] ?? [];
  return db.transaction('rw', [...tables(db), db.meta], async () => {
    const local = await readSynced(db);
    const result = mergeSnapshot(local as never, incoming as never, { thisDevice, incomingDevice: 'backup' });
    for (const [t, rows] of Object.entries(result.writes)) await db.table(t).bulkPut(rows!);
    return { ...result, incomingDevice: 'backup', incomingRole: 'pc' as const, incomingExportedAt: file.exportedAt };
  });
}

/** Yhdistää kumman tahansa tiedostotyypin; muu sisältö hylätään selkeällä viestillä. */
export async function mergeAnyFile(db: AppDB, text: string, thisDevice: DeviceId): Promise<MergeSummary & { kind: 'backup' | 'sync' }> {
  const kind = detectFileKind(text);
  if (kind === 'sync') return { ...(await mergeSyncFile(db, text, thisDevice)), kind };
  if (kind === 'backup') return { ...(await mergeBackupFile(db, text, thisDevice)), kind };
  throw new ImportError(wrongFileMessage(kind, text));
}

/** Odottavat kirjaukset: tämän laitteen muutokset edellisen "Lähetä PC:lle" jälkeen. */
export async function pendingCount(db: AppDB, thisDevice: DeviceId): Promise<number> {
  const since = (await getMeta<Timestamp>(db, 'lastSentAt')) ?? '';
  let n = 0;
  for (const t of SYNCED_TABLES) {
    n += await db
      .table(t)
      .where('updatedAt')
      .above(since)
      .filter((r: SyncFields) => r.updatedBy === thisDevice)
      .count();
  }
  return n;
}

/** Muuttuneet tietueet (mikä tahansa laite) annetun ajan jälkeen; automaattisen synkronoinnin tarve. */
export async function changedSince(db: AppDB, since: Timestamp): Promise<number> {
  let n = 0;
  for (const t of SYNCED_TABLES) n += await db.table(t).where('updatedAt').above(since).count();
  return n;
}

export async function markSent(db: AppDB): Promise<void> {
  await db.meta.put({ key: 'lastSentAt', value: nowTimestamp() });
}

// ---------- poistot (SPEC 11) ----------

/** "Tyhjennä kaikki tiedot": kaikki taulut tällä laitteella (vahvistettu: vain tämä laite). */
export async function clearAll(db: AppDB): Promise<void> {
  await db.transaction('rw', [...tables(db), db.meta], async () => {
    for (const t of [...SYNCED_TABLES, 'meta']) await db.table(t).clear();
  });
}

/**
 * "Poista profiili ja kaikki sen tiedot": tietueet korvataan tyhjennetyillä poistomerkinnöillä
 * (vain avain ja synkronointikentät), jotta poisto siirtyy myös toiselle laitteelle eikä
 * sisältöä jää talteen (vahvistettu tulkinta).
 */
export async function purgeProfile(db: AppDB, profileId: UUID, deviceId: DeviceId): Promise<number> {
  return db.transaction('rw', [...tables(db), db.meta], async () => {
    const ts = nowTimestamp();
    const stub = { updatedAt: ts, updatedBy: deviceId, deletedAt: ts };
    let n = 0;
    const purge = async (table: SyncedTable, ids: string[], key: 'id' | 'sessionId' | 'plannedSessionId' = 'id') => {
      if (!ids.length) return;
      await db.table(table).bulkPut(ids.map((id) => ({ [key]: id, ...stub })));
      n += ids.length;
    };
    const ownIds = async (table: SyncedTable) =>
      (await db.table(table).toArray()).filter((r: { profileId?: string }) => r.profileId === profileId).map((r: { id: string }) => r.id);

    const sessionIds = await ownIds('sessions');
    const football = (await db.footballDetails.bulkGet(sessionIds)).filter(Boolean).map((d) => d!.sessionId);
    await purge('footballDetails', football, 'sessionId');
    await purge('sessions', sessionIds);
    const planIds = await ownIds('plannedSessions');
    const fixtures = (await db.fixtures.bulkGet(planIds)).filter(Boolean).map((f) => f!.plannedSessionId);
    await purge('fixtures', fixtures, 'plannedSessionId');
    for (const t of ['estimates', 'templateItems', 'plannedSessions', 'dayFlags', 'teams'] as const) await purge(t, await ownIds(t));
    await purge('profiles', [profileId]);
    await db.meta.delete(`plannedThrough:${profileId}`);
    return n;
  });
}
