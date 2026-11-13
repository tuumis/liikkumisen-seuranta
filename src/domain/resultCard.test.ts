// Jaettava tuloskuva (SPEC 16): kortin tiedot peliriveistä.

import { describe, expect, it } from 'vitest';
import type { GameRow } from './football';
import { initials, resultCard, resultKicker } from './resultCard';

const base = { sessionId: 's1', date: '2026-11-21', games: 1, team: 'FC Lahti 2018', level: 'elite', format: '5v5' } as const;

describe('tuloskortti', () => {
  it('turnaus: pelit järjestyksessä, V–T–H ja maalit vain tuloksellisista', () => {
    const rows: GameRow[] = [
      { ...base, kind: 'tournament', eventName: 'Winterliiga', index: 2, opponent: 'HoDy 18', goalsFor: 1, goalsAgainst: 1, outcome: 'D', time: '15:00' },
      { ...base, kind: 'tournament', eventName: 'Winterliiga', index: 1, opponent: 'FC Kirkkonummi', goalsFor: 3, goalsAgainst: 1, outcome: 'W', time: '14:00', playerGoals: 2 },
      { ...base, kind: 'tournament', eventName: 'Winterliiga', index: 3, opponent: 'FC Nõmme United' },
    ];
    const c = resultCard(rows)!;
    expect(c.games.map((g) => g.opponent)).toEqual(['FC Kirkkonummi', 'HoDy 18', 'FC Nõmme United']);
    expect(c).toMatchObject({ kind: 'tournament', eventName: 'Winterliiga', level: 'Elite', team: 'FC Lahti 2018', wins: 1, draws: 1, losses: 0, noResult: 1, goalsFor: 4, goalsAgainst: 2, playerGoals: 2 });
    expect(c.games[2].outcome).toBeUndefined();
    expect(resultKicker(c)).toBe('Turnaus · Elite · 5v5');
  });

  it('ilman yhtään tulosta ei korttia', () => {
    expect(resultCard([{ ...base, kind: 'game', opponent: 'HJK' }])).toBeUndefined();
    expect(resultCard([])).toBeUndefined();
  });

  it('yksittäinen peli ja nimikirjaimet', () => {
    const c = resultCard([{ ...base, kind: 'game', opponent: 'HJK East', goalsFor: 0, goalsAgainst: 2, outcome: 'L' }])!;
    expect(c).toMatchObject({ kind: 'game', losses: 1, goalsFor: 0, goalsAgainst: 2, playerGoals: 0 });
    expect(resultKicker(c)).toBe('Ottelu · Elite · 5v5');
    expect(initials('FC Lahti 2018')).toBe('FL');
    expect(initials('HJK')).toBe('HJK');
    expect(initials(undefined)).toBe('?');
  });
});
