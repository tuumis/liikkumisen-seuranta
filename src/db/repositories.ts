// Repositoriokerros. Käyttöliittymä ja analytiikka eivät koskaan lue tauluja
// suoraan: poistomerkityt tietueet suodatetaan aina pois, ja jokainen muutos
// päivittää synkronointikentät (updatedAt, updatedBy). Poisto on poistomerkintä.

import { Dexie, type Table } from 'dexie';
import { CURRENT_SCHEMA_VERSION } from '../domain/migrations';
import { activityTypeId, dayFlagId, newId, sessionIdFromPlanned, SETTINGS_ID } from '../domain/ids';
import { computeSessionMinutes, DEFAULT_GAME_WARMUP_MIN, DEFAULT_PLAY_SHARE, INTENSITY_PRESETS, roundMinutes } from '../domain/intensity';
import { defaultGameLength } from '../domain/tournamentTime';
import { DEFAULT_SETTINGS } from '../domain/recommendations';
import { addDays, isISODate } from '../domain/dates';
import { holidayOn } from '../domain/holidays';
import { activeEstimate, ESTIMATE_ONLY_CATEGORIES, isEstimateConfirmation } from '../domain/aggregate';
import { clubIdOf, clubKey, formatTeamName, parseTeamName, squadKey, type TeamParts } from '../domain/opponent';
import type {
  ActivityType,
  Category,
  DayFlag,
  DayFlagReason,
  DeviceId,
  Effort,
  Estimate,
  Fixture,
  FocusTag,
  FootballDetails,
  Club,
  GameLevel,
  GameResult,
  HHmm,
  IntensityMinutes,
  IntensityPreset,
  IntensityShares,
  PlayedState,
  ISODate,
  PlannedSession,
  Profile,
  Session,
  Settings,
  SettingsRow,
  SkipReason,
  SyncFields,
  FieldPosition,
  GameFormat,
  ScheduledGame,
  Team,
  TemplateItem,
  Timestamp,
  UUID,
  Weekday,
} from '../domain/types';
import { isGameFormat, LEVEL_EFFORT, POSITIONS } from '../domain/football';
import { BUILT_IN_ACTIVITY_TYPES } from '../seed/activityTypes';
import { nowTimestamp } from './clock';
import { createPlanner } from './ensurePlanned';
import { AppDB, db as defaultDb } from './schema';

export { nowTimestamp };

const live = <T extends Partial<SyncFields>>(rows: T[]): T[] => rows.filter((r) => !r.deletedAt);

export type DeviceRole = 'pc' | 'phone';

/** Kerran tallennettavat tiedot (pikalisäys ja muokkaus). */
export interface SessionInput {
  activityTypeId: UUID;
  date: ISODate;
  startTime?: HHmm;
  durationMin: number;
  playedMin?: number;
  /** Peli ja turnaus: lämmittely (min) ja peliaika-arvio (osuus); puuttuessa säilyy entinen tai oletus. */
  warmupMin?: number;
  playShare?: number;
  effort: Effort;
  /** Käsin syötetyt minuutit; puuttuu → lasketaan tehoprofiilista. */
  manual?: IntensityMinutes;
  /** Tehon esiasetus ("enimmäkseen kevyttä/reipasta/rasittavaa"); ponnistelukerrointa ei käytetä. */
  intensityPreset?: IntensityPreset;
  muscle: boolean;
  bone: boolean;
  note?: string;
  /** Tarkenne (esim. "Talenttitreeni"), enintään 40 merkkiä. */
  label?: string;
  /** Arkiliikunnan vahvistus päiväkohtaisesti (säilyy muokattaessa). */
  estimateConfirmed?: boolean;
}

/** Jalkapallon lisätietojen tallennettavat tiedot (kaikki valinnaisia osallistumista lukuun ottamatta). */
export interface FootballDetailsInput {
  attendance: 'full' | 'partial';
  focusTags: FocusTag[];
  team?: string;
  parentRating?: 1 | 2 | 3 | 4 | 5;
  enjoyment?: 1 | 2 | 3;
  ratingNote?: string;
  /** Peli: vastustaja ja tulos. */
  opponent?: string;
  goalsFor?: number;
  goalsAgainst?: number;
  /** Turnaus. */
  eventName?: string;
  gamesCount?: number;
  games?: GameResult[];
  /** Pelin tai turnauksen pelatut minuutit (laskentapohja); turnauksessa pelirivien summa voittaa. */
  playedMin?: number;
  /** Oma joukkue (linkki) ja taso; taso säätää ponnistelun (Elite kovempi, Haaste kevyempi). */
  teamId?: UUID;
  level?: GameLevel;
  /** Oman lapsen maalit (peli; turnaus ilman pelirivejä). Pelirivien pelaajan maalit summataan. */
  playerGoals?: number;
  format?: GameFormat;
  positions?: FieldPosition[];
  /** Peli: pelasiko (ei / osan / koko pelin). */
  played?: PlayedState;
}

/** Tulevan pelin tai turnauksen tiedot (pelikalenteri). */
export interface FixtureInput {
  kind: 'game' | 'tournament';
  date: ISODate;
  startTime?: HHmm;
  durationMin: number;
  teamId?: UUID;
  opponent?: string;
  eventName?: string;
  location?: string;
  level?: GameLevel;
  gamesCount?: number;
  /** Turnauksen otteluohjelma. */
  games?: ScheduledGame[];
  format?: GameFormat;
  /** Turnauksen kesto otteluohjelmasta: yhden pelin pituus (min); puuttuessa pelimuodon oletus. */
  gameLengthMin?: number;
  /** Lämmittely ennen jokaista peliä (min); puuttuessa 15. */
  warmupMin?: number;
  /** Loppuverryttely viimeisen pelin jälkeen (min); puuttuessa 0. */
  cooldownMin?: number;
  /** Kesto annettu käsin (ei lasketa otteluohjelmasta). */
  durationManual?: boolean;
  note?: string;
}

export interface FixtureEntry {
  plan: PlannedSession;
  fixture?: Fixture;
}

/** Perusarvion tallennettavat tiedot. */
export interface EstimateInput {
  category: Category;
  label: string;
  weekdayMin: number;
  weekendMin: number;
  shares: IntensityShares;
}

/** Viikkopohjan rivin tallennettavat tiedot. */
export interface TemplateItemInput {
  activityTypeId: UUID;
  weekdays: Weekday[];
  startTime?: HHmm;
  durationMin: number;
  validFrom: ISODate;
  validTo?: ISODate;
  note?: string;
  label?: string;
}

/** Poistetun kerran ja siihen liittyneiden tietueiden aiemmat versiot. */
export interface DeleteUndo {
  session: Session;
  football?: FootballDetails;
  plan?: PlannedSession;
}

/** Tarkenne siistittynä (välilyönnit, enintään 40 merkkiä); tyhjä → undefined. */
const cleanLabel = (s?: string) => s?.trim().replace(/\s+/g, ' ').slice(0, 40) || undefined;

