// Treenin joukkue, vaihe 2 (19.11.2026): treenit ja pelit joukkueittain ja treeniryhmittäin.

import { describe, expect, it } from 'vitest';
import { gameTeamId, shortTeamName, teamBreakdown } from './teamBreakdown';
import { activityTypeId } from './ids';
import { session, typesMap } from './test-helpers';
import type { FootballDetails, Team } from './types';

const GAME = activityTypeId('football_game');
const TRAINING = activityTypeId('football_training');
const M = (n: number) => ({ light: 0, moderate: n, vigorous: 0 });
const team = (id: string, name: string, over: Partial<Team> = {}): Team => ({ id, profileId: 'p1', name, updatedAt: 'x', updatedBy: 'd', ...over }) as Team;
const fd = (sessionId: string, over: Partial<FootballDetails> = {}): FootballDetails => ({ sessionId, attendance: 'full', focusTags: [], updatedAt: 'x', updatedBy: 'd', ...over });

const A = team('a', 'FC Testi · Sininen · 2016');
const B = team('b', 'FC Testi · Musta · 2015');
const G = team('g', 'Pienryhmä', { kind: 'group' });
const period = { kind: 'season' as const, start: '2026-09-01', end: '2026-12-31' };

describe('joukkueittain', () => {
  it('treenit kerran joukkueesta, pelit joukkueesta tai nimestä; ryhmät erikseen', () => {
    const sessions = [
      session({ id: 't1', date: '2026-10-01', activityTypeId: TRAINING, minutes: M(90), teamId: 'a' }),
      session({ id: 't2', date: '2026-10-02', activityTypeId: TRAINING, minutes: M(60), teamId: 'a' }),
      session({ id: 't3', date: '2026-10-03', activityTypeId: TRAINING, minutes: M(45), teamId: 'g' }),
      session({ id: 't4', date: '2026-10-04', activityTypeId: TRAINING, minutes: M(75) }),
      session({ id: 't5', date: '2026-10-04', activityTypeId: TRAINING, minutes: M(10), teamId: 'a', linkedTo: 't1' }),
      session({ id: 'self', date: '2026-10-04', activityTypeId: activityTypeId('football_self'), minutes: M(30) }),
      session({ id: 'old', date: '2026-08-01', activityTypeId: TRAINING, minutes: M(60), teamId: 'a' }),
      session({ id: 'g1', date: '2026-10-05', activityTypeId: GAME, minutes: M(50) }),
      session({ id: 'g2', date: '2026-10-06', activityTypeId: GAME, minutes: M(50) }),
      session({ id: 'g3', date: '2026-10-07', activityTypeId: GAME, minutes: M(50) }),
    ];
    const details = new Map([
      ['g1', fd('g1', { teamId: 'a', team: 'FC Testi · Sininen · 2016', goalsFor: 3, goalsAgainst: 1, playerGoals: 2 })],
      ['g2', fd('g2', { team: 'fc testi · musta · 2015', goalsFor: 0, goalsAgainst: 0 })],
      ['g3', fd('g3', { team: 'Joku muu', goalsFor: 1, goalsAgainst: 2 })],
    ]);
    const r = teamBreakdown({ sessions, details, types: typesMap(), planned: [], today: '2026-11-19' }, period, [A, B, G]);
    expect(r.show).toBe(true);
    expect(r.teams.map((t) => t.team.id)).toEqual(['a', 'b']);
    expect(r.teams[0].training).toEqual({ count: 2, minutes: 150 });
    expect(r.teams[0].games).toMatchObject({ games: 1, wins: 1, goalsFor: 3, goalsAgainst: 1, playerGoals: 2 });
    expect(r.teams[1].games).toMatchObject({ games: 1, draws: 1 });
    expect(r.groups.map((t) => [t.team.id, t.training.count, t.games.games])).toEqual([['g', 1, 0]]);
    expect(r.unassigned.training).toEqual({ count: 1, minutes: 75 });
    expect(r.unassignedDates).toEqual(['2026-10-04']);
    expect(r.unassigned.games).toMatchObject({ games: 1, losses: 1 });
  });

  it('ryhmä ei saa pelejä; arkistoitu ilman toimintaa jää pois; yksi joukkue ei näytä erittelyä', () => {
    expect(gameTeamId({ teamId: 'g', team: 'Pienryhmä' }, [A, G])).toBeUndefined();
    const sessions = [session({ id: 't1', date: '2026-10-01', activityTypeId: TRAINING, minutes: M(60), teamId: 'a' })];
    const input = { sessions, details: new Map(), types: typesMap(), planned: [], today: '2026-11-19' };
    expect(teamBreakdown(input, period, [A, { ...B, archived: true }]).show).toBe(false);
    expect(teamBreakdown(input, period, [A, G]).show).toBe(true);
  });

  it('lyhyt nimi', () => {
    expect(shortTeamName(A, [A, B, G])).toBe('Sininen 2016');
    expect(shortTeamName(G, [A, B, G])).toBe('Pienryhmä');
    expect(shortTeamName(A, [A, team('c', 'HJK · Musta · 2016')])).toBe('FC Testi Sininen 2016');
    expect(shortTeamName(team('d', 'FC Testi'), [A])).toBe('FC Testi');
  });
});
