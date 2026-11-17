import { describe, expect, it } from 'vitest';
import type { GameRow } from './football';
import { buildOpponentLibrary, opponentHistory } from './opponentLibrary';

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

describe('käsin lisätyt vastustajat ja tallennetut ryhmät (17.11.2026)', () => {
  it('vastustajaksi merkitty seura näkyy ilman pelejä; tallennetut ryhmät lisätään seuran alle', () => {
    const lib = buildOpponentLibrary(
      [row('2026-10-01', 'FC Honka · Musta', 2, 1)],
      [],
      [
        { name: 'PK-35', opponent: true, squads: [{ group: 'Vihreä', age: '2018' }] },
        { name: 'fc honka', squads: [{ group: 'musta' }, { group: 'Valkoinen' }] },
        { name: 'Oma Seura', squads: [{ group: 'Sininen' }] }, // ei pelejä eikä vastustajamerkintää → ei listaan
      ],
    );
    expect(lib.map((c) => [c.name, !!c.manual])).toEqual([
      ['FC Honka', false],
      ['PK-35', true],
    ]);
    expect(lib[0].squads.map((s) => [s.parts.group, s.rows.length, !!s.saved])).toEqual([
      ['Musta', 1, true],
      ['Valkoinen', 0, true],
    ]);
    expect(lib[1].squads.map((s) => [s.parts.club, s.parts.group, s.parts.age])).toEqual([['PK-35', 'Vihreä', '2018']]);
    expect(lib[1].summary.games).toBe(0);
  });
});

describe('vastustajan historia', () => {
  const rows = [
    row('2026-09-10', 'FC Honka / Musta', 3, 1),
    row('2026-10-01', 'fc honka · Musta · 2016', 0, 2),
    row('2026-10-20', 'FC Honka · Musta · 2017', 1, 1),
    row('2026-10-25', 'FC Honka · Valkoinen', 2, 0),
    row('2026-10-30', 'HJK · Musta', 5, 0),
  ];
  it('saman ryhmän pelit uusin ensin; puuttuva ikäluokka sopii, eri ikäluokka ei', () => {
    const h = opponentHistory(rows, 'FC Honka · Musta · 2016')!;
    expect(h.club).toBe('FC Honka');
    expect(h.squad.map((r) => r.date)).toEqual(['2026-10-01', '2026-09-10']);
    expect(h.others.map((r) => r.date)).toEqual(['2026-10-25', '2026-10-20']);
    expect(h.squadSummary).toMatchObject({ games: 2, wins: 1, losses: 1 });
  });
  it('pelkkä seura: ryhmättömät samaan, muut ryhmät erikseen; ilman nimeä ei historiaa', () => {
    const h = opponentHistory(rows, 'FC Honka')!;
    expect(h.squad).toEqual([]);
    expect(h.others).toHaveLength(4);
    expect(opponentHistory(rows, '  ')).toBeUndefined();
    expect(opponentHistory(rows, 'PK-35')!.squad).toEqual([]);
  });
});
