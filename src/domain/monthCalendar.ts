// Jalkapallokalenterin kuukausinäkymä ja tuloste (18.11.2026): kuukauden ruudukko (ma–su, ISO-viikot)
// ja päivän tapahtumat pelikalenterista, kirjatuista peleistä ja (valinnaisesti) treeneistä.
// Puhdas laskenta: näkymä ja tuloste käyttävät samaa.

import { addDays, datesBetween, endOfIsoWeek, isoWeek, lastDayOfMonth, startOfIsoWeek, toISODate } from './dates';
import { OUTCOME_LABEL } from './football';
import { displayTeamName, parseTeamName } from './opponent';
import { gameDaySchedule } from './tournamentTime';
import type { CalendarNote, Fixture, GameLevel, HHmm, HomeAway, ISODate, PlannedSession, UUID } from './types';
import type { GameOutcome, GameRow } from './football';

/** Kuukausi muodossa YYYY-MM. */
export type MonthKey = string;

export const monthKeyOf = (d: ISODate): MonthKey => d.slice(0, 7);

/** Kuukauden siirto: addMonths('2026-11', 2) = '2027-01'. */
export function addMonths(m: MonthKey, n: number): MonthKey {
  const y = Number(m.slice(0, 4));
  const mo = Number(m.slice(5, 7)) - 1 + n;
  const yy = y + Math.floor(mo / 12);
  const mm = ((mo % 12) + 12) % 12;
  return `${String(yy).padStart(4, '0')}-${String(mm + 1).padStart(2, '0')}`;
}

export const firstOfMonth = (m: MonthKey): ISODate => `${m}-01`;
export const lastOfMonth = (m: MonthKey): ISODate => lastDayOfMonth(Number(m.slice(0, 4)), Number(m.slice(5, 7)));

export interface GridWeek {
  /** ISO-viikon numero. */
  week: number;
  /** Maanantaista sunnuntaihin; mukana myös viereisten kuukausien päivät. */
  days: ISODate[];
}

/** Kuukauden ruudukko: kokonaiset ISO-viikot, jotka osuvat kuukauteen. */
export function monthGrid(m: MonthKey): GridWeek[] {
  const out: GridWeek[] = [];
  const last = endOfIsoWeek(lastOfMonth(m));
  for (let d = startOfIsoWeek(firstOfMonth(m)); d <= last; d = addDays(d, 7)) {
    out.push({ week: isoWeek(d).week, days: datesBetween(d, addDays(d, 6)) });
  }
  return out;
}

/** Ruudukon koko näkyvä väli (ensimmäisen viikon maanantai – viimeisen sunnuntai). */
export function gridRange(m: MonthKey): { from: ISODate; to: ISODate } {
  return { from: startOfIsoWeek(firstOfMonth(m)), to: endOfIsoWeek(lastOfMonth(m)) };
}

export type Season = 'spring' | 'autumn';
export const SEASON_LABEL: Record<Season, string> = { spring: 'Kevätkausi', autumn: 'Syyskausi' };

/** Kevätkausi tammi–kesä, syyskausi heinä–joulu. */
export function seasonMonths(year: number, season: Season): MonthKey[] {
  const start = toISODate(year, season === 'spring' ? 1 : 7, 1).slice(0, 7);
  return Array.from({ length: 6 }, (_, i) => addMonths(start, i));
}

export function monthsFrom(start: MonthKey, count: number): MonthKey[] {
  return Array.from({ length: Math.max(1, Math.min(12, count)) }, (_, i) => addMonths(start, i));
}

/** note = kalenterimerkintä (muu kuin liikunta, 27.11.2026). */
export type CalKind = 'game' | 'tournament' | 'friendly' | 'training' | 'note';
/** upcoming = tuleva; pending = pelattu, tulos puuttuu; played = kirjattu; skipped = ei pelattu; planned = treeni. */
export type CalState = 'upcoming' | 'pending' | 'played' | 'skipped' | 'planned';

