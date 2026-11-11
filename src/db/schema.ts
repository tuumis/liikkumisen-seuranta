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
  DayFlag,
  Estimate,
  FootballDetails,
  MetaRow,
  PlannedSession,
  Profile,
  Session,
  SettingsRow,
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
  }
}

export const db = new AppDB();
