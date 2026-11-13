// Dexie-skeema (SPEC 6). Olemassa olevaa db.version(n)-määrittelyä ei koskaan
// muuteta: muutos on aina uusi versio, jossa on upgrade() (SPEC 10).
//
// Versio 1 = SPECin skeema + updatedAt-indeksi jokaiseen synkronoitavaan
// tauluun (SPEC 6: "Dexie-skeemaan lisätään jokaiseen synkronoitavaan tauluun
// indeksi updatedAt"). Huom: IndexedDB ei indeksoi boolean-arvoja, joten
// indeksejä `archived` ja `active` ei käytetä hakuihin; repositoriot suodattavat
// ne muistissa.

import { Dexie, type EntityTable } from 'dexie';
import type {
  ActivityType,
  Club,
  DayFlag,
  Estimate,
  Fixture,
  FootballDetails,
  MetaRow,
  PlannedSession,
  Profile,
  Session,
  SettingsRow,
  Team,
  TemplateItem,
} from '../domain/types';

export const DB_NAME = 'liikkumisseuranta';

export class AppDB extends Dexie {
  profiles!: EntityTable<Profile, 'id'>;
  activityTypes!: EntityTable<ActivityType, 'id'>;
  estimates!: EntityTable<Estimate, 'id'>;
  templateItems!: EntityTable<TemplateItem, 'id'>;
  plannedSessions!: EntityTable<PlannedSession, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  footballDetails!: EntityTable<FootballDetails, 'sessionId'>;
  dayFlags!: EntityTable<DayFlag, 'id'>;
  settings!: EntityTable<SettingsRow, 'id'>;
  teams!: EntityTable<Team, 'id'>;
  fixtures!: EntityTable<Fixture, 'plannedSessionId'>;
  clubs!: EntityTable<Club, 'id'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores({
      profiles: 'id, archived, sortOrder, updatedAt',
      activityTypes: 'id, &key, category, archived, updatedAt',
      estimates: 'id, profileId, [profileId+category], updatedAt',
      templateItems: 'id, profileId, active, updatedAt',
      plannedSessions: 'id, profileId, status, [profileId+date], &[templateItemId+date], updatedAt',
      sessions: 'id, activityTypeId, [profileId+date], &plannedSessionId, updatedAt',
      footballDetails: 'sessionId, updatedAt',
      dayFlags: 'id, &[profileId+date], updatedAt',
      settings: 'id, updatedAt',
      meta: 'key',
    });
    // Versio 2: joukkueet ja pelikalenteri. Uudet taulut alkavat tyhjinä, joten upgrade ei muuta
    // olemassa olevaa dataa (migrateV1ToV2 tekee saman varmuuskopion tuonnissa).
    this.version(2)
      .stores({
        teams: 'id, profileId, updatedAt',
        fixtures: 'plannedSessionId, updatedAt',
      })
      .upgrade(async (tx) => {
        await tx.table('meta').put({ key: 'schemaVersion', value: 2 });
      });
    // Versio 3: seurat (logot joukkuekirjastoon). Uusi taulu alkaa tyhjänä (migrateV2ToV3).
    this.version(3)
      .stores({ clubs: 'id, updatedAt' })
      .upgrade(async (tx) => {
        await tx.table('meta').put({ key: 'schemaVersion', value: 3 });
      });
  }
}

export const db = new AppDB();
