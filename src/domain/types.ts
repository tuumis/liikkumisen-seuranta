// Domain types – SPEC.md section 6 (tietomalli) and 7.11 (funktiorajapinnat).
// Pure type definitions: no runtime dependencies.
import type { Holiday } from './holidays';

// ---------- perustyypit ----------
export type UUID = string; // crypto.randomUUID() or a derived id (see ids.ts)
export type ISODate = string; // 'YYYY-MM-DD', paikallinen päivä
export type HHmm = string; // '17:30'
export type Timestamp = string; // ISO 8601 UTC, vain kirjanpitoon
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // ISO: 1 = ma
export interface YearMonth {
  year: number;
  month: number; // 1–12
}

export type RecommendationGroup = 'early_years' | 'school_age' | 'adult';
export type Category =
  | 'hobby'
  | 'school_pe'
  | 'school_recess'
  | 'commute'
  | 'self_directed'
  | 'family'
  | 'other';
export type Context = 'organized' | 'self_directed' | 'everyday';
export type MovementGroup =
  | 'ball_games'
  | 'endurance'
  | 'wheels'
  | 'winter'
  | 'water'
  | 'jumping_gymnastics'
  | 'strength'
  | 'play'
  | 'varies'
  | 'other';
export type StrengthDefault = 'yes' | 'ask' | 'no';
export type Effort = -1 | 0 | 1; // kevyempi | tavallinen | kovempi
/** Kirjauksessa valittu tehon esiasetus ("enimmäkseen …"); sovelluksen oma arvio. */
export type IntensityPreset = 'light' | 'moderate' | 'vigorous';

export interface IntensityShares {
  light: number;
  moderate: number;
  vigorous: number;
} // 0–1, summa ≤ 1
export interface IntensityMinutes {
  light: number;
  moderate: number;
  vigorous: number;
}

// ---------- synkronointi ----------
export type DeviceId = string; // crypto.randomUUID(), luodaan laitteen ensikäynnistyksessä

export interface SyncFields {
  updatedAt: Timestamp; // päivitetään JOKAISESSA muutoksessa, myös tilan vaihdossa
  updatedBy: DeviceId; // laite, joka teki viimeisimmän muutoksen
  deletedAt?: Timestamp; // poistomerkintä; tietuetta ei poisteta fyysisesti
}

// ---------- profiili ----------
export interface Profile extends SyncFields {
  id: UUID;
  name: string; // lempinimi riittää
  kind: 'child' | 'adult';
  birthYear: number;
  birthMonth: number; // 1–12; syntymäpäivää ei tallenneta
  schoolStart?: YearMonth; // koulun aloitus, lapsilla
  groupOverride?: RecommendationGroup;
  color: string;
  /** Profiilikuva pienennettynä (JPEG data URL, ~256 px); vain tällä laitteella, varmuuskopiossa ja synkronoinnissa. */
  photo?: string;
  /** Seurannan alku, jos eri kuin profiilin luontipäivä (esim. aiemmin aloitettu seuranta). */
  trackingStart?: ISODate;
  sortOrder: number;
  archived: boolean;
  createdAt: Timestamp;
}

// ---------- liikkumismuoto ----------
export type FootballKind = 'training' | 'game' | 'tournament';
/** Sarja- tai turnaustaso: Elite = kovatempoinen, Kilpa = reipas, Haaste = kevyempi. */
export type GameLevel = 'elite' | 'kilpa' | 'haaste';

export interface ActivityType extends SyncFields {
  id: UUID;
  key?: string; // sisäänrakennetuilla pysyvä avain, esim. 'football_training'
  name: string;
  icon: string;
  category: Category;
  movementGroup: MovementGroup;
  shares: IntensityShares; // sovelluksen oletusarvio, muokattava
  muscleDefault: StrengthDefault;
  boneDefault: StrengthDefault;
  sport?: 'football';
  footballKind?: FootballKind; // jalkapallon alalaji määräytyy lajista
  usesPlayedMinutes: boolean; // peli ja turnaus
  builtIn: boolean;
  archived: boolean;
  sortOrder: number;
}

