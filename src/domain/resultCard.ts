// Jaettava tuloskuva (SPEC 16): pelin tai turnauksen tulokset yhdeksi kortiksi. Puhdas funktio
// pelirivien (gameRows) pohjalta; piirto tehdään erikseen (features/share/drawResult).

import { LEVEL_LABEL, type GameOutcome, type GameRow } from './football';
import { parseTeamName } from './opponent';
import type { GameFormat, HomeAway, ISODate } from './types';

export interface ResultCardGame {
  opponent?: string;
  goalsFor?: number;
  goalsAgainst?: number;
  outcome?: GameOutcome;
  time?: string;
  playerGoals?: number;
  /** Koti- vai vieraspeli oman joukkueen kannalta (18.11.2026). */
  homeAway?: HomeAway;
  /** Seuran sisäinen peli (25.11.2026): tulos ilman V/T/H:ta, ei yhteenvedossa; kuvassa vain valittaessa. */
  internal?: true;
}

export interface ResultCard {
  kind: 'game' | 'tournament';
  date: ISODate;
  eventName?: string;
  level?: string;
  format?: GameFormat;
  /** Sarja, esim. P9 (18.11.2026). */
  series?: string;
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
  /** Ottelun alku ja paikka (kalenterin tapahtumasta tai kerrasta), jos tiedossa. */
  kickoff?: string;
  location?: string;
  /** Valinnainen kommentti kuvaan (18.11.2026). */
  comment?: string;
}

/**
 * Yhden kerran (peli tai turnaus) pelirivit kortiksi. Palauttaa undefined, jos yhdelläkään pelillä
 * ei ole tulosta: tuloskuvassa ei olisi mitään jaettavaa.
 */
export function resultCard(rows: GameRow[]): ResultCard | undefined {
  // Harjoituspelit eivät ole tuloskuvan pelejä (17.11.2026).
  const sorted = rows.filter((r): r is GameRow & { kind: 'game' | 'tournament' } => r.kind !== 'friendly').sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  if (!sorted.some((r) => r.outcome)) return undefined;
  const first = sorted[0];
  const games: ResultCardGame[] = sorted.map((r) => ({
    ...(r.opponent ? { opponent: r.opponent } : {}),
    ...(r.outcome ? { goalsFor: r.goalsFor, goalsAgainst: r.goalsAgainst, outcome: r.outcome } : {}),
    ...(r.internal && r.goalsFor !== undefined && r.goalsAgainst !== undefined ? { goalsFor: r.goalsFor, goalsAgainst: r.goalsAgainst } : {}),
    ...(r.time ? { time: r.time } : {}),
    ...(r.playerGoals ? { playerGoals: r.playerGoals } : {}),
    ...(r.homeAway ? { homeAway: r.homeAway } : {}),
    ...(r.internal ? { internal: true as const } : {}),
  }));
  const played = games.filter((g) => g.outcome);
  const counted = games.filter((g) => !g.internal);
  return {
    kind: first.kind,
    date: first.date,
    ...(first.eventName ? { eventName: first.eventName } : {}),
    ...(first.level ? { level: LEVEL_LABEL[first.level] } : {}),
    ...(first.format ? { format: first.format } : {}),
    ...(first.series ? { series: first.series } : {}),
    ...(first.team ? { team: first.team } : {}),
    games,
    wins: played.filter((g) => g.outcome === 'W').length,
    draws: played.filter((g) => g.outcome === 'D').length,
    losses: played.filter((g) => g.outcome === 'L').length,
    noResult: counted.length - played.length,
    goalsFor: played.reduce((a, g) => a + (g.goalsFor ?? 0), 0),
    goalsAgainst: played.reduce((a, g) => a + (g.goalsAgainst ?? 0), 0),
    playerGoals: counted.reduce((a, g) => a + (g.playerGoals ?? 0), 0),
  };
}

/** Pelattujen (tuloksellisten) pelien määrä yhteenvetoon: seuran sisäiset eivät ole mukana. */
export const playedCount = (card: Pick<ResultCard, 'wins' | 'draws' | 'losses'>): number => card.wins + card.draws + card.losses;

/** Seuran sisäiset pelit pois kuvasta (25.11.2026, oletus); ennakko- ja tuloskortille. */
export function withoutInternal<T extends { games: { internal?: true }[] }>(card: T): T {
  return card.games.some((g) => g.internal) ? { ...card, games: card.games.filter((g) => !g.internal) } : card;
}

export const OUTCOME_WORD: Record<GameOutcome, string> = { W: 'Voitto', D: 'Tasapeli', L: 'Tappio' };

/** Kuvan yläotsikon tiedot: "Turnaus · Elite · 5v5". */
export function resultKicker(card: ResultCard): string {
  return [card.kind === 'tournament' ? 'Turnaus' : 'Ottelu', card.series, card.level, card.format].filter(Boolean).join(' · ');
}

/** Seuran nimikirjaimet logon puuttuessa: "FC Lahti 2018" → "FL", "HJK · Valkoinen · 2016" → "HJK". */
export function initials(name: string | undefined): string {
  const club = parseTeamName(name).club.trim() || (name ?? '');
  const words = club.replace(/\d+/g, ' ').replace(/[·/|]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
