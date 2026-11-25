// Jalkapallon seuranta (SPEC 8). Neljä erillistä osaa, joita ei yhdistetä pisteluvuksi:
// osallistuminen ja peliaika, harjoittelun sisältö, vanhemman arvio ja (myöhemmin) taitotestit.
// Tulokset ovat joukkueen tuloksia eivätkä vaikuta muihin mittareihin. Puhtaita funktioita.

import { planAdherence } from './adherence';
import { seasonPeriod, minDate } from './dates';
import type {
  ActivityType,
  HomeAway,
  AdherenceSummary,
  Effort,
  FieldPosition,
  FocusTag,
  GameFormat,
  GameLevel,
  HHmm,
  FootballDetails,
  FootballKind,
  ISODate,
  Period,
  PlannedSession,
  PlayedState,
  Session,
  UUID,
} from './types';
import { DEFAULT_GAME_WARMUP_MIN, DEFAULT_PLAY_SHARE, roundMinutes } from './intensity';
import { defaultGameLength } from './tournamentTime';

/**
 * Pelasiko-valinnan minuutit (24.11.2026, käyttäjän havainto: "Osan (70 %)" ei päivittänyt peliaikaa
 * tuloksissa): Koko pelin = pelin pituus, Ei pelannut = 0, Osan = pelin pituus × peliaika-arvio.
 */
export function playedMinOf(played: PlayedState | undefined, gameMin: number, share: number | undefined): number | undefined {
  if (played === 'full') return gameMin;
  if (played === 'none') return 0;
  if (played === 'part') return roundMinutes(gameMin * (share ?? DEFAULT_PLAY_SHARE));
  return undefined;
}

export type GameOutcome = 'W' | 'D' | 'L';

/**
 * Seurajalkapallon lajit (treeni, peli, turnaus), jotka piilotetaan, kun jalkapallo-ominaisuus on pois.
 * "Jalkapallo – omatoiminen" on tavallinen omaehtoinen laji ja näkyy aina.
 */
export const isClubFootball = (t: Pick<ActivityType, 'sport' | 'category'> | undefined): boolean => t?.sport === 'football' && t.category !== 'self_directed';

/** Seuran jalkapallotreeni (ei omatoiminen): näille voi lisätä omatoimisen alku- ja loppuverryttelyn (17.11.2026). */
export const isClubTraining = (t: Pick<ActivityType, 'sport' | 'category' | 'footballKind'> | undefined): boolean => isClubFootball(t) && t?.footballKind === 'training';