// ---------- kerros 1: perusarvio ----------
export interface Estimate extends SyncFields {
  id: UUID;
  profileId: UUID;
  category: Category;
  label: string; // 'Välitunnit ja pihaleikit'
  weekdayMin: number; // ma–pe
  weekendMin: number; // la–su
  shares: IntensityShares;
  validFrom: ISODate;
  validTo?: ISODate; // mukaan luettu päivä
  createdAt: Timestamp;
}

// ---------- kerros 2: suunnitelma ----------
export interface TemplateItem extends SyncFields {
  id: UUID;
  profileId: UUID;
  activityTypeId: UUID;
  weekdays: Weekday[];
  startTime?: HHmm;
  durationMin: number;
  validFrom: ISODate;
  validTo?: ISODate; // esim. syyskausi; mukaan luettu päivä
  active: boolean;
  note?: string;
  /** Tarkenne, joka näkyy viikolla (esim. "Talenttitreeni"); siirtyy suunnitelmiin ja kertoihin. */
  label?: string;
  createdAt: Timestamp;
}

export type PlannedStatus = 'open' | 'done' | 'skipped';
export type SkipReason = 'sick' | 'injured' | 'cancelled' | 'holiday' | 'other_commitment' | 'other';

export interface PlannedSession extends SyncFields {
  id: UUID;
  profileId: UUID;
  activityTypeId: UUID;
  date: ISODate;
  startTime?: HHmm;
  durationMin: number; // suunniteltu; ei muutu kuitatessa
  templateItemId?: UUID; // puuttuu, jos lisätty käsin
  status: PlannedStatus;
  skipReason?: SkipReason;
  sessionId?: UUID; // kun status = 'done'
  /** Tätä kertaa on muutettu yksittäin (kesto/kellonaika); viikkopohjan muokkaus ei kumoa muutosta. */
  overridden?: boolean;
  /** Tarkenne viikkopohjasta (esim. "Futsal"). */
  label?: string;
  createdAt: Timestamp;
}

// ---------- kerros 3: toteuma ----------
export interface Session extends SyncFields {
  id: UUID;
  profileId: UUID;
  activityTypeId: UUID;
  date: ISODate;
  startTime?: HHmm;
  durationMin: number;
  playedMin?: number; // peli ja turnaus
  /** Peli ja turnaus: lämmittely (min, treenin teholla); puuttuessa 15. */
  warmupMin?: number;
  /** Peli ja turnaus: peliaika-arvio (osuus peliajasta kentällä), kun pelattuja minuutteja ei ole; puuttuessa 0,7. */
  playShare?: number;
  effort: Effort;
  intensitySource: 'profile' | 'manual';
  sharesSnapshot?: IntensityShares; // käytetty profiili, kun source = 'profile'
  /** Kirjauksessa valittu esiasetus; silloin snapshot = esiasetuksen osuudet, eikä "Laske uudelleen" koske kertaa. */
  intensityPreset?: IntensityPreset;
  minutes: IntensityMinutes; // tallennettu laskentatulos
  muscle: boolean;
  bone: boolean;
  plannedSessionId?: UUID;
  note?: string;
  /** Tarkenne lajin nimen rinnalle (esim. "Joukkuetreeni", "Taitokoulu", "Uinti koululiikunnassa"). */
  label?: string;
  /** Arkiliikunnan päiväkohtainen vahvistus (Tarkista-paneelista); näytetään arkiliikuntarivillä. */
  estimateConfirmed?: boolean;
  createdAt: Timestamp;
}

export type FocusTag =
  | 'passing'
  | 'dribbling'
  | 'shooting'
  | 'one_v_one'
  | 'small_sided'
  | 'goalkeeping'
  | 'game_understanding'
  | 'physical'
  | 'coordination'
  | 'other';

