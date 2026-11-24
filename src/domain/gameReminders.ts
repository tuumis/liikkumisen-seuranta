// Pelin päättymisilmoitus (24.11.2026, käyttäjän toive: tulokset nopeasti heti pelin jälkeen): PC:llä ilmoitus
// jokaisen pelin päätyttyä kalenterin mukaan. Turnauksessa peli kerrallaan otteluohjelman kellonajoista, ottelussa
// alku + kesto. Puhdas laskenta; ilmoitukset näyttää DesktopAgent.

import { hhmmToMin, planEndMin } from './reminders';
import { defaultGameLength } from './tournamentTime';
import type { Fixture, FootballDetails, GameResult, PlannedSession } from './types';

const GAME = 't:football_game';
const TOURNAMENT = 't:football_tournament';

export interface GameSlot {
  planId: string;
  /** Turnauksen pelin järjestys (0…); ottelussa 0. */
  index: number;
  /** Päättymishetki minuutteina vuorokauden alusta. */
  endMin: number;
  title: string;
  /** Tulos on jo kirjattu (ilmoitusta ei tarvita). */
  recorded: boolean;
}

const hasResult = (g?: Pick<GameResult, 'goalsFor' | 'goalsAgainst'>) => g?.goalsFor !== undefined && g?.goalsAgainst !== undefined;

/** Päivän pelit ilmoituksia varten; `details` = kirjatun kerran lisätiedot (kuitattu suunnitelma). */
export function gameSlots(entries: { plan: PlannedSession; fixture?: Fixture; details?: FootballDetails }[]): GameSlot[] {
  const out: GameSlot[] = [];
  for (const { plan, fixture, details } of entries) {
    if (plan.deletedAt || plan.status === 'skipped') continue;
    const fd = details && !details.deletedAt ? details : undefined;
    if (plan.activityTypeId === GAME) {
      const end = planEndMin(plan);
      if (end === undefined) continue;
      const opp = fd?.opponent ?? fixture?.opponent;
      out.push({ planId: plan.id, index: 0, endMin: end, title: opp ? `Peli päättyi: ${opp}` : 'Peli päättyi', recorded: hasResult(fd) });
    } else if (plan.activityTypeId === TOURNAMENT && fixture?.games?.length) {
      const len = fixture.gameLengthMin ?? defaultGameLength(fixture.format);
      const name = fixture.eventName ?? plan.label ?? 'Turnaus';
      fixture.games.forEach((g, i) => {
        if (!g.time) return;
        const opp = fd?.games?.[i]?.opponent ?? g.opponent;
        out.push({
          planId: plan.id,
          index: i,
          endMin: hhmmToMin(g.time) + len,
          title: `${name}: peli ${i + 1} päättyi${opp ? ` (${opp})` : ''}`,
          recorded: hasResult(fd?.games?.[i]),
        });
      });
    }
  }
  return out;
}

/** Välillä (fromMin, toMin] päättyneet pelit, joiden tulos puuttuu. */
export function gamesEndedBetween(slots: GameSlot[], fromMin: number, toMin: number): GameSlot[] {
  return slots.filter((s) => !s.recorded && s.endMin > fromMin && s.endMin <= toMin);
}

/** Ilmoituksen tunniste (sulkeminen tuloksen kirjauksen jälkeen). */
export const gameSlotTag = (s: Pick<GameSlot, 'planId' | 'index'>) => `game-${s.planId}-${s.index}`;
