// Jalkapallon kausikortin seuraavat pelit (27.11.2026): kolme seuraavaa kalenterin peliä, juokseva laskuri
// ensimmäisen alkuun ja viimeisten pelien tulokset. Puhdas laskenta; näyttö features/games/FootballHero.

import { diffDays, localDateOf, parseISODate } from './dates';
import type { GameOutcome, GameRow } from './football';
import { previewCard, type PreviewCard } from './previewCard';
import { hhmmToMin } from './reminders';
import { DEFAULT_COOLDOWN_MIN, DEFAULT_WARMUP_MIN, defaultGameLength, tournamentEndMin } from './tournamentTime';
import type { Fixture, ISODate, PlannedSession } from './types';

export interface UpcomingEntry {
  plan: PlannedSession;
  fixture?: Fixture;
}

/** Montako tulevaa peliä kausikortissa näytetään: seuraava + kolme tulevaa (27.11.2026). */
export const NEXT_GAMES_COUNT = 4;
/** Montako viimeisintä tulosta näytetään. */
export const RECENT_FORM_COUNT = 5;

/** Pelin (turnauksessa ensimmäisen pelin) alku minuutteina vuorokauden alusta; ilman kellonaikaa undefined. */
export function kickoffMin(e: UpcomingEntry): number | undefined {
  const k = previewCard(e.plan, e.fixture).kickoff ?? e.plan.startTime;
  return k ? hhmmToMin(k) : undefined;
}

/**
 * Päättymisaika minuutteina: turnaus otteluohjelmasta (muuten alku + kesto), harjoituspeli alku + kesto, ottelu
 * alku + kesto ilman lämmittelyä (ottelun kesto sisältää lämmittelyn, joka on ennen pelin alkua; vähintään 20 min).
 */
export function endMin(e: UpcomingEntry): number | undefined {
  const k = kickoffMin(e);
  if (k === undefined) return undefined;
  const f = e.fixture;
  const dur = Math.max(1, e.plan.durationMin);
  if (e.plan.activityTypeId === 't:football_tournament') {
    const end = f?.games?.length ? tournamentEndMin(f.games, f.gameLengthMin ?? defaultGameLength(f.format), f.cooldownMin ?? DEFAULT_COOLDOWN_MIN) : undefined;
    return end ?? (e.plan.startTime ? hhmmToMin(e.plan.startTime) : k) + dur;
  }
  if (e.plan.activityTypeId === 't:football_friendly') return k + dur;
  return k + Math.max(20, dur - (f?.warmupMin ?? DEFAULT_WARMUP_MIN));
}

/** Avoimet tulevat (tänään tai myöhemmin) aikajärjestyksessä; kellonajattomat päivän lopussa. */
export function nextFixtures<T extends UpcomingEntry>(entries: readonly T[], today: ISODate, n: number = NEXT_GAMES_COUNT): T[] {
  const at = (e: T) => kickoffMin(e) ?? 24 * 60;
  return entries
    .filter((e) => !e.plan.deletedAt && e.plan.status === 'open' && e.plan.date >= today)
    .sort((a, b) => a.plan.date.localeCompare(b.plan.date) || at(a) - at(b))
    .slice(0, n);
}

/**
 * Laskurin tila hetkellä now: 'until' = aikaa alkuun (ms); 'day' = ei kellonaikaa, päiviä jäljellä;
 * 'live' = alkanut, ei vielä päättynyt; 'ended' = päättynyt (tulos kirjaamatta).
 */
export type Countdown = { state: 'until'; ms: number } | { state: 'day'; days: number } | { state: 'live' } | { state: 'ended' };

export function countdownOf(e: UpcomingEntry, now: Date): Countdown {
  const k = kickoffMin(e);
  if (k === undefined) return { state: 'day', days: Math.max(0, diffDays(localDateOf(now), e.plan.date)) };
  const { year, month, day } = parseISODate(e.plan.date);
  const start = new Date(year, month - 1, day, 0, k).getTime();
  const t = now.getTime();
  if (t < start) return { state: 'until', ms: start - t };
  const end = new Date(year, month - 1, day, 0, endMin(e) ?? k + 60).getTime();
  return t < end ? { state: 'live' } : { state: 'ended' };
}

/** Aika osiin: päivät, tunnit, minuutit, sekunnit (alaspäin pyöristäen). */
export function splitMs(ms: number): { days: number; hours: number; minutes: number; seconds: number } {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

/** "tänään", "huomenna", "5 pv". */
export function daysUntilLabel(date: ISODate, today: ISODate): string {
  const d = diffDays(today, date);
  return d <= 0 ? 'tänään' : d === 1 ? 'huomenna' : `${d} pv`;
}

/** Kortin otsikko: "vs Ilves", turnauksen nimi tai tapahtuman laji. */
export function fixtureTitle(card: PreviewCard): string {
  if (card.kind === 'tournament') return card.eventName ?? 'Turnaus';
  const opponents = card.games.map((g) => g.opponent).filter((o): o is string => !!o);
  if (opponents.length) return `vs ${opponents.join(', ')}`;
  return card.kind === 'friendly' ? 'Harjoituspeli' : 'Peli';
}

export const FIXTURE_KIND_LABEL: Readonly<Record<PreviewCard['kind'], string>> = Object.freeze({ game: 'Peli', friendly: 'Harjoituspeli', tournament: 'Turnaus' });

/** Viimeisimmät tulokset vanhimmasta uusimpaan (ei harjoituspelejä, seuran sisäisiä eikä tuloksettomia). */
export function recentForm(rows: readonly GameRow[], n: number = RECENT_FORM_COUNT): (GameRow & { outcome: GameOutcome })[] {
  return rows
    .filter((r): r is GameRow & { outcome: GameOutcome } => r.kind !== 'friendly' && !r.internal && !!r.outcome)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '') || (a.index ?? 0) - (b.index ?? 0))
    .slice(-n);
}
