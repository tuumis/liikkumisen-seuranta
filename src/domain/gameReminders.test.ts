import { describe, expect, it } from 'vitest';
import { gameSlots, gamesEndedBetween, gameSlotTag } from './gameReminders';
import { planned } from './test-helpers';
import type { Fixture, FootballDetails } from './types';

const DAY = '2026-11-24';
const fx = (plannedSessionId: string, over: Partial<Fixture> = {}): Fixture => ({ plannedSessionId, updatedAt: 'x', updatedBy: 'd', ...over }) as Fixture;
const fd = (over: Partial<FootballDetails>): FootballDetails => ({ sessionId: 's', attendance: 'full', focusTags: [], updatedAt: 'x', updatedBy: 'd', ...over });

describe('pelin päättymisilmoitus (24.11.2026)', () => {
  it('ottelu: alku + kesto; turnaus: jokainen peli otteluohjelman ajasta + pelin pituus', () => {
    const game = planned({ id: 'g', date: DAY, activityTypeId: 't:football_game', startTime: '10:00', durationMin: 75 });
    const tour = planned({ id: 't', date: DAY, activityTypeId: 't:football_tournament', startTime: '08:30', durationMin: 240 });
    const slots = gameSlots([
      { plan: game, fixture: fx('g', { opponent: 'HJK' }) },
      { plan: tour, fixture: fx('t', { eventName: 'Syyscup', gameLengthMin: 20, games: [{ time: '09:00', opponent: 'PK-35' }, { time: '11:00' }, {}] }) },
    ]);
    expect(slots.map((s) => [gameSlotTag(s), s.endMin, s.title])).toEqual([
      ['game-g-0', 11 * 60 + 15, 'Peli päättyi: HJK'],
      ['game-t-0', 9 * 60 + 20, 'Syyscup: peli 1 päättyi (PK-35)'],
      ['game-t-1', 11 * 60 + 20, 'Syyscup: peli 2 päättyi'],
    ]);
    expect(gamesEndedBetween(slots, 9 * 60 + 19, 9 * 60 + 20).map((s) => s.index)).toEqual([0]);
  });

  it('kirjattu tulos tai ohitettu peli ei tuota ilmoitusta', () => {
    const tour = planned({ id: 't', date: DAY, activityTypeId: 't:football_tournament', status: 'done' });
    const slots = gameSlots([
      { plan: tour, fixture: fx('t', { gameLengthMin: 20, games: [{ time: '09:00' }, { time: '10:00' }] }), details: fd({ games: [{ goalsFor: 1, goalsAgainst: 0 }, {}] }) },
      { plan: planned({ id: 'x', date: DAY, activityTypeId: 't:football_game', startTime: '12:00', status: 'skipped' }) },
    ]);
    expect(slots.map((s) => s.recorded)).toEqual([true, false]);
    expect(gamesEndedBetween(slots, 0, 24 * 60).map((s) => s.index)).toEqual([1]);
  });
});
