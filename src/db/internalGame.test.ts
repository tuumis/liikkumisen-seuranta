// Seuran sisäinen turnauspeli (25.11.2026): aika lasketaan, mutta peli ei kuulu tuloksiin eikä oletuksena kuviin.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type Repositories } from './repositories';
import { gameRows, gamesCsv, playSummary, summarizeGames } from '../domain/football';
import { isOwnClub } from '../domain/opponent';
import { previewCard } from '../domain/previewCard';
import { playedCount, resultCard, withoutInternal } from '../domain/resultCard';
import { footballBrief } from '../domain/weekReport';

let n = 0;
let db: AppDB;
let repo: Repositories;
beforeEach(async () => {
  db = new AppDB(`int-${++n}`);
  repo = createRepositories(db);
  await repo.initialize();
});
afterEach(async () => {
  await db.delete();
});

const DAY = '2026-11-14';

async function rowsFor(sessionId: string) {
  const session = (await db.sessions.get(sessionId))!;
  const types = await repo.listActivityTypes({ includeArchived: true });
  return gameRows([session], await repo.footballDetailsFor([sessionId]), new Map(types.map((t) => [t.id, t])));
}

describe('seuran sisäinen peli', () => {
  it('ehdotus seuran perusteella', () => {
    expect(isOwnClub('FC Testi · Sininen · 2018', ['FC Testi · Valkoinen · 2018'])).toBe(true);
    expect(isOwnClub('fc  testi 2018', ['FC Testi · Valkoinen'])).toBe(true);
    expect(isOwnClub('HJK · 2018', ['FC Testi · Valkoinen · 2018'])).toBe(false);
    expect(isOwnClub('', ['FC Testi'])).toBe(false);
    expect(isOwnClub('FC Testi', [])).toBe(false);
  });

  it('otteluohjelmasta kuittaukseen; tuloksissa, maaleissa ja kuvissa vain valittaessa', async () => {
    const e = await repo.createFixture('p1', {
      kind: 'tournament',
      date: DAY,
      durationMin: 240,
      eventName: 'Syyscup',
      games: [
        { opponent: 'HJK', time: '09:00' },
        { opponent: 'FC Testi · Sininen', time: '10:00', internal: true },
        { opponent: 'PK-35', time: '11:00', internal: false },
      ],
    });
    expect(e.fixture?.games?.map((g) => g.internal)).toEqual([undefined, true, false]);
    const pc = previewCard(e.plan, e.fixture);
    expect(pc.games.map((g) => g.internal)).toEqual([undefined, true, undefined]);
    expect(withoutInternal(pc).games.map((g) => g.opponent)).toEqual(['HJK', 'PK-35']);

    const a = await repo.recordTournamentGame({ planId: e.plan.id }, 0, { goalsFor: 2, goalsAgainst: 0, playerGoals: 1 }, DAY);
    await repo.recordTournamentGame({ sessionId: a.sessionId }, 1, { goalsFor: 1, goalsAgainst: 3, playerGoals: 2, played: 'full' }, DAY);
    await repo.recordTournamentGame({ sessionId: a.sessionId }, 2, { goalsFor: 1, goalsAgainst: 1 }, DAY);
    const fd = (await repo.getFootballDetails(a.sessionId))!;
    expect(fd.games!.map((g) => g.internal)).toEqual([undefined, true, false]);
    // Kerran maalit ilman sisäistä peliä; pelirivillä maalit säilyvät.
    expect(fd.playerGoals).toBe(1);
    expect(fd.games![1].playerGoals).toBe(2);

    const rows = await rowsFor(a.sessionId);
    expect(rows[1]).toMatchObject({ internal: true, goalsFor: 1, goalsAgainst: 3, outcome: undefined, playedMin: fd.gameLengthMin });
    const s = summarizeGames(rows);
    expect(s).toMatchObject({ games: 2, wins: 1, draws: 1, losses: 0, goalsFor: 3, goalsAgainst: 1, playerGoals: 1 });
    // Peliaika ja pelatut pelit sisältävät sisäisen pelin.
    expect(playSummary(rows).games).toBe(3);
    expect(playSummary(rows).played.full).toBe(1);
    expect(gamesCsv(rows)).toContain(';sisäinen;');
    expect(footballBrief((await db.sessions.get(a.sessionId))!, (await repo.listActivityTypes()).find((t) => t.footballKind === 'tournament'), fd)).toContain('1–1–0');

    const rc = resultCard(rows)!;
    expect(rc).toMatchObject({ wins: 1, draws: 1, losses: 0, noResult: 0, goalsFor: 3, goalsAgainst: 1, playerGoals: 1 });
    expect(playedCount(rc)).toBe(2);
    expect(rc.games[1]).toMatchObject({ internal: true, goalsFor: 1, goalsAgainst: 3 });
    expect(rc.games[1].outcome).toBeUndefined();
    const off = withoutInternal(rc);
    expect(off.games.map((g) => g.opponent)).toEqual(['HJK', 'PK-35']);
    expect(off.wins + off.draws + off.losses).toBe(2);
  });

  it('tulosrivien lomake voi poistaa merkinnän: peli palaa tuloksiin', async () => {
    const e = await repo.createFixture('p1', { kind: 'tournament', date: DAY, durationMin: 240, games: [{ opponent: 'FC Testi', internal: true }] });
    const { session } = await repo.confirmPlanned(e.plan.id, DAY);
    await repo.saveFootballDetails(session.id, { attendance: 'full', focusTags: [], games: [{ opponent: 'FC Testi', goalsFor: 2, goalsAgainst: 1, internal: false }] });
    const rows = await rowsFor(session.id);
    expect(rows[0].internal).toBeUndefined();
    expect(summarizeGames(rows).wins).toBe(1);
  });
});