export interface CalGameLine {
  time?: HHmm;
  opponent?: string;
  location?: string;
  homeAway?: HomeAway;
  result?: string;
}

export interface CalEvent {
  key: string;
  date: ISODate;
  kind: CalKind;
  state: CalState;
  /** Aloitus (turnauksessa ensimmäinen peli, jos otteluohjelmassa on ajat). */
  time?: HHmm;
  /** Paikalla-aika (peli: lämmittelyn mukaan; turnaus: suunnitelman alku, kun otteluohjelmassa on ajat). */
  arrival?: HHmm;
  /** Vastustaja, harjoituspelin vastustajat tai turnauksen nimi; treenissä treenin nimi. */
  title: string;
  /** Vastustajien tallennetut nimet (ottelu, harjoituspeli); näkymä lyhentää tai muotoilee ne. */
  opponents?: string[];
  /** Esim. "2–1 V"; turnauksessa "2V 1T 1H". */
  result?: string;
  outcome?: GameOutcome;
  location?: string;
  homeAway?: HomeAway;
  series?: string;
  level?: GameLevel;
  teamId?: UUID;
  infoMissing?: boolean;
  missingNote?: string;
  /** Turnauksen ja harjoituspelin pelit (otteluohjelma, tulokset). */
  games?: CalGameLine[];
  planId?: UUID;
  sessionId?: UUID;
  durationMin?: number;
  /** Pelin tai turnauksen linkki. */
  link?: string;
  /** Perhekalenterissa: kenen tapahtuma (19.11.2026). */
  profileId?: UUID;
  /** Kalenterimerkintä koko perheelle (ei profiilia, 27.11.2026). */
  family?: boolean;
}

export interface CalTraining {
  id: string;
  date: ISODate;
  startTime?: HHmm;
  durationMin: number;
  /** Tarkenne tai lajin nimi. */
  name: string;
  /** Treenin joukkue tai ryhmä (19.11.2026). */
  teamId?: UUID;
}

export interface MonthEventsInput {
  today: ISODate;
  /** Pelien, harjoituspelien ja turnausten suunnitelmat (kaikki tilat) lisätietoineen. */
  fixtures: { plan: PlannedSession; fixture?: Fixture }[];
  /** Kirjatut pelit (gameRows + friendlyRows). */
  rows: GameRow[];
  /** Kirjattujen kertojen aloitusajat. */
  sessionStart?: ReadonlyMap<UUID, HHmm | undefined>;
  /** Kirjattujen kertojen kestot (min). */
  sessionDuration?: ReadonlyMap<UUID, number>;
  trainings?: CalTraining[];
  /** Kalenterimerkinnät (profiilin omat ja koko perheen, 27.11.2026). */
  notes?: CalendarNote[];
}

const KIND_OF_TYPE: Record<string, CalKind> = {
  't:football_game': 'game',
  't:football_tournament': 'tournament',
  't:football_friendly': 'friendly',
};

export const resultText = (gf?: number, ga?: number, outcome?: GameOutcome): string | undefined =>
  outcome && gf !== undefined && ga !== undefined ? `${gf}–${ga} ${OUTCOME_LABEL[outcome]}` : undefined;

/** Turnauksen tulos: "2V 1T 1H" (vain kirjatut, nollat pois). */
export function recordText(rows: Pick<GameRow, 'outcome'>[]): string | undefined {
  const n = { W: 0, D: 0, L: 0 };
  for (const r of rows) if (r.outcome) n[r.outcome]++;
  const parts = (['W', 'D', 'L'] as const).filter((k) => n[k]).map((k) => `${n[k]}${OUTCOME_LABEL[k]}`);
  return parts.length ? parts.join(' ') : undefined;
}