/** Tarkenteen vertailuavain (19.11.2026): kirjainkoosta ja välilyönneistä riippumaton; '' = ei tarkennetta. */
export const labelKey = (label: string | undefined): string => (label ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('fi');

/** Treeniin linkitetty omatoiminen verryttely (ei lasketa erilliseksi treenikerraksi). */
export const isTrainingSelf = (s: Pick<Session, 'linkedTo'>): boolean => !!s.linkedTo;

/** Verryttelyn alkuaika: treenin alku − ennen-minuutit, tai treenin loppu, jos alkuverryttelyä ei ole. */
export function trainingSelfStart(start: HHmm | undefined, durationMin: number, beforeMin: number): HHmm | undefined {
  if (!start) return undefined;
  const [h, m] = start.split(':').map(Number);
  const t = h * 60 + m + (beforeMin > 0 ? -beforeMin : durationMin);
  if (t < 0 || t >= 24 * 60) return undefined;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` as HHmm;
}

/** Verryttelyn minuutit siistittyinä (0–180). */
export const selfMin = (n: number | undefined): number => (n !== undefined && Number.isFinite(n) && n > 0 ? Math.min(180, Math.round(n)) : 0);

/** Verryttelyn kuvaus treenin yhteydessä, esim. "omatoiminen 10 min ennen · 5 min jälkeen". */
export function trainingSelfText(s: Pick<Session, 'selfBeforeMin' | 'selfAfterMin'>): string {
  const parts = [s.selfBeforeMin ? `${s.selfBeforeMin} min ennen` : '', s.selfAfterMin ? `${s.selfAfterMin} min jälkeen` : ''].filter(Boolean);
  return `omatoiminen ${parts.join(' · ')}`;
}

/**
 * Treenin omatoiminen verryttely näkyy treenin rivillä eikä omana kertanaan (käyttäjän palaute 17.11.2026):
 * listasta pois verryttelyt, joiden treeni on samassa listassa; `selfOf(treeninId)` antaa treenin verryttelyn.
 * Minuutit lasketaan edelleen omana kertanaan (oma tehojako), joten summat eivät muutu.
 */
export function foldTrainingSelves<T extends Pick<Session, 'id' | 'linkedTo'>>(list: readonly T[]): { rows: T[]; selfOf: (id: string) => T | undefined } {
  const ids = new Set(list.map((s) => s.id));
  const selves = new Map(list.filter((s) => s.linkedTo && ids.has(s.linkedTo)).map((s) => [s.linkedTo!, s]));
  return { rows: list.filter((s) => !(s.linkedTo && ids.has(s.linkedTo))), selfOf: (id) => selves.get(id) };
}

/**
 * Kerrat ja minuutit lajeittain (17.11.2026): treenin verryttely (linkedTo) on osa treeniä, joten sen
 * minuutit lasketaan treenin lajiin eikä se ole oma kerta. Jos treeniä ei ole listassa, verryttely on oma rivinsä.
 */
export function typeTotals<T extends Pick<Session, 'id' | 'linkedTo' | 'activityTypeId' | 'durationMin'>>(list: readonly T[]): Map<UUID, { count: number; minutes: number }> {
  const byId = new Map(list.map((s) => [s.id, s]));
  const out = new Map<UUID, { count: number; minutes: number }>();
  for (const s of list) {
    const parent = s.linkedTo ? byId.get(s.linkedTo) : undefined;
    const typeId = parent ? parent.activityTypeId : s.activityTypeId;
    const row = out.get(typeId) ?? { count: 0, minutes: 0 };
    if (!parent) row.count++;
    row.minutes += Math.max(0, s.durationMin);
    out.set(typeId, row);
  }
  return out;
}

/** Verryttelykerran nimi minuuttien mukaan. */
export function trainingSelfLabel(before: number, after: number): string {
  return before > 0 && after > 0 ? 'Alku- ja loppuverryttely' : before > 0 ? 'Alkuverryttely' : 'Loppuverryttely';
}

/** Jalkapallo-ominaisuus profiilille: tallennettu valinta, muuten päätelty datasta. */
export const footballEnabled = (profile: { football?: boolean } | undefined, hasData: boolean): boolean => profile?.football ?? hasData;

/**
 * Taso ponnisteluna pelin tehoprofiiliin (käyttäjän vahvistama): Elite = kovempi,
 * Kilpa = tavallinen, Haaste = kevyempi. Tehoprofiili itse säilyy (peli 20/45/30 %).
 */
export const LEVEL_EFFORT: Readonly<Record<GameLevel, Effort>> = Object.freeze({ elite: 1, kilpa: 0, haaste: -1 });
export const LEVEL_LABEL: Readonly<Record<GameLevel, string>> = Object.freeze({ elite: 'Elite', kilpa: 'Kilpa', haaste: 'Haaste' });
export const GAME_FORMATS: readonly GameFormat[] = Object.freeze(['3v3', '5v5', '7v7', '8v8', '9v9', '11v11']);
export const POSITION_LABEL: Readonly<Record<FieldPosition, string>> = Object.freeze({ gk: 'Maalivahti', def: 'Puolustus', mid: 'Keskikenttä', fwd: 'Hyökkäys' });
export const POSITIONS: readonly FieldPosition[] = Object.freeze(['gk', 'def', 'mid', 'fwd']);

/** Koti- tai vieraspeli (18.11.2026). */
export const HOME_AWAY_LABEL: Readonly<Record<HomeAway, string>> = Object.freeze({ home: 'Koti', away: 'Vieras' });
export const isHomeAway = (v: unknown): v is HomeAway => v === 'home' || v === 'away';

/** Sarja (esim. P9, T12, P2016): siistitty, enintään 20 merkkiä; tyhjä = undefined. */
export function cleanSeries(s: string | undefined): string | undefined {
  return s?.replace(/\s+/g, ' ').trim().slice(0, 20) || undefined;
}
export const isGameFormat = (s: unknown): s is GameFormat => typeof s === 'string' && (GAME_FORMATS as readonly string[]).includes(s);

/** Yksi pelilistan rivi (SPEC 8 "Pelilista"). */
export interface GameRow {
  sessionId: UUID;
  date: ISODate;
  /** 'friendly' = harjoituspeli: vain friendlyRows tuottaa, eikä summarizeGames laske niitä (17.11.2026). */
  kind: 'game' | 'tournament' | 'friendly';
  /** Turnauksen nimi. */
  eventName?: string;
  /** Pelin järjestysnumero turnauksessa (1…); puuttuu yksittäiseltä peliltä. */
  index?: number;
  team?: string;
  opponent?: string;
  goalsFor?: number;
  goalsAgainst?: number;
  /** Vain, kun molemmat maalimäärät on kirjattu. */
  outcome?: GameOutcome;
  playedMin?: number;
  /** Peliaika on arvio valinnasta "Osan" (ei tarkkoja minuutteja). */
  playedEstimate?: true;
  /** Montako peliä rivi edustaa: 1, tai turnaus ilman pelirivejä = gamesCount. */
  games: number;
  level?: GameLevel;
  teamId?: UUID;
  /** Pelin tai turnauksen linkki (17.11.2026). */
  link?: string;
  /** Sarja, esim. P9 (18.11.2026). */
  series?: string;
  /** Koti- vai vieraspeli (18.11.2026). */
  homeAway?: HomeAway;
  /** Turnauksen pelin kellonaika ja kommentti. */
  time?: string;
  note?: string;
  /** Oman lapsen maalit (rivin peleissä yhteensä). */
  playerGoals?: number;
  format?: GameFormat;
  positions?: FieldPosition[];
  /** Pelin pituus ilman lämmittelyä (peli: kesto − lämmittely; turnaus: otteluohjelman pelin pituus × pelit). */
  gameMin?: number;
  /** Pelasiko (ei / osan / koko pelin), jos merkitty. */
  played?: PlayedState;
  /**
   * Seuran sisäinen turnauspeli (25.11.2026): aika lasketaan, mutta rivillä ei ole tulosta (outcome) eikä se kuulu
   * V–T–H:hon, maaleihin, vastustajahistoriaan eikä tilastoihin. Maalimäärät säilyvät näytettäviksi.
   */
  internal?: true;
}

export interface GameSummary {
  games: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  /** Pelit, joissa tulosta ei ole kirjattu ("ei tulosta"). */
  noResult: number;
  playedMinTotal: number;
  /** Pelatut minuutit per peli niistä peleistä, joille peliaika on kirjattu; null, jos ei yhtään. */
  playedMinAvg: number | null;
  /** Oman lapsen maalit yhteensä ja montako peliä ne kattavat (pelit, joille pelaajan maalit on kirjattu). */
  playerGoals: number;
  playerGoalsGames: number;
}

/** Nimien vertailu: kirjainkoko ja ylimääräiset välilyönnit eivät vaikuta. */
export function normalizeName(s: string | undefined): string {
  return (s ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('fi');
}

/** Siistitty näyttömuoto (ylimääräiset välilyönnit pois). */
export const cleanName = (s: string | undefined) => (s ?? '').trim().replace(/\s+/g, ' ') || undefined;

export function outcomeOf(goalsFor?: number, goalsAgainst?: number): GameOutcome | undefined {
  if (goalsFor === undefined || goalsAgainst === undefined || goalsFor === null || goalsAgainst === null) return undefined;
  return goalsFor > goalsAgainst ? 'W' : goalsFor === goalsAgainst ? 'D' : 'L';
}

export const OUTCOME_LABEL: Record<GameOutcome, string> = { W: 'V', D: 'T', L: 'H' };

export function footballKindOf(s: Session, types: Map<UUID, ActivityType>): FootballKind | undefined {
  const t = types.get(s.activityTypeId);
  return t?.sport === 'football' ? t.footballKind : undefined;
}

/**
 * Pelilista: yksi rivi per peli. Turnauksen pelit tulevat peliriveistä; jos rivejä ei ole,
 * turnaus on yksi rivi (gamesCount peliä, ei tulosta).
 */
export function gameRows(sessions: Session[], details: Map<UUID, FootballDetails>, types: Map<UUID, ActivityType>): GameRow[] {
  const rows: GameRow[] = [];
  for (const s of sessions) {
    if (s.deletedAt) continue;
    const kind = footballKindOf(s, types);
    if (kind !== 'game' && kind !== 'tournament') continue;
    const d = details.get(s.id);
    const fd = d && !d.deletedAt ? d : undefined;
    const team = cleanName(fd?.team);
    const extra = {
      ...(fd?.link ? { link: fd.link } : {}),
      ...(fd?.series ? { series: fd.series } : {}),
      ...(fd?.level ? { level: fd.level } : {}),
      ...(fd?.teamId ? { teamId: fd.teamId } : {}),
      ...(fd?.format ? { format: fd.format } : {}),
      ...(fd?.positions?.length ? { positions: fd.positions } : {}),
    };
    if (kind === 'game') {
      const gameMin = Math.max(0, s.durationMin - (s.warmupMin ?? DEFAULT_GAME_WARMUP_MIN));
      const playedMin = s.playedMin ?? playedMinOf(fd?.played, gameMin, s.playShare);
      rows.push({
        ...extra,
        gameMin,
        ...(fd?.played ? { played: fd.played } : {}),
        sessionId: s.id,
        date: s.date,
        kind,
        team,
        opponent: cleanName(fd?.opponent),
        goalsFor: fd?.goalsFor,
        goalsAgainst: fd?.goalsAgainst,
        outcome: outcomeOf(fd?.goalsFor, fd?.goalsAgainst),
        playedMin,
        ...(s.playedMin === undefined && fd?.played === 'part' ? { playedEstimate: true as const } : {}),
        games: 1,
        ...(fd?.playerGoals !== undefined ? { playerGoals: fd.playerGoals } : {}),
        ...(fd?.homeAway ? { homeAway: fd.homeAway } : {}),
      });
    } else if (fd?.games && fd.games.length > 0) {
      const len = fd.gameLengthMin ?? defaultGameLength(fd.format);
      fd.games.forEach((g, i) =>
        rows.push({
          ...extra,
          sessionId: s.id,
          date: s.date,
          kind,
          eventName: cleanName(fd.eventName),
          index: i + 1,
          team,
          opponent: cleanName(g.opponent),
          goalsFor: g.goalsFor,
          goalsAgainst: g.goalsAgainst,
          outcome: g.internal ? undefined : outcomeOf(g.goalsFor, g.goalsAgainst),
          ...(g.internal ? { internal: true as const } : {}),
          playedMin: g.playedMin ?? playedMinOf(g.played, len, s.playShare),
          ...(g.playedMin === undefined && g.played === 'part' ? { playedEstimate: true as const } : {}),
          games: 1,
          ...(fd.gameLengthMin ? { gameMin: fd.gameLengthMin } : {}),
          ...(g.played ? { played: g.played } : {}),
          ...(g.time ? { time: g.time } : {}),
          ...(g.note ? { note: g.note } : {}),
          ...(g.playerGoals !== undefined ? { playerGoals: g.playerGoals } : {}),
          ...(g.homeAway ? { homeAway: g.homeAway } : {}),
        }),
      );
    } else {
      rows.push({
        ...extra,
        sessionId: s.id,
        date: s.date,
        kind,
        eventName: cleanName(fd?.eventName),
        team,
        playedMin: s.playedMin,
        games: Math.max(1, fd?.gamesCount ?? 1),
        ...(fd?.gameLengthMin ? { gameMin: fd.gameLengthMin * Math.max(1, fd?.gamesCount ?? 1) } : {}),
        ...(fd?.playerGoals !== undefined ? { playerGoals: fd.playerGoals } : {}),
      });
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.sessionId.localeCompare(b.sessionId) || (a.index ?? 0) - (b.index ?? 0));
}

/**
 * Harjoituspelit (17.11.2026): yksi rivi per vastustaja (tai yksi rivi ilman vastustajia). Tulos on
 * valinnainen eikä tule V–T–H-tilastoon (summarizeGames ohittaa nämä rivit).
 */
export function friendlyRows(sessions: Session[], details: Map<UUID, FootballDetails>, types: Map<UUID, ActivityType>): GameRow[] {
  const rows: GameRow[] = [];
  for (const s of sessions) {
    if (s.deletedAt || footballKindOf(s, types) !== 'friendly') continue;
    const d = details.get(s.id);
    const fd = d && !d.deletedAt ? d : undefined;
    const base = {
      sessionId: s.id,
      date: s.date,
      kind: 'friendly' as const,
      team: cleanName(fd?.team),
      ...(fd?.homeAway ? { homeAway: fd.homeAway } : {}),
      ...(fd?.link ? { link: fd.link } : {}),
      ...(fd?.series ? { series: fd.series } : {}),
      ...(fd?.level ? { level: fd.level } : {}),
      ...(fd?.teamId ? { teamId: fd.teamId } : {}),
      ...(fd?.format ? { format: fd.format } : {}),
      ...(fd?.positions?.length ? { positions: fd.positions } : {}),
      games: 1,
    };
    const games = fd?.games ?? [];
    if (!games.length) {
      rows.push({ ...base, ...(fd?.playerGoals !== undefined ? { playerGoals: fd.playerGoals } : {}) });
      continue;
    }
    games.forEach((g, i) =>
      rows.push({
        ...base,
        index: i + 1,
        opponent: cleanName(g.opponent),
        goalsFor: g.goalsFor,
        goalsAgainst: g.goalsAgainst,
        outcome: outcomeOf(g.goalsFor, g.goalsAgainst),
        ...(g.note ? { note: g.note } : {}),
        ...(g.playerGoals !== undefined ? { playerGoals: g.playerGoals } : {}),
      }),
    );
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.sessionId.localeCompare(b.sessionId) || (a.index ?? 0) - (b.index ?? 0));
}

/**
 * V–T–H ja maalit vain peleistä, joissa molemmat maalimäärät on kirjattu (SPEC 8). Harjoituspelit ja seuran
 * sisäiset pelit (25.11.2026) eivät ole mukana.
 */
export function summarizeGames(rows: GameRow[]): GameSummary {
  let games = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let gf = 0;
  let ga = 0;
  let noResult = 0;
  let played = 0;
  let gamesWithPlayed = 0;
  let pg = 0;
  let pgGames = 0;
  for (const r of rows) {
    if (r.kind === 'friendly' || r.internal) continue;
    games += r.games;
    if (r.playerGoals !== undefined && r.playerGoals !== null) {
      pg += r.playerGoals;
      pgGames += r.games;
    }
    if (r.outcome) {
      gf += r.goalsFor!;
      ga += r.goalsAgainst!;
      if (r.outcome === 'W') wins++;
      else if (r.outcome === 'D') draws++;
      else losses++;
    } else noResult += r.games;
    if (r.playedMin !== undefined && r.playedMin !== null) {
      played += r.playedMin;
      gamesWithPlayed += r.games;
    }
  }
  return {
    games,
    wins,
    draws,
    losses,
    goalsFor: gf,
    goalsAgainst: ga,
    goalDiff: gf - ga,
    noResult,
    playedMinTotal: played,
    playedMinAvg: gamesWithPlayed > 0 ? played / gamesWithPlayed : null,
    playerGoals: pg,
    playerGoalsGames: pgGames,
  };
}

export interface GroupedSummary {
  key: string;
  label: string;
  summary: GameSummary;
}

/**
 * Näyttönimi samaa tarkoittavista kirjoitusasuista: yleisin; tasatilanteessa se, jossa on
 * enemmän isoja kirjaimia (esim. "HJK" ennen "hjk"), sitten viimeisin.
 */
export function preferredName(variants: string[]): string {
  const count = new Map<string, number>();
  variants.forEach((v) => count.set(v, (count.get(v) ?? 0) + 1));
  const caps = (s: string) => (s.match(/\p{Lu}/gu) ?? []).length;
  return [...count.entries()]
    .map(([v, n], i) => ({ v, n, caps: caps(v), last: variants.lastIndexOf(v), i }))
    .sort((a, b) => b.n - a.n || b.caps - a.caps || b.last - a.last)[0].v;
}

/** Yhteenveto ryhmittäin (oma joukkue, vastustaja, turnaus…); eniten pelatut ensin. */
export function summarizeBy(rows: GameRow[], label: (r: GameRow) => string | undefined): GroupedSummary[] {
  const groups = new Map<string, { labels: string[]; rows: GameRow[] }>();
  for (const r of rows) {
    const l = label(r);
    if (!l) continue;
    const key = normalizeName(l);
    const g = groups.get(key) ?? { labels: [], rows: [] };
    g.labels.push(l);
    g.rows.push(r);
    groups.set(key, g);
  }
  return [...groups.entries()]
    .map(([key, g]) => ({ key, label: preferredName(g.labels), summary: summarizeGames(g.rows) }))
    .sort((a, b) => b.summary.games - a.summary.games || a.label.localeCompare(b.label, 'fi'));
}

/** Pelipaikoittain: peli lasketaan jokaiselle paikalle, jolla lapsi pelasi. */
export function summarizeByPosition(rows: GameRow[]): GroupedSummary[] {
  return POSITIONS.map((p) => ({ key: p, label: POSITION_LABEL[p], summary: summarizeGames(rows.filter((r) => r.positions?.includes(p))) })).filter(
    (g) => g.summary.games > 0,
  );
}

/** Pelipaikat ja peliaika (SPEC 16): pelipaikkojen jakauma ja peliaikaosuus kausittain. */
export interface PlaySummary {
  games: number;
  /** Pelit, joille on merkitty vähintään yksi pelipaikka. */
  positionGames: number;
  /** Pelit pelipaikoittain (peli lasketaan jokaiselle merkitylle paikalle). */
  positions: Record<FieldPosition, number>;
  /** Kentällä vietetty osuus peliajasta (0–1) peleistä, joista se tiedetään; null, jos ei yhtään. */
  share: number | null;
  /** Montako peliä osuus kattaa. */
  shareGames: number;
  /** Pelasiko-merkinnät: koko pelin, osan, ei pelannut. */
  played: Record<PlayedState, number>;
}

/**
 * Peliaikaosuus: tarkat minuutit / pelin pituus, tai "Koko pelin" = 1 ja "Ei pelannut" = 0;
 * "Osan" ilman minuutteja ei kerro osuutta, joten se ei ole osuudessa mukana.
 */
export function playSummary(rows: GameRow[]): PlaySummary {
  const positions: Record<FieldPosition, number> = { gk: 0, def: 0, mid: 0, fwd: 0 };
  const played: Record<PlayedState, number> = { full: 0, part: 0, none: 0 };
  let games = 0;
  let positionGames = 0;
  let onField = 0;
  let length = 0;
  let shareGames = 0;
  for (const r of rows) {
    games += r.games;
    if (r.positions?.length) {
      positionGames += r.games;
      for (const p of new Set(r.positions)) positions[p] += r.games;
    }
    if (r.played) played[r.played] += r.games;
    const len = r.gameMin;
    if (!len || len <= 0) continue;
    if (r.playedMin !== undefined && r.playedMin !== null && !r.playedEstimate) {
      onField += Math.min(r.playedMin, len);
      length += len;
      shareGames += r.games;
    } else if (r.played === 'full' || r.played === 'none') {
      onField += r.played === 'full' ? len : 0;
      length += len;
      shareGames += r.games;
    }
  }
  return { games, positionGames, positions, share: length > 0 ? onField / length : null, shareGames, played };
}

/** Kausi ja vuosi pelilistan suodatukseen ja rinnakkaisvertailuun. */
export function seasonKey(d: ISODate): string {
  const p = seasonPeriod(d);
  const name = p.start.slice(5, 7) === '01' ? 'Kevät' : p.start.slice(5, 7) === '06' ? 'Kesä' : 'Syksy';
  return `${name} ${p.start.slice(0, 4)}`;
}

// ---------- mittarit jaksolta ----------

export interface FootballPeriodSummary {
  /** Treenien määrä ja minuutit. */
  training: { count: number; minutes: number };
  /** Pelit ja peliaika (turnaukset mukana, harjoituspelit eivät). */
  games: GameSummary;
  /** Harjoituspelit omana rivinään (17.11.2026): kerrat ja minuutit, ei tuloksia. */
  friendlies: { count: number; minutes: number };
  /** Osallistumisaste suunnitelmista: tehdyt / (tehdyt + väliin jääneet), perutut pois. */
  participation: AdherenceSummary;
  /** Osallistuminen kokonaan / osittain (kirjatuista lisätiedoista). */
  attendance: { full: number; partial: number };
  /** Sisällön jakauma vain tagitetuista kerroista. */
  tags: { tagged: number; counts: Partial<Record<FocusTag, number>> };
  /** Jalkapallokertoja jaksolla. */
  sessions: number;
  /** Kertoja, joilta lisätiedot puuttuvat ("Myöhemmin"). */
  withoutDetails: number;
}

export interface FootballInput {
  sessions: Session[];
  details: Map<UUID, FootballDetails>;
  types: Map<UUID, ActivityType>;
  planned: PlannedSession[];
  today: ISODate;
}

const inPeriod = (p: Period) => (d: ISODate) => d >= p.start && d <= p.end;

export function footballPeriodSummary(input: FootballInput, period: Period): FootballPeriodSummary {
  const within = inPeriod(period);
  const sessions = input.sessions.filter((s) => !s.deletedAt && !isTrainingSelf(s) && within(s.date) && footballKindOf(s, input.types));
  // Treenin omatoiminen verryttely ei ole oma treenikertansa (minuutit näkyvät kerrassa itsessään).
  const training = sessions.filter((s) => footballKindOf(s, input.types) === 'training' && !isTrainingSelf(s));
  const friendlies = sessions.filter((s) => footballKindOf(s, input.types) === 'friendly');
  const det = (s: Session) => {
    const d = input.details.get(s.id);
    return d && !d.deletedAt ? d : undefined;
  };

  const counts: Partial<Record<FocusTag, number>> = {};
  let tagged = 0;
  const attendance = { full: 0, partial: 0 };
  let withoutDetails = 0;
  for (const s of sessions) {
    const d = det(s);
    if (!d) {
      withoutDetails++;
      continue;
    }
    attendance[d.attendance]++;
    if (d.focusTags.length) {
      tagged++;
      for (const t of new Set(d.focusTags)) counts[t] = (counts[t] ?? 0) + 1;
    }
  }

  const footballTypeIds = new Set([...input.types.values()].filter((t) => t.sport === 'football').map((t) => t.id));
  const plans = input.planned.filter((p) => within(p.date) && footballTypeIds.has(p.activityTypeId));

  return {
    training: { count: training.length, minutes: training.reduce((a, s) => a + s.durationMin, 0) },
    games: summarizeGames(gameRows(sessions, input.details, input.types)),
    friendlies: { count: friendlies.length, minutes: friendlies.reduce((a, s) => a + s.durationMin, 0) },
    participation: planAdherence(plans, sessions, input.today),
    attendance,
    tags: { tagged, counts },
    sessions: sessions.length,
    withoutDetails,
  };
}

// ---------- trendit (vanhemman arvio ja viihtyminen) ----------

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export const TREND_WINDOW = 8;
export const TREND_MIN = 5;

export interface Trend {
  /** Viimeisten 8 kerran mediaani; null, jos arvioita < 5 (näytetään vasta, kun ≥ 5). */
  median: number | null;
  /** Arvioiden määrä kaudella tähän päivään asti. */
  count: number;
  /** Edellisten 8 mediaani (vertailu). */
  previousMedian: number | null;
  /** Lasku: viimeisten 8 mediaani < edellisten 8 mediaani, kummassakin ≥ 5 arviota. */
  declined: boolean;
}

/**
 * Trendi kuluvan kauden arvioista päivään `refDate` asti (vahvistettu tulkinta: arvioita ei
 * yhdistetä yli kausien). Ei keskiarvoa eikä "kehitysindeksiä" – mediaani kestää poikkeukset.
 */
export function footballTrend(
  input: Pick<FootballInput, 'sessions' | 'details' | 'types'>,
  refDate: ISODate,
  field: 'parentRating' | 'enjoyment',
): Trend {
  const season = seasonPeriod(refDate);
  const values = input.sessions
    .filter((s) => !s.deletedAt && s.date >= season.start && s.date <= refDate && footballKindOf(s, input.types))
    .map((s) => ({ s, d: input.details.get(s.id) }))
    .filter(({ d }) => d && !d.deletedAt && d[field] !== undefined)
    .sort((a, b) => a.s.date.localeCompare(b.s.date) || a.s.createdAt.localeCompare(b.s.createdAt))
    .map(({ d }) => d![field] as number);
  const last = values.slice(-TREND_WINDOW);
  const prev = values.slice(-2 * TREND_WINDOW, -TREND_WINDOW);
  const m = last.length >= TREND_MIN ? median(last) : null;
  const pm = prev.length >= TREND_MIN ? median(prev) : null;
  return { median: m, count: values.length, previousMedian: pm, declined: m !== null && pm !== null && m < pm };
}

/** Viitepäivä trendille: jakson loppu, mutta ei tulevaisuudessa. */
export const trendRefDate = (period: Period, today: ISODate) => minDate(period.end, today);

// ---------- CSV (pelilista) ----------

/** Pelilista CSV:nä: UTF-8 BOM ja puolipiste-erotin, jotta suomenkielinen Excel avaa sen oikein (SPEC 8, 10). */
export function gamesCsv(rows: GameRow[]): string {
  const esc = (v: string | number | undefined) => {
    const s = v === undefined || v === null ? '' : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['Päivä', 'Tapahtuma', 'Peli nro', 'Oma joukkue', 'Vastustaja', 'Tehdyt', 'Päästetyt', 'Tulos', 'Pelatut min', 'Pelejä', 'Pelaajan maalit', 'Pelimuoto', 'Pelipaikka'];
  const lines = rows.map((r) => {
    const [y, m, d] = r.date.split('-');
    return [
      `${Number(d)}.${Number(m)}.${y}`,
      r.kind === 'tournament' ? r.eventName ?? 'Turnaus' : r.kind === 'friendly' ? 'Harjoituspeli' : 'Peli',
      r.index,
      r.team,
      r.opponent,
      r.goalsFor,
      r.goalsAgainst,
      r.outcome ? OUTCOME_LABEL[r.outcome] : r.internal ? 'sisäinen' : 'ei tulosta',
      r.playedMin,
      r.games,
      r.playerGoals,
      r.format,
      r.positions?.map((p) => POSITION_LABEL[p]).join(', '),
    ]
      .map(esc)
      .join(';');
  });
  return '﻿' + [header.join(';'), ...lines].join('\r\n') + '\r\n';
}