/** Pelimuoto (pelaajia per joukkue kentällä). */
export type GameFormat = '3v3' | '5v5' | '7v7' | '8v8' | '9v9' | '11v11';
/** Pelipaikka: maalivahti, puolustus, keskikenttä, hyökkäys. */
export type FieldPosition = 'gk' | 'def' | 'mid' | 'fwd';

export type PlayedState = 'none' | 'part' | 'full';

export interface GameResult {
  // yksi turnauksen peli
  opponent?: string;
  goalsFor?: number;
  goalsAgainst?: number;
  playedMin?: number;
  /** Pelasiko: ei / osan (peliaika-arvio) / koko pelin; tarkat minuutit (playedMin) ohittavat. */
  played?: PlayedState;
  /** Oman lapsen tekemät maalit tässä pelissä. */
  playerGoals?: number;
  /** Otteluohjelmasta: alkamisaika ja kenttä. */
  time?: HHmm;
  location?: string;
  /** Pelikohtainen kommentti (päiväkirja). */
  note?: string;
}

/** Turnauksen otteluohjelman rivi (ennen pelejä). */
export interface ScheduledGame {
  opponent?: string;
  time?: HHmm;
  location?: string;
}

export interface FootballDetails extends SyncFields {
  sessionId: UUID; // pääavain, 1:1 Session; laji kertoo treeni/peli/turnaus
  attendance: 'full' | 'partial';
  team?: string; // oma joukkue, esim. 'P2018 Valkoinen'
  teamId?: UUID; // linkki joukkueeseen (skeema v2)
  level?: GameLevel; // pelin tai turnauksen taso (skeema v2)
  games?: GameResult[]; // turnauksen pelit
  focusTags: FocusTag[];
  parentRating?: 1 | 2 | 3 | 4 | 5;
  enjoyment?: 1 | 2 | 3;
  ratingNote?: string;
  opponent?: string;
  goalsFor?: number;
  goalsAgainst?: number;
  /** Oman lapsen tekemät maalit (peli); turnauksessa pelirivien summa. */
  playerGoals?: number;
  /** Pelimuoto (peli ja turnaus), esim. 8v8. */
  format?: GameFormat;
  /** Pelipaikat, joilla lapsi pelasi (voi olla useita). */
  positions?: FieldPosition[];
  gamesCount?: number; // turnaus
  eventName?: string; // turnaus
  /** Turnauksen yhden pelin pituus (min) otteluohjelmasta; pelirivien "Koko pelin" / "Osan" laskentaan. */
  gameLengthMin?: number;
  /** Peli: pelasiko (ei / osan / koko pelin). */
  played?: PlayedState;
}

// ---------- joukkueet ja pelikalenteri (skeema v2) ----------

/** Oma joukkue; oletustaso on joukkueen sarjataso, jonka voi vaihtaa tapahtumakohtaisesti. */
export interface Team extends SyncFields {
  id: UUID;
  profileId: UUID;
  name: string;
  /** Vanha sarjataso: ei enää käytössä (taso on peli- ja turnauskohtainen); säilyy vanhoissa riveissä. */
  level?: GameLevel;
  /** Joukkuekuva pienennettynä (JPEG data URL), valinnainen. */
  photo?: string;
  /** Joukkueen tavallinen pelimuoto (oletus peleille), esim. 8v8. */
  format?: GameFormat;
  /** Peliaika-arvio: osuus peliajasta kentällä (0,1–1); puuttuessa 0,7. */
  playShare?: number;
  archived: boolean;
  createdAt: Timestamp;
}

/**
 * Tulevan pelin tai turnauksen tiedot, 1:1 suunniteltuun kertaan (PlannedSession, laji peli
 * tai turnaus). Suunnitelma näkyy viikolla ja kuitataan kuten muutkin; kuittaus esitäyttää
 * jalkapallon lisätiedot näistä tiedoista.
 */