/** Suunnitelman aloitus- ja paikalla-aika lajin mukaan (sama kuin kalenterilistassa). */
function timesOf(kind: CalKind, plan: Pick<PlannedSession, 'startTime'>, f?: Fixture): { time?: HHmm; arrival?: HHmm } {
  const start = plan.startTime;
  if (!start) return kind === 'tournament' ? { time: f?.games?.find((g) => g.time)?.time } : {};
  if (kind === 'game') return { time: start, arrival: gameDaySchedule(start, f?.warmupMin).arrival };
  if (kind === 'tournament' && f?.games?.some((g) => g.time) && !f.durationManual) return { time: f.games.find((g) => g.time)?.time, arrival: start };
  return { time: start };
}

function titleOf(kind: CalKind, f?: Fixture): string {
  if (kind === 'tournament') return f?.eventName ?? 'Turnaus';
  if (kind === 'friendly') return (f?.games ?? []).map((g) => g.opponent).filter(Boolean).join(', ') || 'Harjoituspeli';
  return f?.opponent ?? 'Vastustaja ?';
}

/** Kirjatun turnauksen tai harjoituspelin pelirivit; turnaus ilman pelirivejä (vain pelimäärä) = ei rivejä. */
function linesOf(kind: CalKind, rows: GameRow[]): CalGameLine[] | undefined {
  const list = rows
    .filter((r) => kind !== 'tournament' || r.index)
    .map((r) => ({ time: r.time, opponent: r.opponent, homeAway: r.homeAway, result: resultText(r.goalsFor, r.goalsAgainst, r.outcome) }));
  return list.length ? list : undefined;
}

const nonEmpty = (list: (string | undefined)[]): string[] | undefined => {
  const out = list.filter((x): x is string => !!x);
  return out.length ? out : undefined;
};

function opponentsOf(kind: CalKind, f?: Fixture): string[] | undefined {
  if (kind === 'game') return nonEmpty([f?.opponent]);
  if (kind === 'friendly') return nonEmpty((f?.games ?? []).map((g) => g.opponent));
  return undefined;
}

const byTime = (a: CalEvent, b: CalEvent) => (a.time ?? a.arrival ?? '99').localeCompare(b.time ?? b.arrival ?? '99') || a.key.localeCompare(b.key);

/**
 * Päivän tapahtumat: avoimet suunnitelmat (tuleva / tulos puuttuu), ei pelatut, kirjatut pelit tuloksineen
 * (myös suoraan kirjatut ilman kalenteria) ja valinnaiset treenit. Kuitatun suunnitelman tilalla näkyy kerta.
 */
