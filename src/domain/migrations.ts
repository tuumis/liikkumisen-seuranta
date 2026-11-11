// Skeemamigraatiot (SPEC 10, "Tietokannan versiohallinta").
// Jokainen migraatio on puhdas funktio migrateVnToVn1(data). Samaa funktiota
// käyttävät sekä Dexien upgrade() että vanhan varmuuskopion tuonti.
// Versio 1 on lähtötaso, joten migraatioita ei vielä ole.

export const CURRENT_SCHEMA_VERSION = 1;

export const SYNCED_TABLES = [
  'profiles',
  'activityTypes',
  'estimates',
  'templateItems',
  'plannedSessions',
  'sessions',
  'footballDetails',
  'dayFlags',
  'settings',
] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];

export type TableData = Record<string, unknown[]>;

type Migration = (data: TableData) => TableData;

/** MIGRATIONS[n] muuntaa version n datan versioksi n + 1. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = Object.freeze({});

/** Ajaa ketjun fromVersion → CURRENT_SCHEMA_VERSION. */
export function migrateToCurrent(data: TableData, fromVersion: number): TableData {
  if (!Number.isInteger(fromVersion) || fromVersion < 1) throw new Error(`Tuntematon skeemaversio ${fromVersion}`);
  if (fromVersion > CURRENT_SCHEMA_VERSION) throw new Error('Päivitä sovellus tällä laitteella ensin');
  let out = data;
  for (let v = fromVersion; v < CURRENT_SCHEMA_VERSION; v++) {
    const m = MIGRATIONS[v];
    if (!m) throw new Error(`Migraatio v${v} → v${v + 1} puuttuu`);
    out = m(out);
  }
  return out;
}