export interface Fixture extends SyncFields {
  plannedSessionId: UUID; // pääavain
  teamId?: UUID;
  opponent?: string;
  eventName?: string; // turnaus
  location?: string;
  level?: GameLevel;
  gamesCount?: number; // turnaus
  /** Pelimuoto; puuttuessa käytetään joukkueen pelimuotoa. */
  format?: GameFormat;
  /** Turnauksen otteluohjelma; kuittaus luo näistä pelirivit tulosten kirjaamista varten. */
  games?: ScheduledGame[];
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

/**
 * Seura (skeema v3): seuran logo joukkuekirjastoa varten. Tunniste johdetaan nimestä
 * (`club:<nimi pienellä>`), joten sama seura on kaikilla laitteilla yksi tietue. Seuraan
 * kuuluvat ryhmät ja ikäluokat ovat joukkueiden ja vastustajien nimissä (domain/opponent).
 */
export interface Club extends SyncFields {
  id: string;
  name: string;
  /** Logo kokonaisena (PNG/JPEG data URL, ei rajausta), valinnainen. */
  logo?: string;
  createdAt: Timestamp;
}

// ---------- muut ----------
export type DayFlagReason = 'sick' | 'travel' | 'other';

export interface DayFlag extends SyncFields {
  id: UUID; // f:<profileId>:<date>
  profileId: UUID;
  date: ISODate;
  reason: DayFlagReason;
}

export interface MetaRow {
  key: string;
  value: unknown;
}
// laitekohtainen, ei synkronoidu: 'deviceId', 'deviceRole', 'schemaVersion',
// 'plannedThrough:<profileId>', 'lastExportAt', 'lastSyncAt', 'syncFolderHandle'

export interface Settings {
  /** Kiinteä rasittavan päivän raja (min), kun vigorousDayRule = 'fixed'; oletus 10. */
  vigorousDayMin: number;
  /** Rasittavan päivän raja: iän mukaan (taulukko) tai kiinteä. Oletus 'age'. */
  vigorousDayRule: 'age' | 'fixed';
  /** Ikä (v) → rasittavaa vähintään (min/pv). Käyttäjän oma tavoite, ei virallinen suositus. */
  vigorousDayByAge: Record<string, number>;
  primaryView: 'logged_plus_estimate' | 'logged';
  backupReminderDays: number; // oletus 30
  /** Lomajaksot (SPEC 16): arkipäivä = viikonloppu perusarviossa, koululiikunta ohitetaan. */
  holidays: Holiday[];
}

/** Synkronoituva asetusrivi taulussa `settings` (id = 'settings'). */
export interface SettingsRow extends Settings, SyncFields {
  id: 'settings';
}

// ---------- laskennan tyypit (osio 7) ----------
export type PeriodKind = 'week' | 'month' | 'season' | 'year';

/** Jakso: alku ja loppu mukaan luettuina. */
export interface Period {
  kind: PeriodKind;
  start: ISODate;
  end: ISODate;
}

export interface CategoryTotals {
  source: 'logged' | 'estimate';
  minutes: IntensityMinutes;
}

/** Päiväkooste (7.1). */
export interface DayTotals {
  date: ISODate;
  /** Kirjattu: päivän Session.minutes-summat. */
  logged: IntensityMinutes;
  /** Arvio: E_L, E_M, E_V korvausperiaatteella. */
  estimate: IntensityMinutes;
  /** Yhdistetty: L* = L + E_L jne. */
  combined: IntensityMinutes;
  /** MVPA = M + V (kirjattu). */
  mvpa: number;
  /** MVPA* = M* + V* (yhdistetty). */
  mvpaCombined: number;
  /** L + M + V (kirjattu). */
  total: number;
  /** L* + M* + V* (yhdistetty). */
  totalCombined: number;
  /** Jokin kirjattu kerta on lihaksia vahvistava. Perusarvio ei koskaan vaikuta. */
  muscle: boolean;
  /** Jokin kirjattu kerta on luustoa vahvistava. Perusarvio ei koskaan vaikuta. */
  bone: boolean;
  /** Päivän kirjattujen kertojen määrä (kattavuus 7.8). */
  sessionCount: number;
  /** Kategoriat, joille perusarviota käytettiin. */
  estimatedCategories: Category[];
  /** Päiväkohtaisesti vahvistetun arkiliikunnan reipas+rasittava (sisältyy mvpa-lukuun). */
  confirmedMvpa: number;
  /** Oliko päivälle voimassa vähintään yksi perusarvio (käytettiin tai ei). */
  estimateAvailable: boolean;
  /** Minuutit kategorioittain (7.10). */
  byCategory: Partial<Record<Category, CategoryTotals>>;
}

export type Status = 'met' | 'near' | 'below';

/** Yksi toteuma/tavoite-vertailu (7.7). */
export interface Measure {
  actual: number;
  target: number;
  /** actual / target; 1 kun tavoite on 0. */
  ratio: number;
  status: Status;
  /** max(0, target − actual). */
  shortfall: number;
}

/** Sama vertailu kirjatuista ja kirjattu + arvio -luvuista. */
export interface DualMeasure {
  logged: Measure;
  combined: Measure;
}

export interface DataQuality {
  /** Osuus kelvollisista päivistä, joilla vähintään yksi Session. */
  coverage: number;
  /** (MVPA* − MVPA) / MVPA*, 0 kun MVPA* = 0. */
  estimateShare: number;
  /** Kattavuus < 50 % eikä perusarvioita ole → "Liian vähän kirjauksia luotettavaan vertailuun". */
  lowData: boolean;
}

export interface SchoolAgeEvaluation {
  /** Reipas ja rasittava, ka. min/pv; tavoite 60. */
  mvpaAvg: DualMeasure;
  /** Päivät, joilla MVPA ≥ 60 (täydentävä tieto, ei tavoitetta). */
  activeDays: { logged: number; combined: number };
  /** Päivät, joilla kirjattu V ≥ vigorousDayMin; tavoite 3 / viikko. */
  vigorousDays: Measure;
  muscleDays: Measure;
  boneDays: Measure;
}

export interface EarlyYearsEvaluation {
  /** Täyttyneet päivät / N; tila tästä osuudesta. */
  daysMet: DualMeasure;
  /** Kokonaisliikunta ka. min/pv; tavoite 180 (lisätieto). */
  totalAvg: DualMeasure;
  /** Vauhdikas (MVPA) ka. min/pv; tavoite 60 (lisätieto). */
  mvpaAvg: DualMeasure;
}

export interface AdultEvaluation {
  /** W = ΣM + 2ΣV; tavoite 150 · N/7. */
  weighted: DualMeasure;
  /** Lihaskunto- ja liikehallintapäivät (muscle); tavoite 2 / viikko. */
  muscleDays: Measure;
}

export interface PeriodEvaluation {
  group: RecommendationGroup;
  /** Kelvollisten päivien määrä. */
  n: number;
  /** false, kun N = 0: vertailua ei tehdä. */
  evaluable: boolean;
  quality: DataQuality;
  schoolAge?: SchoolAgeEvaluation;
  earlyYears?: EarlyYearsEvaluation;
  adult?: AdultEvaluation;
}

export interface DurationPair {
  plannedSessionId: UUID;
  sessionId: UUID;
  plannedMin: number;
  actualMin: number;
}

/** Suunnitelma vs. toteuma (7.9). Ei vaikuta liikuntamääriin. */
export interface AdherenceSummary {
  planned: number;
  done: number;
  skipped: number;
  skippedByReason: Record<SkipReason | 'unspecified', number>;
  /** Kaikki open-tilaiset. */
  open: number;
  /** Kuittaamattomat: open ja päivä < tänään. */
  unconfirmed: number;
  /** done / (done + skipped ilman peruttuja); null, kun nimittäjä on 0. */
  adherenceRate: number | null;
  pairs: DurationPair[];
  plannedMinTotal: number;
  actualMinTotal: number;
}