export function createRepositories(db: AppDB = defaultDb) {
  // ---------- meta (laitekohtainen) ----------
  async function getMeta<T>(key: string): Promise<T | undefined> {
    return (await db.meta.get(key))?.value as T | undefined;
  }
  async function setMeta(key: string, value: unknown): Promise<void> {
    await db.meta.put({ key, value });
  }

  /** Laitteen tunniste; luodaan ensikäynnistyksessä. */
  async function deviceId(): Promise<DeviceId> {
    return db.transaction('rw', db.meta, async () => {
      const existing = await getMeta<DeviceId>('deviceId');
      if (existing) return existing;
      const id = newId();
      await setMeta('deviceId', id);
      return id;
    });
  }

  async function stamp<T extends object>(row: T): Promise<T & Pick<SyncFields, 'updatedAt' | 'updatedBy'>> {
    return { ...row, updatedAt: nowTimestamp(), updatedBy: await deviceId() };
  }

  /** Poistomerkintä: asettaa deletedAt ja päivittää updatedAt. */
  async function softDelete<T extends SyncFields, K>(table: Table<T, K>, key: K): Promise<void> {
    const by = await deviceId();
    const ts = nowTimestamp();
    await table.update(key as never, { deletedAt: ts, updatedAt: ts, updatedBy: by } as never);
  }

  // ---------- käynnistys ----------

  /**
   * Ensikäynnistys ja siemendata: laitetunniste, skeemaversio ja
   * sisäänrakennetut lajit. Idempotentti: olemassa olevia (myös käyttäjän
   * muokkaamia) lajeja ei ylikirjoiteta.
   */
  async function initialize(): Promise<void> {
    await deviceId();
    await db.transaction('rw', db.meta, db.activityTypes, async () => {
      await setMeta('schemaVersion', CURRENT_SCHEMA_VERSION);
      const existing = await db.activityTypes.bulkGet(BUILT_IN_ACTIVITY_TYPES.map((t) => t.id));
      const missing = BUILT_IN_ACTIVITY_TYPES.filter((_, i) => !existing[i]).map((t) => ({
        ...t,
        shares: { ...t.shares },
      }));
      if (missing.length) await db.activityTypes.bulkAdd(missing);
    });
  }

  // ---------- profiilit ----------

  async function listProfiles(opts: { includeArchived?: boolean } = {}): Promise<Profile[]> {
    const rows = live(await db.profiles.orderBy('sortOrder').toArray());
    return opts.includeArchived ? rows : rows.filter((p) => !p.archived);
  }

  type ProfileInput = Pick<Profile, 'name' | 'kind' | 'birthYear' | 'birthMonth' | 'color'> &
    Partial<Pick<Profile, 'schoolStart' | 'groupOverride' | 'trackingStart' | 'photo'>>;

  async function createProfile(input: ProfileInput): Promise<Profile> {
    const all = await db.profiles.toArray();
    const ts = nowTimestamp();
    const profile: Profile = {
      ...input,
      id: newId(),
      sortOrder: all.reduce((m, p) => Math.max(m, p.sortOrder + 1), 0),
      archived: false,
      createdAt: ts,
      updatedAt: ts,
      updatedBy: await deviceId(),
    };
    await db.profiles.add(profile);
    return profile;
  }

  async function updateProfile(id: string, changes: Partial<ProfileInput>): Promise<void> {
    const current = await db.profiles.get(id);
    if (!current || current.deletedAt) throw new Error('Profiilia ei löydy');
    const next: Profile = await stamp({ ...current, ...changes });
    // Valinnaisten kenttien tyhjennys: undefined poistaa kentän.
    for (const k of ['schoolStart', 'groupOverride', 'trackingStart', 'photo'] as const) {
      if (k in changes && changes[k] === undefined) delete next[k];
    }
    await db.profiles.put(next);
  }

  async function setProfileArchived(id: string, archived: boolean): Promise<void> {
    const current = await db.profiles.get(id);
    if (!current) return;
    await db.profiles.put(await stamp({ ...current, archived }));
  }

  // ---------- liikkumismuodot ----------

  async function listActivityTypes(opts: { includeArchived?: boolean } = {}): Promise<ActivityType[]> {
    const rows = live(await db.activityTypes.toArray()).sort((a, b) => a.sortOrder - b.sortOrder);
    return opts.includeArchived ? rows : rows.filter((t) => !t.archived);
  }

  async function getActivityType(id: string): Promise<ActivityType> {
    const t = await db.activityTypes.get(id);
    if (!t || t.deletedAt) throw new Error('Lajia ei löydy');
    return t;
  }

  /**
   * Lajin tehoprofiilin ja vahvistavien oletusten muokkaus. Vanhat kerrat eivät muutu,
   * koska niillä on oma sharesSnapshot (SPEC 5, B5).
   */
  async function updateActivityType(
    id: UUID,
    changes: Partial<Pick<ActivityType, 'shares' | 'muscleDefault' | 'boneDefault'>>,
  ): Promise<ActivityType> {
    const current = await getActivityType(id);
    const next = await stamp({ ...current, ...changes, shares: { ...(changes.shares ?? current.shares) } });
    await db.activityTypes.put(next);
    return next;
  }

  /** Sisäänrakennetun lajin lähtöoletukset (SPEC 5 taulukko). */
  async function restoreActivityTypeDefaults(id: UUID): Promise<ActivityType> {
    const seed = BUILT_IN_ACTIVITY_TYPES.find((t) => t.id === id);
    if (!seed) throw new Error('Lajilla ei ole lähtöoletusta');
    return updateActivityType(id, { shares: { ...seed.shares }, muscleDefault: seed.muscleDefault, boneDefault: seed.boneDefault });
  }

  /** Kerrat, joihin "Laske uudelleen" vaikuttaisi: lajin profiililla lasketut, päivä ≥ from. */
  async function recalculableSessions(typeId: UUID, from: ISODate): Promise<Session[]> {
    const rows = live(await db.sessions.where('activityTypeId').equals(typeId).toArray());
    return rows.filter((s) => s.date >= from && s.intensitySource === 'profile' && !s.intensityPreset);
  }

  /**
   * "Laske uudelleen" (SPEC 5): valitun lajin kerrat alkaen päivästä `from` lasketaan lajin
   * nykyisellä profiililla. Ei koske käsin syötettyjä eikä esiasetuksella kirjattuja kertoja.
   */
  async function recalculateSessions(typeId: UUID, from: ISODate): Promise<number> {
    return db.transaction('rw', db.sessions, db.activityTypes, db.meta, async () => {
      const type = await getActivityType(typeId);
      const rows = await recalculableSessions(typeId, from);
      const warmupShares = await warmupSharesFor(type);
      for (const s of rows) {
        const r = computeSessionMinutes(type, { durationMin: s.durationMin, playedMin: s.playedMin, effort: s.effort, warmupMin: s.warmupMin, playShare: s.playShare, warmupShares });
        await db.sessions.put(await stamp({ ...s, minutes: r.minutes, sharesSnapshot: r.snapshot }));
      }
      return rows.length;
    });
  }

  // ---------- liikkumiskerrat (kerros 3) ----------

  /** Profiilin kerrat päiviltä from–to (mukaan luettuina). */
  async function sessionsInRange(profileId: UUID, from: ISODate, to: ISODate): Promise<Session[]> {
    const rows = await db.sessions
      .where('[profileId+date]')
      .between([profileId, from], [profileId, to], true, true)
      .toArray();
    return live(rows).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  }

  /** Viimeksi käytetyt lajit (uusin kirjaus ensin), enintään n kpl. */
  /** Lajille aiemmin käytetyt tarkenteet (uusin ensin, myös viikkopohjasta), ehdotuksiksi. */
  async function recentLabels(profileId: UUID, activityTypeId: UUID, n = 8): Promise<string[]> {
    const sessions = live(await db.sessions.where('[profileId+date]').between([profileId, Dexie.minKey], [profileId, Dexie.maxKey]).toArray())
      .filter((s) => s.activityTypeId === activityTypeId && s.label)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const items = live(await db.templateItems.where('profileId').equals(profileId).toArray()).filter((i) => i.activityTypeId === activityTypeId && i.label);
    const out: string[] = [];
    for (const l of [...items.map((i) => i.label!), ...sessions.map((s) => s.label!)]) {
      if (!out.some((x) => x.toLocaleLowerCase('fi') === l.toLocaleLowerCase('fi'))) out.push(l);
      if (out.length >= n) break;
    }
    return out;
  }

  async function recentActivityTypeIds(profileId: UUID, n = 6): Promise<UUID[]> {
    const rows = live(
      await db.sessions.where('[profileId+date]').between([profileId, Dexie.minKey], [profileId, Dexie.maxKey]).toArray(),
    ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const out: UUID[] = [];
    for (const s of rows) {
      if (!out.includes(s.activityTypeId)) out.push(s.activityTypeId);
      if (out.length >= n) break;
    }
    return out;
  }

  /**
   * Minuutit kerralle. Muokkauksessa käytetään kerran omaa profiilia
   * (sharesSnapshot), jotta lajin oletusprofiilin muutos ei muuta mennyttä;
   * jos laji vaihtuu, käytetään uuden lajin profiilia.
   */
  function sessionIntensity(
    type: ActivityType,
    input: SessionInput,
    existing?: Session,
    warmupShares?: IntensityShares,
  ): Pick<Session, 'intensitySource' | 'minutes' | 'sharesSnapshot' | 'intensityPreset'> {
    if (input.intensityPreset && !input.manual) {
      const r = computeSessionMinutes({ ...type, shares: INTENSITY_PRESETS[input.intensityPreset] }, { ...input, effort: 0, warmupShares });
      return { intensitySource: 'profile', minutes: r.minutes, sharesSnapshot: r.snapshot, intensityPreset: input.intensityPreset };
    }
    const keepSnapshot = existing && existing.activityTypeId === type.id && existing.sharesSnapshot && !existing.intensityPreset;
    const shares = keepSnapshot ? existing.sharesSnapshot! : type.shares;
    const r = computeSessionMinutes({ ...type, shares }, { ...input, warmupShares });
    return input.manual
      ? { intensitySource: 'manual', minutes: r.minutes }
      : { intensitySource: 'profile', minutes: r.minutes, sharesSnapshot: r.snapshot };
  }

  /** Lämmittelyn teho peliin ja turnaukseen: jalkapallotreenin profiili (käyttäjän muokattavissa). */
  async function warmupSharesFor(type: ActivityType): Promise<IntensityShares | undefined> {
    if (!type.usesPlayedMinutes) return undefined;
    const t = await db.activityTypes.get(activityTypeId('football_training'));
    return t && !t.deletedAt ? t.shares : undefined;
  }

  /** Pelin ja turnauksen lämmittely ja peliaika-arvio kerralle (vain lajeille, joilla pelatut minuutit). */
  function setFootballTiming(s: Session, type: ActivityType, warmupMin?: number, playShare?: number) {
    delete s.warmupMin;
    delete s.playShare;
    if (!type.usesPlayedMinutes) return;
    if (warmupMin !== undefined && Number.isFinite(warmupMin) && warmupMin >= 0) s.warmupMin = Math.round(warmupMin);
    if (playShare !== undefined && Number.isFinite(playShare) && playShare > 0 && playShare <= 1) s.playShare = playShare;
  }

  async function createSession(input: SessionInput & { profileId: UUID }): Promise<Session> {
    const type = await getActivityType(input.activityTypeId);
    const warmupShares = await warmupSharesFor(type);
    const ts = nowTimestamp();
    const session: Session = {
      id: newId(),
      profileId: input.profileId,
      activityTypeId: type.id,
      date: input.date,
      durationMin: input.durationMin,
      effort: input.effort,
      muscle: input.muscle,
      bone: input.bone,
      ...sessionIntensity(type, input, undefined, warmupShares),
      createdAt: ts,
      updatedAt: ts,
      updatedBy: await deviceId(),
    };
    if (type.usesPlayedMinutes && input.playedMin !== undefined) session.playedMin = input.playedMin;
    setFootballTiming(session, type, input.warmupMin, input.playShare);
    if (input.startTime) session.startTime = input.startTime;
    if (input.note?.trim()) session.note = input.note.trim();
    const label = cleanLabel(input.label);
    if (label) session.label = label;
    if (input.estimateConfirmed) session.estimateConfirmed = true;
    await db.sessions.add(session);
    return session;
  }

  async function updateSession(id: UUID, input: SessionInput): Promise<Session> {
    return db.transaction('rw', db.sessions, db.activityTypes, db.meta, async () => {
      const current = await db.sessions.get(id);
      if (!current || current.deletedAt) throw new Error('Kertaa ei löydy');
      const type = await getActivityType(input.activityTypeId);
      const warmupShares = await warmupSharesFor(type);
      // Lämmittely ja peliaika-arvio säilyvät, ellei niitä anneta (esim. lisätietojen tallennus).
      const eff: SessionInput = { ...input, warmupMin: input.warmupMin ?? current.warmupMin, playShare: input.playShare ?? current.playShare };
      const next: Session = await stamp({ ...current });
      for (const k of ['playedMin', 'sharesSnapshot', 'intensityPreset', 'note', 'startTime', 'label'] as const) delete next[k];
      Object.assign(next, {
        activityTypeId: type.id,
        date: input.date,
        durationMin: input.durationMin,
        effort: input.effort,
        muscle: input.muscle,
        bone: input.bone,
        ...sessionIntensity(type, eff, current, warmupShares),
      });
      if (type.usesPlayedMinutes && input.playedMin !== undefined) next.playedMin = input.playedMin;
      setFootballTiming(next, type, eff.warmupMin, eff.playShare);
      if (input.startTime) next.startTime = input.startTime;
      if (input.note?.trim()) next.note = input.note.trim();
      const label = cleanLabel(input.label);
      if (label) next.label = label;
      await db.sessions.put(next);
      return next;
    });
  }

  /**
   * Kerran poisto (poistomerkintä). Samassa transaktiossa jalkapallon
   * lisätiedot poistuvat ja linkitetty suunnitelma palaa tilaan open.
   * Palauttaa kumoamistiedon (aiemmat versiot), jolla undoDelete palauttaa tilan.
   */
  async function deleteSession(id: UUID): Promise<DeleteUndo> {
    return db.transaction('rw', [db.sessions, db.footballDetails, db.plannedSessions, db.meta], async () => {
      const session = await db.sessions.get(id);
      if (!session || session.deletedAt) throw new Error('Kertaa ei löydy');
      const football = await db.footballDetails.get(id);
      const planId = session.plannedSessionId;
      const plan = planId ? await db.plannedSessions.get(planId) : undefined;
      const by = await deviceId();
      const ts = nowTimestamp();
      await db.sessions.put({ ...session, deletedAt: ts, updatedAt: ts, updatedBy: by });
      if (football && !football.deletedAt) {
        await db.footballDetails.put({ ...football, deletedAt: ts, updatedAt: ts, updatedBy: by });
      }
      if (plan && !plan.deletedAt && plan.sessionId === id) {
        const reopened: PlannedSession = { ...plan, status: 'open', updatedAt: ts, updatedBy: by };
        delete reopened.sessionId;
        delete reopened.skipReason;
        await db.plannedSessions.put(reopened);
      }
      return {
        session,
        football: football && !football.deletedAt ? football : undefined,
        plan: plan && !plan.deletedAt && plan.sessionId === id ? plan : undefined,
      };
    });
  }

  /** Kumoaa poiston: palauttaa aiemmat sisällöt uusin muokkausajoin. */
  async function undoDelete(undo: DeleteUndo): Promise<void> {
    await db.transaction('rw', [db.sessions, db.footballDetails, db.plannedSessions, db.meta], async () => {
      const restore = async <T extends SyncFields>(row: T): Promise<T> => {
        const r = await stamp(row);
        delete r.deletedAt;
        return r;
      };
      await db.sessions.put(await restore(undo.session));
      if (undo.football) await db.footballDetails.put(await restore(undo.football));
      if (undo.plan) await db.plannedSessions.put(await restore(undo.plan));
    });
  }

  // ---------- viikkopohja ja suunnitelmat (kerros 2) ----------

  const planner = createPlanner(db, deviceId);
  const PLAN_TABLES = [db.templateItems, db.plannedSessions, db.meta];

  async function listTemplateItems(profileId: UUID): Promise<TemplateItem[]> {
    const rows = live(await db.templateItems.where('profileId').equals(profileId).toArray()).filter((i) => i.active);
    return rows.sort(
      (a, b) =>
        Math.min(...a.weekdays) - Math.min(...b.weekdays) ||
        (a.startTime ?? '99').localeCompare(b.startTime ?? '99') ||
        a.createdAt.localeCompare(b.createdAt),
    );
  }

  function applyTemplateInput(item: TemplateItem, input: TemplateItemInput): TemplateItem {
    const next: TemplateItem = {
      ...item,
      activityTypeId: input.activityTypeId,
      weekdays: [...new Set(input.weekdays)].sort((a, b) => a - b) as Weekday[],
      durationMin: input.durationMin,
      validFrom: input.validFrom,
    };
    for (const k of ['startTime', 'validTo', 'note', 'label'] as const) delete next[k];
    if (input.startTime) next.startTime = input.startTime;
    if (input.validTo) next.validTo = input.validTo;
    if (input.note?.trim()) next.note = input.note.trim();
    const label = cleanLabel(input.label);
    if (label) next.label = label;
    return next;
  }

  /** Uusi pohjarivi; sen suunnitelmat luodaan heti tästä päivästä eteenpäin (vahvistettu tulkinta). */
  async function createTemplateItem(profileId: UUID, input: TemplateItemInput, today: ISODate): Promise<TemplateItem> {
    return db.transaction('rw', PLAN_TABLES, async () => {
      const ts = nowTimestamp();
      const base: TemplateItem = {
        id: newId(),
        profileId,
        activityTypeId: input.activityTypeId,
        weekdays: [],
        durationMin: 0,
        validFrom: input.validFrom,
        active: true,
        createdAt: ts,
        updatedAt: ts,
        updatedBy: await deviceId(),
      };
      const item = applyTemplateInput(base, input);
      await db.templateItems.add(item);
      await planner.regenerateItem(item, today);
      return item;
    });
  }

  /** Pohjarivin menneet kerrat kuitattaviksi (alkupäivästä eiliseen, enintään 12 vk). */
  async function backfillTemplateItem(id: UUID, today: ISODate): Promise<number> {
    return db.transaction('rw', PLAN_TABLES, async () => {
      const item = await db.templateItems.get(id);
      if (!item) return 0;
      return planner.backfillItem(item, item.validFrom, today);
    });
  }

  /** Muokkaus koskee vain tulevia avoimia suunnitelmia (B2). */
  async function updateTemplateItem(id: UUID, input: TemplateItemInput, today: ISODate): Promise<TemplateItem> {
    return db.transaction('rw', PLAN_TABLES, async () => {
      const current = await db.templateItems.get(id);
      if (!current || current.deletedAt || !current.active) throw new Error('Pohjariviä ei löydy');
      const item = await stamp(applyTemplateInput(current, input));
      await db.templateItems.put(item);
      await planner.regenerateItem(item, today);
      return item;
    });
  }

  /** Poisto: active = false (vanhat linkit säilyvät); tulevat avoimet suunnitelmat poistuvat. */
  /** Poistaa viikkopohjan rivin käytöstä; palauttaa poistuneiden tulevien kertojen tunnisteet kumoamista varten. */
  async function deleteTemplateItem(id: UUID, today: ISODate): Promise<UUID[]> {
    return db.transaction('rw', PLAN_TABLES, async () => {
      const current = await db.templateItems.get(id);
      if (!current) return [];
      const before = live(await db.plannedSessions.where('profileId').equals(current.profileId).toArray()).filter((p) => p.templateItemId === id && p.date >= today);
      const item = await stamp({ ...current, active: false });
      await db.templateItems.put(item);
      await planner.regenerateItem(item, today);
      const after = await db.plannedSessions.bulkGet(before.map((p) => p.id));
      return before.filter((_, i) => after[i]?.deletedAt).map((p) => p.id);
    });
  }

  /** Kumoaa rivin poiston: rivi takaisin käyttöön ja poistuneet kerrat (myös yksittäin muutetut) ennalleen. */
  async function restoreTemplateItem(id: UUID, today: ISODate, planIds: UUID[] = []): Promise<void> {
    await db.transaction('rw', PLAN_TABLES, async () => {
      const current = await db.templateItems.get(id);
      if (!current) return;
      const item = await stamp({ ...current, active: true });
      await db.templateItems.put(item);
      for (const p of await db.plannedSessions.bulkGet(planIds)) {
        if (!p?.deletedAt) continue;
        const next = await stamp({ ...p });
        delete next.deletedAt;
        await db.plannedSessions.put(next);
      }
      await planner.regenerateItem(item, today);
    });
  }

  async function plansInRange(profileId: UUID, from: ISODate, to: ISODate): Promise<PlannedSession[]> {
    const rows = await db.plannedSessions
      .where('[profileId+date]')
      .between([profileId, from], [profileId, to], true, true)
      .toArray();
    return live(rows).sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '99').localeCompare(b.startTime ?? '99'));
  }

  /** Kuittaamattomat: open ja päivä < tänään. */
  async function unconfirmedPlans(profileId: UUID, today: ISODate): Promise<PlannedSession[]> {
    const rows = await db.plannedSessions
      .where('[profileId+date]')
      .between([profileId, Dexie.minKey], [profileId, today], true, false)
      .toArray();
    return live(rows)
      .filter((p) => p.status === 'open')
      .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '99').localeCompare(b.startTime ?? '99'));
  }

  /**
   * Kuittaus tehdyksi (SPEC 3, 10): luo kerran s:<plannedSessionId> suunnitellulla
   * (tai annetulla) kestolla ja linkittää molempiin suuntiin. Suunnitelman kesto ei muutu.
   * Jos kerta on jo olemassa, uutta ei luoda (B3, F10) vaan palautetaan olemassa oleva
   * muokattavaksi. Poistettu kerta herätetään henkiin samalla tunnisteella.
   */
  async function confirmPlanned(
    planId: UUID,
    today: ISODate,
    opts: { durationMin?: number } = {},
  ): Promise<{ session: Session; created: boolean }> {
    return db.transaction('rw', [db.sessions, db.plannedSessions, db.activityTypes, db.fixtures, db.teams, db.footballDetails, db.meta], async () => {
      const plan = await db.plannedSessions.get(planId);
      if (!plan || plan.deletedAt) throw new Error('Suunnitelmaa ei löydy');
      if (plan.date > today) throw new Error('Tulevaa kertaa ei voi kuitata tehdyksi');
      const fx = await db.fixtures.get(planId);
      const fixture = fx && !fx.deletedAt ? fx : undefined;
      const fixtureTeam = fixture?.teamId ? await db.teams.get(fixture.teamId) : undefined;
      const fixtureLevel = fixture?.level; // taso on tapahtumakohtainen (ei joukkueen oletusta)

      const linked = live(await db.sessions.where('plannedSessionId').equals(planId).toArray())[0];
      if (linked) {
        if (plan.status !== 'done' || plan.sessionId !== linked.id) {
          const fixed = await stamp({ ...plan, status: 'done' as const, sessionId: linked.id });
          delete fixed.skipReason;
          await db.plannedSessions.put(fixed);
        }
        return { session: linked, created: false };
      }

      const type = await getActivityType(plan.activityTypeId);
      const warmupShares = await warmupSharesFor(type);
      const sid = sessionIdFromPlanned(planId);
      const tombstone = await db.sessions.get(sid);
      const liveTeam = fixtureTeam && !fixtureTeam.deletedAt ? fixtureTeam : undefined;
      // Peli ja turnaus: lämmittely ennen jokaista peliä ja joukkueen peliaika-arvio.
      const gamesN = fixture?.games?.length || fixture?.gamesCount || 1;
      const input: SessionInput = {
        activityTypeId: type.id,
        date: plan.date,
        startTime: plan.startTime,
        durationMin: opts.durationMin ?? plan.durationMin,
        effort: fixtureLevel ? LEVEL_EFFORT[fixtureLevel] : 0,
        muscle: type.muscleDefault === 'yes',
        bone: type.boneDefault === 'yes',
        warmupMin: type.usesPlayedMinutes ? gamesN * (fixture?.warmupMin ?? DEFAULT_GAME_WARMUP_MIN) : undefined,
        playShare: type.usesPlayedMinutes ? liveTeam?.playShare : undefined,
      };
      const ts = nowTimestamp();
      const by = await deviceId();
      const session: Session = {
        id: sid,
        profileId: plan.profileId,
        activityTypeId: type.id,
        date: plan.date,
        durationMin: input.durationMin,
        effort: input.effort,
        muscle: input.muscle,
        bone: input.bone,
        ...sessionIntensity(type, input, undefined, warmupShares),
        plannedSessionId: planId,
        createdAt: tombstone?.createdAt ?? ts,
        updatedAt: ts,
        updatedBy: by,
      };
      if (plan.startTime) session.startTime = plan.startTime;
      if (plan.label) session.label = plan.label;
      setFootballTiming(session, type, input.warmupMin, input.playShare);
      await db.sessions.put(session); // put herättää poistomerkityn henkiin
      if (fixture) {
        const existingFd = await db.footballDetails.get(sid);
        if (!existingFd || existingFd.deletedAt) {
          const fd: FootballDetails = { sessionId: sid, attendance: 'full', focusTags: [], updatedAt: ts, updatedBy: by };
          if (fixtureTeam && !fixtureTeam.deletedAt) {
            fd.teamId = fixtureTeam.id;
            fd.team = fixtureTeam.name;
          }
          if (fixtureLevel) fd.level = fixtureLevel;
          const format = fixture.format ?? (fixtureTeam && !fixtureTeam.deletedAt ? fixtureTeam.format : undefined);
          if (format) fd.format = format;
          if (fixture.opponent) fd.opponent = fixture.opponent;
          if (fixture.eventName) fd.eventName = fixture.eventName;
          if (fixture.gamesCount) fd.gamesCount = fixture.gamesCount;
          // Otteluohjelmasta valmiit pelirivit: tulos ja kommentti kirjataan pelien jälkeen.
          if (fixture.games?.length) {
            fd.games = fixture.games.map((g) => ({ ...g }));
            fd.gamesCount = fixture.games.length;
          }
          if (type.footballKind === 'tournament') fd.gameLengthMin = fixture.gameLengthMin ?? defaultGameLength(format);
          await db.footballDetails.put(fd);
        }
      }
      const donePlan: PlannedSession = { ...plan, status: 'done', sessionId: sid, updatedAt: ts, updatedBy: by };
      delete donePlan.skipReason;
      await db.plannedSessions.put(donePlan);
      return { session, created: true };
    });
  }

  /**
   * Turnauspäivän pikakirjaus (SPEC 16): yhden pelin tulos. Suunnitelmasta ensimmäinen tulos kuittaa
   * turnauksen (pelirivit otteluohjelmasta), myöhemmät päivittävät saman kirjauksen pelirivin.
   * Muut lisätiedot (arviot, kommentit, joukkue) säilyvät. Palauttaa kerran ja tiedon, luotiinko se.
   */
  async function recordTournamentGame(
    target: { planId: UUID } | { sessionId: UUID },
    index: number,
    result: GameResult,
    today: ISODate,
  ): Promise<{ sessionId: UUID; created: boolean }> {
    let sessionId: UUID;
    let created = false;
    if ('planId' in target) {
      const r = await confirmPlanned(target.planId, today);
      sessionId = r.session.id;
      created = r.created;
    } else sessionId = target.sessionId;
    const fd = await getFootballDetails(sessionId);
    const games: GameResult[] = (fd?.games ?? []).map((g) => ({ ...g }));
    const n = Math.max(index + 1, fd?.gamesCount ?? 0);
    while (games.length < n) games.push({});
    const merged: GameResult = { ...games[index] };
    for (const [k, v] of Object.entries(result) as [keyof GameResult, never][]) {
      if (v === undefined) delete merged[k];
      else merged[k] = v;
    }
    games[index] = merged;
    await saveFootballDetails(sessionId, {
      attendance: fd?.attendance ?? 'full',
      focusTags: fd?.focusTags ?? [],
      team: fd?.team,
      teamId: fd?.teamId,
      level: fd?.level,
      format: fd?.format,
      positions: fd?.positions,
      parentRating: fd?.parentRating,
      enjoyment: fd?.enjoyment,
      ratingNote: fd?.ratingNote,
      eventName: fd?.eventName,
      games,
    });
    return { sessionId, created };
  }

  /** "Merkitse loput tehdyiksi": kuittaa kaikki; palauttaa luodut kerrat kumoamista varten. */
  async function confirmMany(planIds: UUID[], today: ISODate): Promise<UUID[]> {
    const created: UUID[] = [];
    await db.transaction('rw', [db.sessions, db.plannedSessions, db.activityTypes, db.fixtures, db.teams, db.footballDetails, db.meta], async () => {
      for (const id of planIds) {
        const r = await confirmPlanned(id, today);
        if (r.created) created.push(r.session.id);
      }
    });
    return created;
  }

  /** Kumoaa kuittaukset: kerrat poistuvat ja suunnitelmat palaavat avoimiksi. */
  async function undoConfirm(sessionIds: UUID[]): Promise<void> {
    await db.transaction('rw', [db.sessions, db.footballDetails, db.plannedSessions, db.meta], async () => {
      for (const id of sessionIds) await deleteSession(id);
    });
  }

  /**
   * Yksittäisen suunnitellun kerran muutos (kesto, kellonaika). Vain avoimelle kerralle;
   * merkitään overridden, jotta viikkopohjan myöhempi muokkaus ei palauta alkuperäistä.
   */
  async function updatePlannedOccurrence(planId: UUID, changes: { durationMin: number; startTime?: HHmm }): Promise<PlannedSession> {
    const plan = await db.plannedSessions.get(planId);
    if (!plan || plan.deletedAt) throw new Error('Suunnitelmaa ei löydy');
    if (plan.status !== 'open') throw new Error('Vain avointa suunnitelmaa voi muuttaa');
    const next = await stamp({ ...plan, durationMin: changes.durationMin, overridden: true });
    delete next.startTime;
    if (changes.startTime) next.startTime = changes.startTime;
    await db.plannedSessions.put(next);
    return next;
  }

  /** Ohitus: status skipped ja valinnainen syy. Kuitattua ei ohiteta (poista kerta ensin). */
  async function skipPlanned(planId: UUID, reason?: SkipReason): Promise<void> {
    const plan = await db.plannedSessions.get(planId);
    if (!plan || plan.deletedAt) throw new Error('Suunnitelmaa ei löydy');
    if (plan.status === 'done') throw new Error('Kuitattu kerta: poista kerta ensin');
    const next = await stamp({ ...plan, status: 'skipped' as const });
    delete next.skipReason;
    if (reason) next.skipReason = reason;
    await db.plannedSessions.put(next);
  }

  /** Ohitetun palautus avoimeksi. */
  async function reopenPlanned(planId: UUID): Promise<void> {
    const plan = await db.plannedSessions.get(planId);
    if (!plan || plan.deletedAt || plan.status !== 'skipped') return;
    const next = await stamp({ ...plan, status: 'open' as const });
    delete next.skipReason;
    await db.plannedSessions.put(next);
  }

  // ---------- jalkapallon lisätiedot (1:1 Session) ----------

  async function getFootballDetails(sessionId: UUID): Promise<FootballDetails | undefined> {
    const d = await db.footballDetails.get(sessionId);
    return d && !d.deletedAt ? d : undefined;
  }

  async function footballDetailsFor(sessionIds: UUID[]): Promise<Map<UUID, FootballDetails>> {
    const rows = await db.footballDetails.bulkGet(sessionIds);
    return new Map(rows.filter((d): d is FootballDetails => !!d && !d.deletedAt).map((d) => [d.sessionId, d]));
  }

  /**
   * Lisätietojen tallennus. Turnauksessa pelirivien määrä = gamesCount, ja jos riveille on
   * kirjattu pelatut minuutit, niiden summa on kerran laskentapohja (Session.playedMin), jolloin
   * minuutit lasketaan uudelleen. Pelissä pelatut minuutit tallentuvat kertaan.
   */
  async function saveFootballDetails(sessionId: UUID, input: FootballDetailsInput): Promise<FootballDetails> {
    return db.transaction('rw', [db.footballDetails, db.sessions, db.activityTypes, db.teams, db.meta], async () => {
      const session = await db.sessions.get(sessionId);
      if (!session || session.deletedAt) throw new Error('Kertaa ei löydy');
      const type = await getActivityType(session.activityTypeId);
      if (type.sport !== 'football') throw new Error('Kerta ei ole jalkapalloa');

      const clean = (s?: string) => s?.trim().replace(/\s+/g, ' ') || undefined;
      const num = (n?: number) => (n === undefined || n === null || Number.isNaN(n) ? undefined : n);
      const prev = await db.footballDetails.get(sessionId);
      const d: FootballDetails = await stamp({ sessionId, attendance: input.attendance, focusTags: [...new Set(input.focusTags)] });
      if (prev && !prev.deletedAt && prev.gameLengthMin !== undefined) d.gameLengthMin = prev.gameLengthMin;
      const set = <K extends keyof FootballDetails>(k: K, v: FootballDetails[K] | undefined) => {
        if (v !== undefined) d[k] = v;
      };
      set('team', clean(input.team));
      // Peliaika-arvio: kerran oma (kuittauksesta), muuten valitun joukkueen asetus.
      let playShare = session.playShare;
      if (input.teamId) {
        const team = await db.teams.get(input.teamId);
        if (team && !team.deletedAt) {
          d.teamId = team.id;
          d.team = team.name;
          if (playShare === undefined && type.usesPlayedMinutes) playShare = team.playShare;
        }
      }
      let warmupMin = session.warmupMin;
      if (type.footballKind !== 'training') {
        set('level', input.level);
        if (isGameFormat(input.format)) d.format = input.format;
        const positions = POSITIONS.filter((p) => input.positions?.includes(p));
        if (positions.length) d.positions = positions;
      }
      set('parentRating', input.parentRating);
      set('enjoyment', input.enjoyment);
      set('ratingNote', input.ratingNote?.trim().slice(0, 1000) || undefined); // rivinvaihdot säilyvät (päiväkirja)
      let playedMin = input.playedMin;
      if (type.footballKind === 'game') {
        set('opponent', clean(input.opponent));
        set('goalsFor', num(input.goalsFor));
        set('goalsAgainst', num(input.goalsAgainst));
        set('playerGoals', num(input.playerGoals));
        if (input.played) d.played = input.played;
      }
      if (type.footballKind === 'tournament') {
        set('eventName', clean(input.eventName));
        const games = (input.games ?? []).map((g) => {
          const r: GameResult = {};
          if (clean(g.opponent)) r.opponent = clean(g.opponent);
          if (num(g.goalsFor) !== undefined) r.goalsFor = g.goalsFor;
          if (num(g.goalsAgainst) !== undefined) r.goalsAgainst = g.goalsAgainst;
          if (num(g.playedMin) !== undefined) r.playedMin = g.playedMin;
          if (g.played) r.played = g.played;
          if (num(g.playerGoals) !== undefined) r.playerGoals = g.playerGoals;
          if (g.time) r.time = g.time;
          if (clean(g.location)) r.location = clean(g.location);
          if (g.note?.trim()) r.note = g.note.trim().slice(0, 500);
          return r;
        });
        if (games.length) {
          d.games = games;
          d.gamesCount = games.length; // SPEC 8: kun pelirivejä on, gamesCount = rivien määrä
          // Pelattu aika: tarkat minuutit, muuten Ei = 0, Koko pelin = pelin pituus, Osan / merkitsemätön = peliaika-arvio.
          const len = d.gameLengthMin ?? defaultGameLength(d.format);
          const share = playShare ?? DEFAULT_PLAY_SHARE;
          const perGame = games.map((g) =>
            g.playedMin !== undefined ? g.playedMin : g.played === 'full' ? len : g.played === 'none' ? 0 : g.played === 'part' ? roundMinutes(len * share) : undefined,
          );
          if (perGame.some((m) => m !== undefined)) playedMin = perGame.reduce<number>((a, m) => a + (m ?? roundMinutes(len * share)), 0);
          const withGoals = games.filter((g) => g.playerGoals !== undefined);
          if (withGoals.length) d.playerGoals = withGoals.reduce((a, g) => a + g.playerGoals!, 0);
        } else {
          set('gamesCount', num(input.gamesCount));
          set('playerGoals', num(input.playerGoals));
        }
        // Lämmittely ennen jokaista peliä, jos kerralla ei vielä ole omaa (esim. pikalisäys tai vanha kerta).
        if (warmupMin === undefined && d.gamesCount) warmupMin = d.gamesCount * DEFAULT_GAME_WARMUP_MIN;
      }
      await db.footballDetails.put(d); // put tyhjentää mahdollisen poistomerkinnän

      // Taso säätää ponnistelun profiililla lasketuille kerroille (ei käsin syötetyille eikä esiasetuksille).
      const levelEffort =
        d.level && session.intensitySource === 'profile' && !session.intensityPreset ? LEVEL_EFFORT[d.level] : session.effort;
      const timingChanged = type.usesPlayedMinutes && (warmupMin !== session.warmupMin || playShare !== session.playShare);
      if ((type.usesPlayedMinutes && playedMin !== session.playedMin) || levelEffort !== session.effort || timingChanged) {
        await updateSession(sessionId, {
          activityTypeId: session.activityTypeId,
          date: session.date,
          startTime: session.startTime,
          durationMin: session.durationMin,
          playedMin: type.usesPlayedMinutes ? playedMin : session.playedMin,
          warmupMin,
          playShare,
          effort: levelEffort,
          manual: session.intensitySource === 'manual' ? session.minutes : undefined,
          muscle: session.muscle,
          bone: session.bone,
          note: session.note,
        });
      }
      return d;
    });
  }

  /**
   * Päiväkirjakommentti jalkapallokerralle (FootballDetails.ratingNote). Luo lisätiedot, jos
   * niitä ei vielä ole (osallistuminen oletuksena kokonaan); tyhjä teksti poistaa kommentin.
   */
  async function setFootballNote(sessionId: UUID, note: string): Promise<void> {
    await db.transaction('rw', [db.footballDetails, db.sessions, db.activityTypes, db.meta], async () => {
      const session = await db.sessions.get(sessionId);
      if (!session || session.deletedAt) throw new Error('Kertaa ei löydy');
      if ((await getActivityType(session.activityTypeId)).sport !== 'football') throw new Error('Kerta ei ole jalkapalloa');
      const current = await db.footballDetails.get(sessionId);
      const base: FootballDetails =
        current && !current.deletedAt ? { ...current } : { sessionId, attendance: 'full', focusTags: [], updatedAt: '', updatedBy: '' };
      const next = await stamp(base);
      delete next.deletedAt;
      delete next.ratingNote;
      const text = note.trim();
      if (text) next.ratingNote = text.slice(0, 1000);
      await db.footballDetails.put(next);
    });
  }

  /** Aiemmin kirjatut joukkueet, vastustajat ja turnaukset (uusin ensin; samat nimet yhdistettyinä). */
  async function footballNameSuggestions(profileId: UUID): Promise<{ teams: string[]; opponents: string[]; events: string[] }> {
    const sessions = live(
      await db.sessions.where('[profileId+date]').between([profileId, Dexie.minKey], [profileId, Dexie.maxKey]).toArray(),
    ).sort((a, b) => b.date.localeCompare(a.date));
    const details = await footballDetailsFor(sessions.map((s) => s.id));
    const acc = { teams: new Map<string, string>(), opponents: new Map<string, string>(), events: new Map<string, string>() };
    const add = (m: Map<string, string>, v?: string) => {
      const k = v?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fi');
      if (k && !m.has(k)) m.set(k, v!.trim().replace(/\s+/g, ' '));
    };
    for (const s of sessions) {
      const d = details.get(s.id);
      if (!d) continue;
      add(acc.teams, d.team);
      add(acc.opponents, d.opponent);
      add(acc.events, d.eventName);
      for (const g of d.games ?? []) add(acc.opponents, g.opponent);
    }
    return { teams: [...acc.teams.values()], opponents: [...acc.opponents.values()], events: [...acc.events.values()] };
  }

  // ---------- joukkueet (skeema v2) ----------

  // ---------- seurat ja joukkuekirjasto (skeema v3) ----------

  async function listClubs(): Promise<Club[]> {
    return live(await db.clubs.toArray()).sort((a, b) => a.name.localeCompare(b.name, 'fi'));
  }

  /** Seuran logo (undefined poistaa). Tietue luodaan tarvittaessa; tunniste johdetaan nimestä. */
  async function saveClubLogo(name: string, logo: string | undefined): Promise<Club> {
    const clean = name.replace(/\s+/g, ' ').trim();
    if (!clean) throw new Error('Anna seuran nimi');
    const id = clubIdOf(clean);
    const current = await db.clubs.get(id);
    const next: Club = await stamp({ ...(current && !current.deletedAt ? current : { id, createdAt: nowTimestamp() }), name: clean } as Club);
    delete next.deletedAt;
    if (logo) next.logo = logo;
    else delete next.logo;
    await db.clubs.put(next);
    return next;
  }

  /**
   * Muuttaa joukkueiden nimiä kaikkialla (vastustajat peleissä ja pelikalenterissa, omat joukkueet).
   * `map` palauttaa uudet osat tai null, jos nimi ei kuulu muutokseen. Palauttaa muutettujen nimien määrän.
   */
  async function rewriteTeamNames(map: (p: TeamParts) => TeamParts | null): Promise<number> {
    let n = 0;
    const next = (text: string | undefined): string | undefined => {
      if (!text?.trim()) return text;
      const to = map(parseTeamName(text));
      if (!to) return text;
      const out = formatTeamName(to);
      if (!out || out === text) return text;
      n++;
      return out;
    };
    const games = <G extends { opponent?: string }>(list: G[] | undefined) => list?.map((g) => ({ ...g, opponent: next(g.opponent) }));
    await db.transaction('rw', [db.footballDetails, db.fixtures, db.teams, db.meta], async () => {
      for (const d of live(await db.footballDetails.toArray())) {
        const before = n;
        const row = { ...d, opponent: next(d.opponent), games: games(d.games) };
        if (!d.games) delete row.games;
        if (d.opponent === undefined) delete row.opponent;
        if (n > before) await db.footballDetails.put(await stamp(row));
      }
      for (const f of live(await db.fixtures.toArray())) {
        const before = n;
        const row = { ...f, opponent: next(f.opponent), games: games(f.games) };
        if (!f.games) delete row.games;
        if (f.opponent === undefined) delete row.opponent;
        if (n > before) await db.fixtures.put(await stamp(row));
      }
      for (const t of live(await db.teams.toArray())) {
        const before = n;
        const name = next(t.name)!;
        if (n > before) await db.teams.put(await stamp({ ...t, name }));
      }
    });
    return n;
  }

  /** Seuran uudelleennimeäminen (myös yhdistäminen toiseen seuraan); logo siirtyy, ellei kohteella ole omaa. */
  async function renameClub(from: string, to: string): Promise<number> {
    const target = to.replace(/\s+/g, ' ').trim();
    if (!target) throw new Error('Anna seuran nimi');
    const key = clubKey(from);
    const n = await rewriteTeamNames((p) => (clubKey(p.club) === key ? { ...p, club: target } : null));
    const old = await db.clubs.get(clubIdOf(from));
    if (old && !old.deletedAt) {
      const existing = await db.clubs.get(clubIdOf(target));
      const logo = existing && !existing.deletedAt && existing.logo ? existing.logo : old.logo;
      if (clubIdOf(target) !== old.id) await softDelete(db.clubs, old.id);
      await saveClubLogo(target, logo);
    }
    return n;
  }

  /** Ryhmän ja ikäluokan muutos (esim. väärin jaettu vanha nimi korjataan): kaikki saman ryhmän nimet. */
  async function editSquad(from: TeamParts, to: TeamParts): Promise<number> {
    if (!to.club.trim()) throw new Error('Anna seuran nimi');
    const key = squadKey(from);
    return rewriteTeamNames((p) => (squadKey(p) === key ? to : null));
  }

  /** Pelin kommentti joukkuekirjastosta: turnauksen pelirivi (`index` 1…) tai yksittäisen pelin kommentti. */
  async function setGameComment(sessionId: UUID, index: number | undefined, note: string): Promise<void> {
    const d = await db.footballDetails.get(sessionId);
    if (!d || d.deletedAt) throw new Error('Pelin tietoja ei löydy');
    const text = note.trim();
    const row: FootballDetails = { ...d };
    if (index) {
      const games = [...(d.games ?? [])];
      if (!games[index - 1]) throw new Error('Peliä ei löydy');
      const g = { ...games[index - 1] };
      if (text) g.note = text;
      else delete g.note;
      games[index - 1] = g;
      row.games = games;
    } else if (text) row.ratingNote = text;
    else delete row.ratingNote;
    await db.footballDetails.put(await stamp(row));
  }

  async function listTeams(profileId: UUID, opts: { includeArchived?: boolean } = {}): Promise<Team[]> {
    const rows = live(await db.teams.where('profileId').equals(profileId).toArray());
    return (opts.includeArchived ? rows : rows.filter((t) => !t.archived)).sort((a, b) => a.name.localeCompare(b.name, 'fi'));
  }

  /** `photo`: undefined poistaa kuvan, kenttä puuttuu = kuva ennallaan. */
  async function saveTeam(profileId: UUID, input: { name: string; photo?: string; format?: GameFormat; playShare?: number }, id?: UUID): Promise<Team> {
    const share = input.playShare !== undefined && input.playShare > 0 && input.playShare <= 1 ? input.playShare : undefined;
    const name = input.name.trim().replace(/\s+/g, ' ');
    if (!name) throw new Error('Anna joukkueen nimi');
    if (id) {
      const current = await db.teams.get(id);
      if (!current || current.deletedAt) throw new Error('Joukkuetta ei löydy');
      const next = await stamp({ ...current, name });
      delete next.level; // sarjataso on peli- ja turnauskohtainen (SPEC 16)
      if ('photo' in input) {
        if (input.photo) next.photo = input.photo;
        else delete next.photo;
      }
      if ('format' in input) {
        if (isGameFormat(input.format)) next.format = input.format;
        else delete next.format;
      }
      if ('playShare' in input) {
        if (share !== undefined) next.playShare = share;
        else delete next.playShare;
      }
      await db.teams.put(next);
      return next;
    }
    const ts = nowTimestamp();
    const team: Team = { id: newId(), profileId, name, archived: false, createdAt: ts, updatedAt: ts, updatedBy: await deviceId() };
    if (input.photo) team.photo = input.photo;
    if (isGameFormat(input.format)) team.format = input.format;
    if (share !== undefined) team.playShare = share;
    await db.teams.add(team);
    return team;
  }

  async function setTeamArchived(id: UUID, archived: boolean): Promise<void> {
    const current = await db.teams.get(id);
    if (current) await db.teams.put(await stamp({ ...current, archived }));
  }

  // ---------- pelikalenteri: tulevat pelit ja turnaukset (skeema v2) ----------

  const FIXTURE_TYPE = { game: 't:football_game', tournament: 't:football_tournament' } as const;

  /** Pelien ja turnausten suunnitelmat lisätietoineen aikaväliltä (oletus: kaikki). */
  async function listFixtures(profileId: UUID, from: ISODate = '0000-01-01', to: ISODate = '9999-12-31'): Promise<FixtureEntry[]> {
    const typeIds = new Set<string>(Object.values(FIXTURE_TYPE));
    const plans = (await plansInRange(profileId, from, to)).filter((p) => typeIds.has(p.activityTypeId));
    const fixtures = await db.fixtures.bulkGet(plans.map((p) => p.id));
    return plans.map((plan, i) => {
      const f = fixtures[i];
      return f && !f.deletedAt ? { plan, fixture: f } : { plan };
    });
  }

  function fixtureRow(planId: UUID, input: FixtureInput, by: string, ts: Timestamp): Fixture {
    const f: Fixture = { plannedSessionId: planId, updatedAt: ts, updatedBy: by };
    const clean = (s?: string) => s?.trim().replace(/\s+/g, ' ') || undefined;
    if (input.teamId) f.teamId = input.teamId;
    if (clean(input.opponent)) f.opponent = clean(input.opponent);
    if (clean(input.eventName)) f.eventName = clean(input.eventName);
    if (clean(input.location)) f.location = clean(input.location);
    if (input.level) f.level = input.level;
    if (input.gamesCount) f.gamesCount = input.gamesCount;
    if (isGameFormat(input.format)) f.format = input.format;
    const games = (input.games ?? [])
      .map((g) => {
        const r: ScheduledGame = {};
        if (clean(g.opponent)) r.opponent = clean(g.opponent);
        if (g.time) r.time = g.time;
        if (clean(g.location)) r.location = clean(g.location);
        return r;
      })
      .filter((g) => g.opponent || g.time || g.location);
    if (input.kind === 'tournament' && games.length) {
      f.games = games;
      f.gamesCount = games.length;
    }
    if (input.kind === 'tournament') {
      const n = (v?: number) => (v !== undefined && Number.isInteger(v) && v >= 0 && v <= 240 ? v : undefined);
      if (n(input.gameLengthMin) !== undefined) f.gameLengthMin = input.gameLengthMin;
      if (n(input.warmupMin) !== undefined) f.warmupMin = input.warmupMin;
      if (n(input.cooldownMin) !== undefined) f.cooldownMin = input.cooldownMin;
      if (input.durationManual) f.durationManual = true;
    }
    if (clean(input.note)) f.note = clean(input.note);
    return f;
  }

  /** Uusi peli tai turnaus kalenteriin: käsin lisätty suunnitelma + lisätiedot. */
  async function createFixture(profileId: UUID, input: FixtureInput): Promise<FixtureEntry> {
    return db.transaction('rw', [db.plannedSessions, db.fixtures, db.meta], async () => {
      const ts = nowTimestamp();
      const by = await deviceId();
      const plan: PlannedSession = {
        id: newId(),
        profileId,
        activityTypeId: FIXTURE_TYPE[input.kind],
        date: input.date,
        durationMin: input.durationMin,
        status: 'open',
        createdAt: ts,
        updatedAt: ts,
        updatedBy: by,
      };
      if (input.startTime) plan.startTime = input.startTime;
      const fixture = fixtureRow(plan.id, input, by, ts);
      await db.plannedSessions.add(plan);
      await db.fixtures.put(fixture);
      return { plan, fixture };
    });
  }

  /** Muokkaus (vain kuittaamaton): päivä, aika, kesto ja lisätiedot. */
  async function updateFixture(planId: UUID, input: FixtureInput): Promise<void> {
    await db.transaction('rw', [db.plannedSessions, db.fixtures, db.meta], async () => {
      const plan = await db.plannedSessions.get(planId);
      if (!plan || plan.deletedAt) throw new Error('Peliä ei löydy');
      if (plan.status === 'done') throw new Error('Pelattu peli: muokkaa tulosta pelin kerrasta');
      const next = await stamp({ ...plan, activityTypeId: FIXTURE_TYPE[input.kind], date: input.date, durationMin: input.durationMin });
      delete next.startTime;
      if (input.startTime) next.startTime = input.startTime;
      await db.plannedSessions.put(next);
      await db.fixtures.put(fixtureRow(planId, input, next.updatedBy, next.updatedAt));
    });
  }

  /** Poisto kalenterista (poistomerkintä); pelattua peliä ei poisteta täältä. */
  /**
   * Suunnitellun kerran poisto kokonaan (ei näy viikolla eikä toteutumassa). Kuitattua ei poisteta
   * (poista kerta ensin). Poistomerkintä saa overridden-tiedon, jotta viikkopohjan muokkaus ei
   * luo kertaa uudelleen; pelikalenterin tiedot poistetaan samalla. restorePlanned kumoaa.
   */
  async function deletePlanned(planId: UUID): Promise<void> {
    await db.transaction('rw', [db.plannedSessions, db.fixtures, db.meta], async () => {
      const plan = await db.plannedSessions.get(planId);
      if (!plan || plan.deletedAt) return;
      if (plan.status === 'done') throw new Error('Kuitattu kerta: poista ensin kirjattu kerta');
      const ts = nowTimestamp();
      await db.plannedSessions.put({ ...plan, overridden: true, deletedAt: ts, updatedAt: ts, updatedBy: await deviceId() });
      const f = await db.fixtures.get(planId);
      if (f && !f.deletedAt) await softDelete(db.fixtures, planId);
    });
  }

  async function restorePlanned(planId: UUID): Promise<void> {
    await db.transaction('rw', [db.plannedSessions, db.fixtures, db.meta], async () => {
      const plan = await db.plannedSessions.get(planId);
      if (!plan?.deletedAt) return;
      const next = await stamp({ ...plan });
      delete next.deletedAt;
      await db.plannedSessions.put(next);
      const f = await db.fixtures.get(planId);
      if (f?.deletedAt) {
        const nf = await stamp({ ...f });
        delete nf.deletedAt;
        await db.fixtures.put(nf);
      }
    });
  }

  async function deleteFixture(planId: UUID): Promise<void> {
    await db.transaction('rw', [db.plannedSessions, db.fixtures, db.meta], async () => {
      const plan = await db.plannedSessions.get(planId);
      if (!plan || plan.deletedAt) return;
      if (plan.status === 'done') throw new Error('Pelattu peli: poista pelin kerta Viikko-näkymästä');
      await softDelete(db.plannedSessions, planId);
      if (await db.fixtures.get(planId)) await softDelete(db.fixtures, planId);
    });
  }

  // ---------- perusarviot (kerros 1) ----------

  /** Profiilin kaikki perusarviot (myös päättyneet; päiväkooste valitsee voimassa olevan). */
  async function listEstimates(profileId: UUID): Promise<Estimate[]> {
    const rows = live(await db.estimates.where('profileId').equals(profileId).toArray());
    return rows.sort((a, b) => a.category.localeCompare(b.category) || b.validFrom.localeCompare(a.validFrom));
  }

  /**
   * Välitunnit vain arkiliikunnassa (ESTIMATE_ONLY_CATEGORIES): erikseen kirjatut välituntikerrat
   * muutetaan arkiliikunnan vahvistuksiksi niinä päivinä, joille kategorialla on arvio. Minuutit
   * ja tehot säilyvät; kerta näkyy jatkossa päivän arkiliikuntarivillä eikä omana rivinään.
   * Samoin viikkorytmin välituntirivit poistetaan käytöstä ja avoimet välituntisuunnitelmat
   * arviopäiviltä poistetaan, jolloin arvio näkyy päivän arkiliikuntarivillä.
   * Idempotentti (ajetaan käynnistyksessä). Palauttaa muutettujen tietueiden määrän.
   */
  async function foldEstimateOnlySessions(today: ISODate): Promise<number> {
    const types = new Map((await db.activityTypes.toArray()).map((t) => [t.id, t]));
    const typeIds = [...types.values()].filter((t) => ESTIMATE_ONLY_CATEGORIES.includes(t.category)).map((t) => t.id);
    if (!typeIds.length) return 0;
    const estimatesByProfile = new Map<UUID, Estimate[]>();
    const estimatesOf = async (profileId: UUID) => {
      let e = estimatesByProfile.get(profileId);
      if (!e) estimatesByProfile.set(profileId, (e = live(await db.estimates.where('profileId').equals(profileId).toArray())));
      return e;
    };
    const categoryOf = (typeId: UUID) => types.get(typeId)!.category;
    // Siivouksen muutokset saavat johdetun aikaleiman (tietueen oma versio + 1 ms), eivät nykyhetkeä:
    // siivous on seurausta jo synkronoidusta tiedosta, joten se ei saa kumota toisella laitteella
    // myöhemmin tehtyä muokkausta (esim. kuittausta) eikä näy "odottaa siirtoa" -luvussa.
    const by = await deviceId();
    const after = (ts: Timestamp): Timestamp => new Date(Date.parse(ts) + 1).toISOString();
    let n = 0;

    // Kirjatut kerrat → arvion vahvistuksiksi.
    const sessions = live(await db.sessions.where('activityTypeId').anyOf(typeIds).toArray()).filter((s) => !isEstimateConfirmation(s));
    for (const s of sessions) {
      const e = activeEstimate(await estimatesOf(s.profileId), categoryOf(s.activityTypeId), s.date);
      if (!e) continue;
      await db.sessions.put({ ...s, estimateConfirmed: true, label: s.label || e.label, updatedAt: after(s.updatedAt), updatedBy: by });
      n++;
    }

    // Viikkorytmin rivit pois käytöstä, kun arvio on voimassa tänään tai alkaa myöhemmin.
    const items = live(await db.templateItems.toArray()).filter((i) => i.active && typeIds.includes(i.activityTypeId));
    for (const i of items) {
      const cat = categoryOf(i.activityTypeId);
      if (!(await estimatesOf(i.profileId)).some((e) => e.category === cat && (!e.validTo || e.validTo >= today))) continue;
      await deleteTemplateItem(i.id, today);
      n++;
    }

    // Jäljelle jääneet avoimet suunnitelmat (käsin lisätyt, kuittaamattomat menneet) arviopäiviltä.
    const plans = live(await db.plannedSessions.toArray()).filter((p) => p.status === 'open' && typeIds.includes(p.activityTypeId));
    for (const p of plans) {
      if (!activeEstimate(await estimatesOf(p.profileId), categoryOf(p.activityTypeId), p.date)) continue;
      const ts = after(p.updatedAt);
      await db.plannedSessions.put({ ...p, overridden: true, deletedAt: ts, updatedAt: ts, updatedBy: by });
      n++;
    }
    return n;
  }

  /**
   * Lomajaksot (SPEC 16): avoimet koululiikuntasuunnitelmat lomapäiviltä ohitetaan syyllä "Loma", ja
   * lomalla ohitetut avataan uudelleen, kun päivä ei enää ole lomaa (jakso poistettu tai lyhennetty).
   * Muutos on seurausta asetusrivistä, joten aikaleima ja tekijä johdetaan siitä (uudempi versioista
   * + 1 ms): molemmat laitteet tuottavat saman tietueen, eikä toisen laitteen muutos jää odottamaan.
   * Idempotentti. Palauttaa muutettujen suunnitelmien määrän.
   */
  async function applyHolidaySkips(): Promise<number> {
    const row = await db.settings.get(SETTINGS_ID);
    if (!row) return 0;
    const holidays = row.deletedAt ? [] : (row.holidays ?? []);
    const peIds = new Set((await db.activityTypes.toArray()).filter((t) => t.category === 'school_pe').map((t) => t.id));
    if (!peIds.size) return 0;
    const plans = live(await db.plannedSessions.toArray()).filter((p) => peIds.has(p.activityTypeId));
    const stampOf = (ts: Timestamp): Pick<PlannedSession, 'updatedAt' | 'updatedBy'> => ({
      updatedAt: new Date(Math.max(Date.parse(ts), Date.parse(row.updatedAt)) + 1).toISOString(),
      updatedBy: row.updatedBy,
    });
    let n = 0;
    for (const p of plans) {
      const onHoliday = !!holidayOn(holidays, p.profileId, p.date);
      if (p.status === 'open' && onHoliday) {
        await db.plannedSessions.put({ ...p, status: 'skipped', skipReason: 'holiday', ...stampOf(p.updatedAt) });
        n++;
      } else if (p.status === 'skipped' && p.skipReason === 'holiday' && !onHoliday) {
        const { skipReason: _drop, ...rest } = p;
        await db.plannedSessions.put({ ...rest, status: 'open', ...stampOf(p.updatedAt) });
        n++;
      }
    }
    return n;
  }

  /** Tänään voimassa olevat perusarviot, yksi per kategoria. */
  async function activeEstimates(profileId: UUID, today: ISODate): Promise<Estimate[]> {
    const rows = (await listEstimates(profileId)).filter((e) => e.validFrom <= today && (!e.validTo || today <= e.validTo));
    const byCat = new Map<string, Estimate>();
    for (const e of rows) if (!byCat.has(e.category)) byCat.set(e.category, e); // uusin validFrom ensin
    return [...byCat.values()];
  }

  /**
   * Tallennus: "uusi arvio päättää vanhan" (SPEC 6). Jos kategorialla on tänään
   * voimassa oleva arvio, joka alkoi aiemmin, se päätetään eiliseen ja uusi alkaa
   * tänään, jolloin menneiden päivien luvut eivät muutu. Tänään alkanut arvio
   * päivitetään paikallaan.
   */
  async function saveEstimate(profileId: UUID, input: EstimateInput, today: ISODate, validFrom: ISODate = today): Promise<Estimate> {
    if (!isISODate(validFrom) || validFrom > today) throw new Error('Tarkista alkamispäivä');
    return db.transaction('rw', db.estimates, db.meta, async () => {
      const current = (await activeEstimates(profileId, today)).find((e) => e.category === input.category);
      const fields = estimateFields(input);
      if (current && current.validFrom === validFrom) {
        const next = await stamp({ ...current, ...fields });
        await db.estimates.put(next);
        return next;
      }
      await yieldTo(profileId, input.category, validFrom);
      const ts = nowTimestamp();
      const est: Estimate = {
        id: newId(),
        profileId,
        ...fields,
        validFrom,
        createdAt: ts,
        updatedAt: ts,
        updatedBy: await deviceId(),
      };
      await db.estimates.add(est);
      return est;
    });
  }

  /** Lopetus: päätetään eiliseen (historia säilyy); tänään alkanut poistetaan. */
  function estimateFields(input: EstimateInput) {
    return {
      category: input.category,
      label: input.label.trim(),
      weekdayMin: input.weekdayMin,
      weekendMin: input.weekendMin,
      shares: { ...input.shares },
    };
  }

  /**
   * Saman kategorian muut arviot väistyvät päivästä `from` alkaen: aiemmin alkanut päätetään
   * edelliseen päivään, samana päivänä tai myöhemmin alkanut poistetaan (uusi kattaa sen).
   */
  async function yieldTo(profileId: UUID, category: Category, from: ISODate, exceptId?: UUID): Promise<void> {
    for (const o of await listEstimates(profileId)) {
      if (o.category !== category || o.id === exceptId) continue;
      if (o.validFrom >= from) await softDelete(db.estimates, o.id);
      else if (!o.validTo || o.validTo >= from) await db.estimates.put(await stamp({ ...o, validTo: addDays(from, -1) }));
    }
  }

  /**
   * Arvion korjaus koko voimassaoloajalle: arvot ja alkamispäivä muuttuvat paikallaan
   * (myös menneiden päivien luvut). Aiemmat saman kategorian arviot väistyvät.
   */
  async function correctEstimate(id: UUID, input: EstimateInput, validFrom: ISODate, today: ISODate): Promise<Estimate> {
    if (!isISODate(validFrom) || validFrom > today) throw new Error('Tarkista alkamispäivä');
    return db.transaction('rw', db.estimates, db.meta, async () => {
      const e = await db.estimates.get(id);
      if (!e || e.deletedAt) throw new Error('Arviota ei löydy');
      if (e.validTo && e.validTo < validFrom) throw new Error('Alkamispäivä on päättymisen jälkeen');
      await yieldTo(e.profileId, e.category, validFrom, e.id);
      const next = await stamp({ ...e, ...estimateFields({ ...input, category: e.category }), validFrom });
      await db.estimates.put(next);
      return next;
    });
  }

  async function endEstimate(id: UUID, today: ISODate): Promise<void> {
    const e = await db.estimates.get(id);
    if (!e || e.deletedAt) return;
    if (e.validFrom >= today) await softDelete(db.estimates, id);
    else if (!e.validTo || e.validTo >= today) await db.estimates.put(await stamp({ ...e, validTo: addDays(today, -1) }));
  }

  // ---------- päivämerkinnät ----------

  async function dayFlagsInRange(profileId: UUID, from: ISODate, to: ISODate): Promise<DayFlag[]> {
    const rows = await db.dayFlags
      .where('[profileId+date]')
      .between([profileId, from], [profileId, to], true, true)
      .toArray();
    return live(rows);
  }

  /** Sairaus- tai matkapäivä; tunniste f:<profileId>:<date>, poistettu herätetään henkiin. */
  async function setDayFlag(profileId: UUID, date: ISODate, reason: DayFlagReason): Promise<void> {
    const flag: DayFlag = await stamp({ id: dayFlagId(profileId, date), profileId, date, reason });
    await db.dayFlags.put(flag); // put tyhjentää mahdollisen deletedAt-arvon
  }

  async function clearDayFlag(profileId: UUID, date: ISODate): Promise<void> {
    const id = dayFlagId(profileId, date);
    const existing = await db.dayFlags.get(id);
    if (existing && !existing.deletedAt) await softDelete(db.dayFlags, id);
  }

  // ---------- asetukset (synkronoituva rivi) ----------

  async function getSettings(): Promise<Settings> {
    const row = await db.settings.get(SETTINGS_ID);
    const d = DEFAULT_SETTINGS;
    if (!row || row.deletedAt) return { ...d, vigorousDayByAge: { ...d.vigorousDayByAge }, holidays: [] };
    // Uudet kentät oletuksineen (vanhemmissa riveissä niitä ei ole).
    return {
      vigorousDayMin: row.vigorousDayMin ?? d.vigorousDayMin,
      vigorousDayRule: row.vigorousDayRule ?? d.vigorousDayRule,
      vigorousDayByAge: { ...(row.vigorousDayByAge ?? d.vigorousDayByAge) },
      primaryView: row.primaryView ?? d.primaryView,
      backupReminderDays: row.backupReminderDays ?? d.backupReminderDays,
      holidays: (row.holidays ?? []).map((h) => ({ ...h })),
    };
  }

  async function updateSettings(changes: Partial<Settings>): Promise<void> {
    const current = await getSettings();
    const row: SettingsRow = await stamp({ id: SETTINGS_ID, ...current, ...changes });
    await db.settings.put(row);
    if (changes.holidays) await applyHolidaySkips();
  }

  // ---------- laite ----------

  async function getDeviceRole(): Promise<DeviceRole | undefined> {
    return getMeta<DeviceRole>('deviceRole');
  }
  async function setDeviceRole(role: DeviceRole): Promise<void> {
    await setMeta('deviceRole', role);
  }

  return {
    db,
    getMeta,
    setMeta,
    deviceId,
    softDelete,
    initialize,
    listProfiles,
    createProfile,
    updateProfile,
    setProfileArchived,
    listActivityTypes,
    getActivityType,
    updateActivityType,
    restoreActivityTypeDefaults,
    recalculableSessions,
    recalculateSessions,
    sessionsInRange,
    recentActivityTypeIds,
    recentLabels,
    createSession,
    updateSession,
    deleteSession,
    undoDelete,
    /** Pohjan suunnitelmat + lomapäivien koululiikunnan ohitus uusille kerroille. */
    ensurePlanned: async (profileId: UUID, through: ISODate, today: ISODate) => {
      const n = await planner.ensurePlanned(profileId, through, today);
      if (n) await applyHolidaySkips();
      return n;
    },
    applyHolidaySkips,
    getPlannedThrough: planner.getPlannedThrough,
    listTemplateItems,
    createTemplateItem,
    updateTemplateItem,
    deleteTemplateItem,
    backfillTemplateItem,
    plansInRange,
    unconfirmedPlans,
    confirmPlanned,
    confirmMany,
    recordTournamentGame,
    undoConfirm,
    skipPlanned,
    updatePlannedOccurrence,
    reopenPlanned,
    listTeams,
    listClubs,
    saveClubLogo,
    rewriteTeamNames,
    renameClub,
    editSquad,
    setGameComment,
    saveTeam,
    setTeamArchived,
    listFixtures,
    createFixture,
    updateFixture,
    deleteFixture,
    deletePlanned,
    restorePlanned,
    getFootballDetails,
    footballDetailsFor,
    saveFootballDetails,
    restoreTemplateItem,
    setFootballNote,
    footballNameSuggestions,
    listEstimates,
    foldEstimateOnlySessions,
    activeEstimates,
    saveEstimate,
    correctEstimate,
    endEstimate,
    dayFlagsInRange,
    setDayFlag,
    clearDayFlag,
    getSettings,
    updateSettings,
    getDeviceRole,
    setDeviceRole,
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

export const repo = createRepositories();
