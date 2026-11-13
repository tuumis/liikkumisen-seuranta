// Turnauspäivän pikakirjaus (SPEC 16).
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type Repositories } from './repositories';

let n = 0;
let db: AppDB;
let repo: Repositories;
beforeEach(async () => {
  db = new AppDB(`tday-${++n}`);
  repo = createRepositories(db);
  await repo.initialize();
});
afterEach(async () => {
  await db.delete();
});

const DAY = '2026-11-14';

describe('turnauspäivän pikakirjaus', () => {
  it('ensimmäinen tulos kuittaa turnauksen, myöhemmät päivittävät saman kirjauksen', async () => {
    const team = await repo.saveTeam('p1', { name: 'P2016 Sininen', level: 'kilpa', format: '7v7' });
    const e = await repo.createFixture('p1', {
      kind: 'tournament',
      date: DAY,
      durationMin: 240,
      teamId: team.id,
      eventName: 'Syyscup',
      games: [{ opponent: 'HJK · Musta', time: '09:00' }, { opponent: 'PK-35', time: '11:00' }, { time: '13:00' }],
    });
    const a = await repo.recordTournamentGame({ planId: e.plan.id }, 0, { goalsFor: 2, goalsAgainst: 1, playerGoals: 1, played: 'full' }, DAY);
    expect(a.created).toBe(true);
    expect((await db.plannedSessions.get(e.plan.id))!.status).toBe('done');
    let fd = (await repo.getFootballDetails(a.sessionId))!;
    expect(fd.eventName).toBe('Syyscup');
    expect(fd.games).toHaveLength(3);
    expect(fd.games![0]).toMatchObject({ opponent: 'HJK · Musta', time: '09:00', goalsFor: 2, goalsAgainst: 1, playerGoals: 1, played: 'full' });

    // Arvio väliin (lomake): säilyy pikakirjauksessa.
    await repo.saveFootballDetails(a.sessionId, { ...fd, parentRating: 4, ratingNote: 'Hyvä aamu' });
    const b = await repo.recordTournamentGame({ planId: e.plan.id }, 1, { goalsFor: 0, goalsAgainst: 0, played: 'part' }, DAY);
    expect(b).toEqual({ sessionId: a.sessionId, created: false });
    fd = (await repo.getFootballDetails(a.sessionId))!;
    expect(fd.games![1]).toMatchObject({ opponent: 'PK-35', goalsFor: 0, goalsAgainst: 0, played: 'part' });
    expect(fd).toMatchObject({ parentRating: 4, ratingNote: 'Hyvä aamu', teamId: team.id, playerGoals: 1 });
    expect(await db.sessions.where('plannedSessionId').equals(e.plan.id).count()).toBe(1);

    // Korjaus: maalit pois (undefined poistaa kentän), vastustaja lisätään riville ilman ohjelmaa.
    await repo.recordTournamentGame({ sessionId: a.sessionId }, 0, { playerGoals: undefined }, DAY);
    await repo.recordTournamentGame({ sessionId: a.sessionId }, 2, { opponent: 'FC Lahti', goalsFor: 3, goalsAgainst: 2 }, DAY);
    fd = (await repo.getFootballDetails(a.sessionId))!;
    expect(fd.games![0].playerGoals).toBeUndefined();
    expect(fd.games![2]).toMatchObject({ opponent: 'FC Lahti', time: '13:00', goalsFor: 3 });
  });

  it('lisäpeli kasvattaa pelien määrää', async () => {
    const e = await repo.createFixture('p1', { kind: 'tournament', date: DAY, durationMin: 120, eventName: 'Cup', gamesCount: 2 });
    const a = await repo.recordTournamentGame({ planId: e.plan.id }, 2, { goalsFor: 1, goalsAgainst: 0 }, DAY);
    const fd = (await repo.getFootballDetails(a.sessionId))!;
    expect(fd.games).toHaveLength(3);
    expect(fd.gamesCount).toBe(3);
  });
});
