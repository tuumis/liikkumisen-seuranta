import { describe, expect, it } from 'vitest';
import { defaultGameLength, endOfWithFixtures, gameDaySchedule, legacyTournamentStart, tournamentDuration, tournamentEndMin, tournamentStart } from './tournamentTime';
import { planned } from './test-helpers';
import { hhmmToMin } from './reminders';
import type { ScheduledGame } from './types';

const winterliiga: ScheduledGame[] = [
  { time: '14:00', opponent: 'FC Kirkkonummi' },
  { time: '15:00', opponent: 'HoDy-18' },
  { time: '15:30', opponent: 'FC Nõmme United' },
];

describe('turnauksen kesto otteluohjelmasta', () => {
  it('aktiivinen aika: pelit × (lämmittely + pelin pituus) + loppuverryttely', () => {
    expect(tournamentDuration({ games: 3, gameLengthMin: 20, warmupMin: 15, cooldownMin: 0 })).toBe(105);
    expect(tournamentDuration({ games: 3, gameLengthMin: 20, warmupMin: 15, cooldownMin: 10 })).toBe(115);
    expect(tournamentDuration({ games: 0, gameLengthMin: 20, warmupMin: 15, cooldownMin: 10 })).toBe(10);
  });

  it('5v5-pelin oletus 20 min; ilman pelimuotoa 20', () => {
    expect(defaultGameLength('5v5')).toBe(20);
    expect(defaultGameLength(undefined)).toBe(20);
  });

  it('saapuminen = ensimmäinen peli − 30 min, loppu = viimeinen peli + pituus + verryttely (järjestyksestä riippumatta)', () => {
    expect(tournamentStart(winterliiga, 15)).toBe('13:30');
    expect(tournamentStart([{ time: '15:30' }, { time: '10:30' }], 15)).toBe('10:00');
    expect(tournamentStart(winterliiga, 40)).toBe('13:20'); // pitkä lämmittely: paikalle sen alkuun
    expect(legacyTournamentStart(winterliiga, 15)).toBe('13:45');
    expect(tournamentEndMin(winterliiga, 20, 10)).toBe(hhmmToMin('16:00'));
    expect(tournamentStart([{ opponent: 'X' }], 15)).toBeUndefined();
    expect(tournamentEndMin([], 20, 0)).toBeUndefined();
  });

  it('pelipäivän aikataulu: paikalla 30 min ja lämmittely 15 min ennen peliä', () => {
    expect(gameDaySchedule('14:00')).toEqual({ arrival: '13:30', warmup: '13:45' });
    expect(gameDaySchedule('00:10', 15)).toEqual({ arrival: '23:40', warmup: '23:55' });
  });

  it('päättymisaika muistutuksiin: turnaus otteluohjelmasta, muut alku + kesto', () => {
    const t = planned({ id: 'tour', date: '2026-11-21', startTime: '13:45', durationMin: 105 });
    const g = planned({ id: 'game', date: '2026-11-21', startTime: '10:00', durationMin: 60 });
    const endOf = endOfWithFixtures(new Map([['tour', { plannedSessionId: 'tour', games: winterliiga, gameLengthMin: 20, updatedAt: '', updatedBy: '' }]]));
    expect(endOf(t)).toBe(hhmmToMin('15:50'));
    expect(endOf(g)).toBe(hhmmToMin('11:00'));
  });
});
