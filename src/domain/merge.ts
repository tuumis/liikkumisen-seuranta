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

/**
 * Kentät, joiden ero ei ole käyttäjälle näytettävä ristiriita (esim. viikkokoosteen sulkeminen
 * kummallakin laitteella): jos versiot eroavat vain näissä, voittaja valitaan tavalliseen tapaan
 * ja suurempi arvo säilyy.
 */
const SOFT_FIELDS: Partial<Record<SyncedTable, string[]>> = { profiles: ['digestSeenWeek'] };
const SYNC_META = new Set(['updatedAt', 'updatedBy']);

function onlySoftDiff(table: SyncedTable, a: Row, b: Row): boolean {
  const soft = SOFT_FIELDS[table];
  if (!soft) return false;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (SYNC_META.has(k) || soft.includes(k)) continue;
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) return false;
  }
  return true;
}

/** Pehmeät kentät voittajaan: suurempi arvo kummastakin versiosta (ISO-päivät vertautuvat merkkijonoina). */
function withSoftMax(table: SyncedTable, win: Row, other: Row | undefined): Row {
  const soft = SOFT_FIELDS[table];
  if (!soft || !other) return win;
  let out = win;
  for (const k of soft) {
    const o = other[k] as string | undefined;
    if (o !== undefined && (win[k] === undefined || o > (win[k] as string))) out = { ...out, [k]: o };
  }
  return out;
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
        inc.updatedAt > ctx.lastSyncAt &&
        !onlySoftDiff(table, loc, inc)
      ) {
        res.conflicts.push({ table, key, winner: win ? 'incoming' : 'local', local: loc, incoming: inc });
      }

      if (!win) {
        // Paikallinen pysyy, mutta toisen laitteen pehmeä kenttä (esim. suljettu kooste) otetaan mukaan.
        const kept = loc && withSoftMax(table, loc, inc);
        if (kept && kept !== loc) writes.push(kept);
        continue;
      }
      writes.push(withSoftMax(table, win as Row, loc));
      if (!loc) {
        if (!inc.deletedAt) res.added++;
      } else if (inc.deletedAt && !loc.deletedAt) res.deleted++;
      else res.updated++;
    }
    if (writes.length) res.writes[table] = writes;
  }
  return res;
}
