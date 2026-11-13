// Jaettava tuloskuva (SPEC 16): pelin tai turnauksen tulokset yhdeksi kortiksi. Puhdas funktio
// pelirivien (gameRows) pohjalta; piirto tehdään erikseen (features/share/drawResult).

import { LEVEL_LABEL, type GameOutcome, type GameRow } from './football';
import type { GameFormat, ISODate } from './types';

export interface ResultCardGame {
  opponent?: string;
  goalsFor?: number;
  goalsAgainst?: number;
  outcome?: GameOutcome;
  time?: string;
  playerGoals?: number;
}

export interface ResultCard {
  kind: 'game' | 'tournament';
  date: ISODate;
  eventName?: string;
  level?: string;
  format?: GameFormat;
  team?: string;
  games: ResultCardGame[];
  wins: number;
  draws: number;
  losses: number;
  /** Pelit ilman tulosta. */
  noResult: number;
  goalsFor: number;
  goalsAgainst: number;
  /** Oman lapsen maalit yhteensä (näytetään kuvassa vain, jos käyttäjä valitsee). */
  playerGoals: number;
}

/**
 * Yhden kerran (peli tai turnaus) pelirivit kortiksi. Palauttaa undefined, jos yhdelläkään pelillä
 * ei ole tulosta: tuloskuvassa ei olisi mitään jaettavaa.
 */
export function resultCard(rows: GameRow[]): ResultCard | undefined {
  const sorted = [...rows].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  if (!sorted.some((r) => r.outcome)) return undefined;
  const first = sorted[0];
  const games: ResultCardGame[] = sorted.map((r) => ({
    ...(r.opponent ? { opponent: r.opponent } : {}),
    ...(r.outcome ? { goalsFor: r.goalsFor, goalsAgainst: r.goalsAgainst, outcome: r.outcome } : {}),
    ...(r.time ? { time: r.time } : {}),
    ...(r.playerGoals ? { playerGoals: r.playerGoals } : {}),
  }));
  const played = games.filter((g) => g.outcome);
  return {
    kind: first.kind,
    date: first.date,
    ...(first.eventName ? { eventName: first.eventName } : {}),
    ...(first.level ? { level: LEVEL_LABEL[first.level] } : {}),
    ...(first.format ? { format: first.format } : {}),
    ...(first.team ? { team: first.team } : {}),
    games,
    wins: played.filter((g) => g.outcome === 'W').length,
    draws: played.filter((g) => g.outcome === 'D').length,
    losses: played.filter((g) => g.outcome === 'L').length,
    noResult: games.length - played.length,
    goalsFor: played.reduce((a, g) => a + (g.goalsFor ?? 0), 0),
    goalsAgainst: played.reduce((a, g) => a + (g.goalsAgainst ?? 0), 0),
    playerGoals: games.reduce((a, g) => a + (g.playerGoals ?? 0), 0),
  };
}

export const OUTCOME_WORD: Record<GameOutcome, string> = { W: 'Voitto', D: 'Tasapeli', L: 'Tappio' };

/** Kuvan yläotsikon tiedot: "Turnaus · Elite · 5v5". */
export function resultKicker(card: ResultCard): string {
  return [card.kind === 'tournament' ? 'Turnaus' : 'Ottelu', card.level, card.format].filter(Boolean).join(' · ');
}

/** Seuran nimikirjaimet logon puuttuessa: "FC Lahti 2018" → "FL", "HJK" → "HJK". */
export function initials(name: string | undefined): string {
  const words = (name ?? '').replace(/\d+/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
