// Turnauksen kesto otteluohjelmasta (SPEC 16, käyttäjän vahvistama 12.11.2026):
// aktiivinen aika = pelien määrä × (lämmittely + pelin pituus) + loppuverryttely.
// Pelien väliset odotukset eivät ole mukana, koska tehoarvio lasketaan kestosta.

import type { Fixture, GameFormat, HHmm, PlannedSession, ScheduledGame } from './types';
import { hhmmToMin, planEndMin, type EndOf } from './reminders';

/** Lämmittely ennen jokaista peliä (min): alkuverryttely alkaa 15 min ennen peliä. */
export const DEFAULT_WARMUP_MIN = 15;
/** Peleihin ja turnauksiin saavutaan aina 30 min ennen ensimmäistä peliä (käyttäjän tieto 13.11.2026). */
export const ARRIVAL_LEAD_MIN = 30;
/** Loppuverryttely viimeisen pelin jälkeen (min), valinnainen. */
export const DEFAULT_COOLDOWN_MIN = 0;
/**
 * Yhden turnauspelin oletuspituus pelimuodon mukaan (min). 5v5 = 1 × 20 (käyttäjän tieto);
 * muut sovelluksen oletuksia, muutettavissa tapahtumakohtaisesti.
 */
export const DEFAULT_GAME_LENGTH: Readonly<Record<GameFormat, number>> = Object.freeze({
  '3v3': 15,
  '5v5': 20,
  '7v7': 25,
  '8v8': 30,
  '9v9': 30,
  '11v11': 40,
});
export const FALLBACK_GAME_LENGTH = 20;

export const defaultGameLength = (format?: GameFormat) => (format ? DEFAULT_GAME_LENGTH[format] : FALLBACK_GAME_LENGTH);

export interface TournamentTiming {
  games: number;
  gameLengthMin: number;
  warmupMin: number;
  cooldownMin: number;
}

/** Aktiivinen kesto (min). */
export function tournamentDuration(t: TournamentTiming): number {
  return Math.max(0, t.games) * (Math.max(0, t.warmupMin) + Math.max(0, t.gameLengthMin)) + Math.max(0, t.cooldownMin);
}

const fmt = (m: number): HHmm => {
  const x = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}` as HHmm;
};

const gameStarts = (games: ScheduledGame[]) =>
  games
    .map((g) => g.time)
    .filter((t): t is HHmm => !!t)
    .map(hhmmToMin)
    .sort((a, b) => a - b);

/** Ensimmäisen pelin alku minuutteina; ilman kellonaikoja undefined. */
export const firstGameMin = (games: ScheduledGame[]): number | undefined => gameStarts(games)[0];

/** Saapumisaika: ensimmäisen pelin alku − 30 min (vähintään lämmittelyn verran); ilman kellonaikoja undefined. */
export function tournamentStart(games: ScheduledGame[], warmupMin: number = DEFAULT_WARMUP_MIN): HHmm | undefined {
  const first = firstGameMin(games);
  return first === undefined ? undefined : fmt(first - Math.max(ARRIVAL_LEAD_MIN, warmupMin));
}

/** Aiempi sääntö (ensimmäinen peli − lämmittely): tunnistaa ennen 13.11.2026 tallennetut turnaukset. */
export function legacyTournamentStart(games: ScheduledGame[], warmupMin: number): HHmm | undefined {
  const first = firstGameMin(games);
  return first === undefined ? undefined : fmt(first - Math.max(0, warmupMin));
}

/** Pelipäivän aikataulu pelin alusta: saapuminen 30 min ja lämmittely 15 min ennen (tai annettu lämmittely). */
export function gameDaySchedule(kickoff: HHmm, warmupMin: number = DEFAULT_WARMUP_MIN): { arrival: HHmm; warmup: HHmm } {
  const k = hhmmToMin(kickoff);
  const w = Math.max(0, warmupMin);
  return { arrival: fmt(k - Math.max(ARRIVAL_LEAD_MIN, w)), warmup: fmt(k - w) };
}

/** Päättymisaika minuutteina: viimeisen pelin alku + pelin pituus + loppuverryttely; ilman kellonaikoja undefined. */
export function tournamentEndMin(games: ScheduledGame[], gameLengthMin: number, cooldownMin: number): number | undefined {
  const s = gameStarts(games);
  return s.length ? s[s.length - 1] + Math.max(0, gameLengthMin) + Math.max(0, cooldownMin) : undefined;
}

/** Kerran päättymisaika: turnauksella viimeinen peli + pituus + verryttely, muuten alku + kesto. */
export function endOfWithFixtures(fixtures: Map<string, Fixture>): EndOf {
  return (p: PlannedSession) => {
    const f = fixtures.get(p.id);
    if (f?.games?.length) {
      const end = tournamentEndMin(f.games, f.gameLengthMin ?? defaultGameLength(f.format), f.cooldownMin ?? DEFAULT_COOLDOWN_MIN);
      if (end !== undefined) return end;
    }
    return planEndMin(p);
  };
}
