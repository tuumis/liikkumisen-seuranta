import { describe, expect, it } from 'vitest';
import type { GameRow } from './football';
import { buildOpponentLibrary } from './opponentLibrary';

const row = (date: string, opponent: string, gf?: number, ga?: number, extra: Partial<GameRow> = {}): GameRow => ({
  sessionId: `s-${date}-${opponent}`,
  date,
  kind: 'game',
  opponent,
  goalsFor: gf,
  goalsAgainst: ga,
  outcome: gf === undefined || ga === undefined ? undefined : gf > ga ? 'W' : gf === ga ? 'D' : 'L',
  games: 1,
  ...extra,
});

describe('joukkuekirjasto', () => {
  it('ryhmittelee seuran ja ryhmän mukaan; vanhat ja uudet kirjoitusasut yhdistyvät', () => {
    const lib = buildOpponentLibrary(
      [row('2026-10-01', 'FC Honka / Musta', 2, 1), row('2026-10-08', 'fc honka · Musta', 0, 3), row('2026-10-15', 'FC Honka · Valkoinen · 2018', 1, 1), row('2026-10-20', 'HJK', 4, 0)],
      [{ date: '2026-11-20', opponent: 'FC Honka · Musta', eventName: 'Cup' }],
    );
    expect(lib.map((c) => c.name)).toEqual(['FC Honka', 'HJK']);
    const honka = lib[0];
    expect(honka.squads.map((s) => [s.parts.group, s.parts.age, s.rows.length, s.upcoming.length])).toEqual([
      ['Musta', undefined, 2, 1],
      ['Valkoinen', '2018', 1, 0],
    ]);
    expect(honka.summary).toMatchObject({ games: 3, wins: 1, draws: 1, losses: 1, goalsFor: 3, goalsAgainst: 5 });
    expect(honka.squads[0].rows.map((r) => r.date)).toEqual(['2026-10-08', '2026-10-01']);
    expect(honka.upcoming).toBe(1);
    expect(honka.lastDate).toBe('2026-10-15');
  });
});
