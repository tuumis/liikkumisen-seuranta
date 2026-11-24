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
    const team = await repo.saveTeam('p1', { name: 'P2016 Sininen', format: '7v7' });
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

describe('pelin pikakirjaus (24.11.2026)', () => {
  it('kuittaa kalenterin pelin, tallentaa tuloksen ja säilyttää muut tiedot; Koko pelin = kesto − lämmittely', async () => {
    const team = await repo.saveTeam('p1', { name: 'P2016 Sininen', series: 'P10' });
    const e = await repo.createFixture('p1', { kind: 'game', date: DAY, durationMin: 75, startTime: '10:00', teamId: team.id, opponent: 'HJK', homeAway: 'home', link: 'https://example.org/peli' });
    const a = await repo.recordGameResult({ planId: e.plan.id }, { goalsFor: 3, goalsAgainst: 2, playerGoals: 1, played: 'full' }, DAY);
    expect(a.created).toBe(true);
    const fd = (await repo.getFootballDetails(a.sessionId))!;
    expect(fd).toMatchObject({ opponent: 'HJK', goalsFor: 3, goalsAgainst: 2, playerGoals: 1, played: 'full', series: 'P10', homeAway: 'home', teamId: team.id });
    const s = (await db.sessions.get(a.sessionId))!;
    expect(s.playedMin).toBe(75 - (s.warmupMin ?? 15));
    expect((await db.plannedSessions.get(e.plan.id))!.status).toBe('done');

    const b = await repo.recordGameResult({ sessionId: a.sessionId }, { goalsFor: 3, goalsAgainst: 3, played: 'part' }, DAY);
    expect(b.created).toBe(false);
    expect(await repo.getFootballDetails(a.sessionId)).toMatchObject({ goalsAgainst: 3, played: 'part', link: 'https://example.org/peli' });
    expect((await repo.getFootballDetails(a.sessionId))!.playerGoals).toBeUndefined();
    expect((await db.sessions.get(a.sessionId))!.playedMin).toBeUndefined();
  });
});

describe('harjoituspelin pikakirjaus (24.11.2026)', () => {
  it('pelien määrä, pituus ja lämmittely: kesto = lämmittely + pelit × pituus; pelien paikat säilyvät', async () => {
    const e = await repo.createFixture('p1', { kind: 'friendly', date: DAY, durationMin: 90, startTime: '17:00', games: [{ opponent: 'HJK' }, { opponent: 'PK-35' }] });
    const a = await repo.recordFriendlyDay({ planId: e.plan.id }, { gamesCount: 4, gameLengthMin: 20, warmupMin: 15, games: [{ opponent: 'HJK', goalsFor: 2, goalsAgainst: 1 }, {}, { opponent: 'HJK', goalsFor: 0, goalsAgainst: 0, playerGoals: 0 }] }, DAY);
    expect(a).toMatchObject({ created: true, durationMin: 95 });
    const s = (await db.sessions.get(a.sessionId))!;
    expect(s.durationMin).toBe(95);
    expect(s.minutes.light + s.minutes.moderate + s.minutes.vigorous).toBeGreaterThan(60);
    const fd = (await repo.getFootballDetails(a.sessionId))!;
    expect(fd).toMatchObject({ gamesCount: 4, gameLengthMin: 20, warmupMin: 15 });
    expect(fd.games).toHaveLength(3);
    expect(fd.games![1]).toEqual({});
    expect(fd.games![2]).toMatchObject({ opponent: 'HJK', goalsFor: 0 });

    const b = await repo.recordFriendlyDay({ sessionId: a.sessionId }, { gamesCount: 3, gameLengthMin: 25, warmupMin: 0, games: fd.games! }, DAY);
    expect(b).toMatchObject({ created: false, durationMin: 75 });
    expect((await repo.getFootballDetails(a.sessionId))!).toMatchObject({ gamesCount: 3, gameLengthMin: 25, warmupMin: 0 });

    // Ilman pituutta kesto ei muutu.
    const e2 = await repo.createFixture('p1', { kind: 'friendly', date: DAY, durationMin: 90, startTime: '19:00', games: [{ opponent: 'KäPa' }] });
    const c = await repo.recordFriendlyDay({ planId: e2.plan.id }, { gamesCount: 2, games: [{ opponent: 'KäPa', goalsFor: 1, goalsAgainst: 1 }] }, DAY);
    expect(c.durationMin).toBe(90);
    expect((await repo.getFootballDetails(c.sessionId))!.gamesCount).toBe(2);
  });
});