export function monthEvents(input: MonthEventsInput): Map<ISODate, CalEvent[]> {
  const out = new Map<ISODate, CalEvent[]>();
  const add = (e: CalEvent) => out.set(e.date, [...(out.get(e.date) ?? []), e]);
  const fixtureBySession = new Map<UUID, Fixture | undefined>();

  for (const { plan, fixture: f } of input.fixtures) {
    const kind = KIND_OF_TYPE[plan.activityTypeId];
    if (!kind) continue;
    if (plan.status === 'done') {
      if (plan.sessionId) fixtureBySession.set(plan.sessionId, f);
      continue;
    }
    const state: CalState = plan.status === 'skipped' ? 'skipped' : plan.date >= input.today ? 'upcoming' : 'pending';
    const games =
      kind === 'tournament' || kind === 'friendly'
        ? (f?.games ?? []).map((g) => ({ time: g.time, opponent: g.opponent, location: g.location, homeAway: g.homeAway ?? (kind === 'friendly' ? f?.homeAway : undefined) }))
        : undefined;
    add({
      key: plan.id,
      date: plan.date,
      kind,
      state,
      ...timesOf(kind, plan, f),
      title: titleOf(kind, f),
      opponents: opponentsOf(kind, f),
      location: f?.location,
      homeAway: kind === 'tournament' ? undefined : f?.homeAway,
      series: f?.series,
      level: f?.level,
      teamId: f?.teamId,
      infoMissing: f?.infoMissing,
      missingNote: f?.missingNote,
      games: games?.length ? games : undefined,
      planId: plan.id,
      durationMin: plan.durationMin,
      link: f?.link,
    });
  }

  // Kirjatut: rivit kerroittain (turnauksessa ja harjoituspelissä useita).
  const bySession = new Map<UUID, GameRow[]>();
  for (const r of input.rows) bySession.set(r.sessionId, [...(bySession.get(r.sessionId) ?? []), r]);
  for (const [sessionId, rows] of bySession) {
    const first = rows[0];
    const f = fixtureBySession.get(sessionId);
    const kind: CalKind = first.kind;
    const start = input.sessionStart?.get(sessionId);
    const single = kind === 'game' || (kind === 'friendly' && rows.length === 1);
    add({
      key: sessionId,
      date: first.date,
      kind,
      state: 'played',
      time: kind === 'tournament' ? (rows.find((r) => r.time)?.time ?? start) : start,
      title:
        kind === 'tournament'
          ? (first.eventName ?? 'Turnaus')
          : kind === 'friendly'
            ? rows.map((r) => r.opponent).filter(Boolean).join(', ') || 'Harjoituspeli'
            : (first.opponent ?? 'Vastustaja ?'),
      opponents: kind === 'tournament' ? undefined : nonEmpty(rows.map((r) => r.opponent)),
      result: single ? resultText(first.goalsFor, first.goalsAgainst, first.outcome) : recordText(rows),
      outcome: single ? first.outcome : undefined,
      location: f?.location,
      homeAway: kind === 'tournament' ? undefined : first.homeAway,
      series: first.series ?? f?.series,
      level: first.level,
      teamId: first.teamId,
      games: kind === 'game' ? undefined : linesOf(kind, rows),
      sessionId,
      durationMin: input.sessionDuration?.get(sessionId),
      link: first.link ?? f?.link,
    });
  }

  for (const t of input.trainings ?? []) {
    add({ key: t.id, date: t.date, kind: 'training', state: 'planned', time: t.startTime, title: t.name, durationMin: t.durationMin, ...(t.teamId ? { teamId: t.teamId } : {}) });
  }
  for (const n of input.notes ?? []) {
    const dur = n.startTime && n.endTime ? toMin(n.endTime) - toMin(n.startTime) : undefined;
    add({
      key: n.id,
      date: n.date,
      kind: 'note',
      state: 'planned',
      title: n.title,
      ...(n.startTime ? { time: n.startTime } : {}),
      ...(dur !== undefined ? { durationMin: dur } : {}),
      ...(n.profileId ? {} : { family: true }),
    });
  }
  for (const list of out.values()) list.sort(byTime);
  return out;
}

export const KIND_ICON: Record<CalKind, string> = { game: '⚽', tournament: '🏆', friendly: '🤝', training: '👟', note: '📅' };
export const KIND_LABEL: Record<CalKind, string> = { game: 'Ottelu', tournament: 'Turnaus', friendly: 'Harjoituspeli', training: 'Treeni', note: 'Muu merkintä' };

/** Treeni tai kalenterimerkintä: näytetään himmeämpänä kuin pelit. */
export const isSubdued = (e: Pick<CalEvent, 'kind'>): boolean => e.kind === 'training' || e.kind === 'note';

/** Tapahtumat aikajärjestyksessä väliltä (otteluohjelma); treenit mukaan vain pyydettäessä. */
export function eventsBetween(events: ReadonlyMap<ISODate, CalEvent[]>, from: ISODate, to: ISODate, trainings = false): CalEvent[] {
  return datesBetween(from, to).flatMap((d) => (events.get(d) ?? []).filter((e) => trainings || e.kind !== 'training'));
}

export type NameMode = 'short' | 'compact' | 'full';

/**
 * Joukkueen nimi kalenteriin: short = seura ja ryhmä ("HJK Musta", kuukausiruutu), compact = osat
 * väleillä ("HJK Musta 2018", otteluohjelma), full = koko nimi ("HJK · Musta · 2018 syntyneet").
 */
export function teamNameFor(name: string, mode: NameMode): string {
  if (mode === 'full') return displayTeamName(name);
  const p = parseTeamName(name);
  return [p.club, p.group, mode === 'compact' ? p.age : undefined].filter(Boolean).join(' ') || name;
}

