// Laitteiden välinen yhdistäminen (SPEC 10, "Yhdistämissääntö"). Puhdas funktio.
// Uudempi updatedAt voittaa; tasapelissä suurempi updatedBy. Poistomerkinnät ovat tavallisia
// tietueita. Idempotentti: saman tiedoston tuonti uudelleen ei muuta mitään.

import type { SyncFields, Timestamp, DeviceId } from './types';
import type { SyncedTable } from './migrations';

type Row = SyncFields & Record<string, unknown>;

export function pickWinner<T extends SyncFields>(local: T | undefined, incoming: T): T | undefined {
  if (!local) return incoming; // uusi tietue
  if (incoming.updatedAt > local.updatedAt) return incoming; // uudempi voittaa
  if (incoming.updatedAt === local.updatedAt && incoming.updatedBy > local.updatedBy) return incoming; // tasapeli
  return undefined; // paikallinen pysyy
}

/**
 * Kuitattu suunnitelma voittaa avoimena poistetun version aikaleimoista riippumatta: kuitattua kertaa
 * ei voi poistaa (deletePlanned), joten avoimen version poisto on tehty laitteella, joka ei vielä
 * tiennyt kuittauksesta (esim. käynnistyksen välituntisiivous ennen "Päivitä PC:ltä"). Profiilin
 * poiston merkinnöissä ei ole tilaa, joten ne eivät kuulu tähän sääntöön.
 */
export function confirmedBeatsDeletion(table: SyncedTable, local: Row | undefined, incoming: Row): 'local' | 'incoming' | undefined {
  if (table !== 'plannedSessions' || !local) return undefined;
  const done = (r: Row) => !r.deletedAt && r.status === 'done';
  const openDeleted = (r: Row) => !!r.deletedAt && r.status === 'open';
  if (done(local) && openDeleted(incoming)) return 'local';
  if (openDeleted(local) && done(incoming)) return 'incoming';
  return undefined;
}

/** Taulun pääavain. */
export const keyOf = (table: SyncedTable, row: Record<string, unknown>): string =>
  String(table === 'footballDetails' ? row.sessionId : table === 'fixtures' ? row.plannedSessionId : row.id);

export interface Conflict {
  table: SyncedTable;
  key: string;
  /** Kumpi versio jäi voimaan. */
  winner: 'local' | 'incoming';
  local: Row;
  incoming: Row;
}

export interface MergeResult {
  /** Kirjoitettavat tietueet tauluittain (voittaneet saapuvat). */
  writes: Partial<Record<SyncedTable, Row[]>>;
  added: number;
  updated: number;
  deleted: number;
  conflicts: Conflict[];
}

export interface MergeContext {
  thisDevice: DeviceId;
  incomingDevice: DeviceId;
  /** Edellinen onnistunut yhdistäminen tällä laitteella; puuttuu ensimmäisellä kerralla. */
  lastSyncAt?: Timestamp;
}

export function mergeSnapshot(
  local: Partial<Record<SyncedTable, Row[]>>,
  incoming: Partial<Record<SyncedTable, Row[]>>,
  ctx: MergeContext,
): MergeResult {
  const res: MergeResult = { writes: {}, added: 0, updated: 0, deleted: 0, conflicts: [] };
  for (const table of Object.keys(incoming) as SyncedTable[]) {
    const localByKey = new Map((local[table] ?? []).map((r) => [keyOf(table, r), r]));
    const writes: Row[] = [];
    for (const inc of incoming[table] ?? []) {
      const key = keyOf(table, inc);
      const loc = localByKey.get(key);
      const rule = confirmedBeatsDeletion(table, loc, inc);
      const win = rule ? (rule === 'incoming' ? inc : undefined) : pickWinner(loc, inc);

      // Ristiriita: molemmilla laitteilla muokattu edellisen synkronoinnin jälkeen.
      if (
        loc &&
        ctx.lastSyncAt &&
        !(loc.updatedAt === inc.updatedAt && loc.updatedBy === inc.updatedBy) &&
        loc.updatedBy === ctx.thisDevice &&
        loc.updatedAt > ctx.lastSyncAt &&
        inc.updatedBy === ctx.incomingDevice &&
        inc.updatedAt > ctx.lastSyncAt
      ) {
        res.conflicts.push({ table, key, winner: win ? 'incoming' : 'local', local: loc, incoming: inc });
      }

      if (!win) continue;
      writes.push(win as Row);
      if (!loc) {
        if (!inc.deletedAt) res.added++;
      } else if (inc.deletedAt && !loc.deletedAt) res.deleted++;
      else res.updated++;
    }
    if (writes.length) res.writes[table] = writes;
  }
  return res;
}
