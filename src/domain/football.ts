// Jalkapallon seuranta (SPEC 8). Neljä erillistä osaa, joita ei yhdistetä pisteluvuksi:
// osallistuminen ja peliaika, harjoittelun sisältö, vanhemman arvio ja (myöhemmin) taitotestit.
// Tulokset ovat joukkueen tuloksia eivätkä vaikuta muihin mittareihin. Puhtaita funktioita.

import { planAdherence } from './adherence';
import { seasonPeriod, minDate } from './dates';
import type {
  ActivityType,
  AdherenceSummary,
  FocusTag,
  FootballDetails,
  FootballKind,
  ISODate,
  Period,
  PlannedSession,
  Session,
  UUID,
} from './types';

export type GameOutcome = 'W' | 'D' | 'L';

/** Yksi pelilistan rivi (SPEC 8 "Pelilista"). */
export interface GameRow {
  sessionId: UUID;
  date: ISODate;
  kind: 'game' | 'tournament';
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
  /** Montako peliä rivi edustaa: 1, tai turnaus ilman pelirivejä = gamesCount. */
  games: number;
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
    if (kind === 'game') {
      rows.push({
        sessionId: s.id,
        date: s.date,
        kind,
        team,
        opponent: cleanName(fd?.opponent),
        goalsFor: fd?.goalsFor,
        goalsAgainst: fd?.goalsAgainst,
        outcome: outcomeOf(fd?.goalsFor, fd?.goalsAgainst),
        playedMin: s.playedMin,
        games: 1,
      });
    } else if (fd?.games && fd.games.length > 0) {
      fd.games.forEach((g, i) =>
        rows.push({
          sessionId: s.id,
          date: s.date,
          kind,
          eventName: cleanName(fd.eventName),
          index: i + 1,
          team,
          opponent: cleanName(g.opponent),
          goalsFor: g.goalsFor,
          goalsAgainst: g.goalsAgainst,
          outcome: outcomeOf(g.goalsFor, g.goalsAgainst),
          playedMin: g.playedMin,
          games: 1,
        }),
      );
    } else {
      rows.push({
        sessionId: s.id,
        date: s.date,
        kind,
        eventName: cleanName(fd?.eventName),
        team,
        playedMin: s.playedMin,
        games: Math.max(1, fd?.gamesCount ?? 1),
      });
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.sessionId.localeCompare(b.sessionId) || (a.index ?? 0) - (b.index ?? 0));
}

/** V–T–H ja maalit vain peleistä, joissa molemmat maalimäärät on kirjattu (SPEC 8). */
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
  for (const r of rows) {
    games += r.games;
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
  /** Pelit ja peliaika (turnaukset mukana). */
  games: GameSummary;
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
  const sessions = input.sessions.filter((s) => !s.deletedAt && within(s.date) && footballKindOf(s, input.types));
  const training = sessions.filter((s) => footballKindOf(s, input.types) === 'training');
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
  const header = ['Päivä', 'Tapahtuma', 'Peli nro', 'Oma joukkue', 'Vastustaja', 'Tehdyt', 'Päästetyt', 'Tulos', 'Pelatut min', 'Pelejä'];
  const lines = rows.map((r) => {
    const [y, m, d] = r.date.split('-');
    return [
      `${Number(d)}.${Number(m)}.${y}`,
      r.kind === 'tournament' ? r.eventName ?? 'Turnaus' : 'Peli',
      r.index,
      r.team,
      r.opponent,
      r.goalsFor,
      r.goalsAgainst,
      r.outcome ? OUTCOME_LABEL[r.outcome] : 'ei tulosta',
      r.playedMin,
      r.games,
    ]
      .map(esc)
      .join(';');
  });
  return '﻿' + [header.join(';'), ...lines].join('\r\n') + '\r\n';
}