/** Tapahtuman nimi: vastustajat valitussa muodossa, muuten tapahtuman nimi. */
export function eventTitle(e: Pick<CalEvent, 'title' | 'opponents'>, mode: NameMode): string {
  if (!e.opponents) return e.title;
  return e.opponents.map((n) => teamNameFor(n, mode)).join(', ');
}

/** Kellonaika suomalaisittain: "09:30" → "9.30". */
export const clockText = (t?: string): string | undefined => t?.replace(/^0(\d)/, '$1').replace(':', '.');

// ---------- perhekalenteri (19.11.2026) ----------

/**
 * Yhdistää profiilien tapahtumat päivittäin ja merkitsee kunkin profiilin; päivän sisällä aikajärjestys.
 * Koko perheen kalenterimerkintä on jokaisen profiilin listalla: se näytetään kerran ilman profiilia.
 */
export function mergeProfileEvents(byProfile: { profileId: UUID; events: ReadonlyMap<ISODate, CalEvent[]> }[]): Map<ISODate, CalEvent[]> {
  const out = new Map<ISODate, CalEvent[]>();
  const seen = new Set<string>();
  for (const { profileId, events } of byProfile) {
    for (const [d, list] of events) {
      const add = list.filter((e) => !e.family || !seen.has(e.key)).map((e) => (e.family ? e : { ...e, profileId }));
      for (const e of add) if (e.family) seen.add(e.key);
      out.set(d, [...(out.get(d) ?? []), ...add]);
    }
  }
  for (const list of out.values()) list.sort(byTime);
  return out;
}

const toMin = (t: HHmm) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMin = (m: number): HHmm => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/**
 * Tapahtuman aikaikkuna minuutteina: alku = paikalla-aika tai aloitus, loppu = suunnitelman alku + kesto
 * (pelissä aloitus, turnauksessa paikalla-aika, kun otteluohjelmassa on ajat). Ilman aikaa undefined (koko päivä).
 */
export function eventWindow(e: Pick<CalEvent, 'kind' | 'time' | 'arrival' | 'durationMin'>): { start: number; end: number } | undefined {
  const first = e.arrival ?? e.time;
  if (!first) return undefined;
  const planStart = e.kind === 'tournament' && e.arrival ? e.arrival : (e.time ?? e.arrival)!;
  const start = toMin(first);
  // Kalenterimerkintä ilman päättymisaikaa: tunti.
  const end = Math.max(start + 15, toMin(planStart) + (e.durationMin ?? (e.kind === 'note' ? 60 : 90)));
  return { start, end };
}

/** Ikkuna tekstinä: "9.15–11.30"; ilman aikaa "aika auki". */
export function windowText(e: Pick<CalEvent, 'kind' | 'time' | 'arrival' | 'durationMin'>): string {
  const w = eventWindow(e);
  if (!w) return 'aika auki';
  return `${clockText(fromMin(w.start))}–${clockText(fromMin(Math.min(w.end, 24 * 60 - 1)))}`;
}

/**
 * Päällekkäiset tapahtumat eri profiileilla samana päivänä. Ilman kellonaikaa olevan tapahtuman
 * oletetaan kestävän koko päivän (tarkistettava). Ei pelattuja eikä profiilin omia päällekkäisyyksiä.
 */
export function clashes(day: CalEvent[]): [CalEvent, CalEvent][] {
  // Kalenterimerkinnät eivät ole mukana (vain pelit ja treenit).
  const list = day.filter((e) => e.profileId && e.state !== 'skipped' && e.kind !== 'note');
  const out: [CalEvent, CalEvent][] = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (a.profileId === b.profileId) continue;
      const wa = eventWindow(a);
      const wb = eventWindow(b);
      if (!wa || !wb || (wa.start < wb.end && wb.start < wa.end)) out.push([a, b]);
    }
  }
  return out;
}
