// Turnauksen kesto otteluohjelmasta (SPEC 16, käyttäjän vahvistama 12.11.2026):
// aktiivinen aika = pelien määrä × (lämmittely + pelin pituus) + loppuverryttely.
// Pelien väliset odotukset eivät ole mukana, koska tehoarvio lasketaan kestosta.

import type { Fixture, GameFormat, HHmm, PlannedSession, ScheduledGame } from './types';
import { hhmmToMin, planEndMin, type EndOf } from './reminders';

/** Lämmittely ennen jokaista peliä (min). */
export const DEFAULT_WARMUP_MIN = 15;
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

/** Saapumisaika: ensimmäisen pelin alku − lämmittely; ilman kellonaikoja undefined. */
export function tournamentStart(games: ScheduledGame[], warmupMin: number): HHmm | undefined {
  const s = gameStarts(games);
  return s.length ? fmt(s[0] - Math.max(0, warmupMin)) : undefined;
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
