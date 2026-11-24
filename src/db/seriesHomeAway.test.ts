// Sarja, koti/vieras ja tuloskuvan kommentti (18.11.2026).
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type Repositories } from './repositories';
import { gameRows } from '../domain/football';
import { previewCard } from '../domain/previewCard';
import { resultCard } from '../domain/resultCard';

let n = 0;
let db: AppDB;
let repo: Repositories;
beforeEach(async () => {
  db = new AppDB(`sha-${++n}`);
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

describe('sarja ja koti/vieras', () => {
  it('joukkueen sarja: tallennus, oletus ennakkoon ja kuittaukseen, tapahtuman sarja voittaa (24.11.2026)', async () => {
    const team = await repo.saveTeam('p1', { name: 'P2017 Valkoinen', series: ' P9 ' });
    expect(team.series).toBe('P9');
    const e = await repo.createFixture('p1', { kind: 'game', date: DAY, durationMin: 90, startTime: '10:00', opponent: 'HJK', teamId: team.id });
    expect(previewCard(e.plan, e.fixture, team).series).toBe('P9');
    const { session } = await repo.confirmPlanned(e.plan.id, DAY);
    expect((await repo.getFootballDetails(session.id))?.series).toBe('P9');
    const own = await repo.createFixture('p1', { kind: 'game', date: DAY, durationMin: 90, startTime: '12:00', opponent: 'PK', teamId: team.id, series: 'P10' });
    expect(previewCard(own.plan, own.fixture, team).series).toBe('P10');
    const cleared = await repo.saveTeam('p1', { name: team.name, series: '' }, team.id);
    expect('series' in cleared).toBe(false);
  });

  it('ottelu: kalenterista ennakkoon, kuittauksessa tulokseen; lomake voi muuttaa', async () => {
    const e = await repo.createFixture('p1', { kind: 'game', date: DAY, durationMin: 90, startTime: '10:00', opponent: 'PK-35', series: '  P9 ', homeAway: 'away' });
    expect(e.fixture).toMatchObject({ series: 'P9', homeAway: 'away' });
    const pc = previewCard(e.plan, e.fixture);
    expect(pc.series).toBe('P9');
    expect(pc.games[0].homeAway).toBe('away');

    const { session } = await repo.confirmPlanned(e.plan.id, DAY);
    expect(await repo.getFootballDetails(session.id)).toMatchObject({ series: 'P9', homeAway: 'away' });
    await repo.saveFootballDetails(session.id, { attendance: 'full', focusTags: [], opponent: 'PK-35', goalsFor: 2, goalsAgainst: 1, series: 'P10', homeAway: 'home' });
    const rc = resultCard(await rowsFor(session.id))!;
    expect(rc.series).toBe('P10');
    expect(rc.games[0].homeAway).toBe('home');
  });

  it('turnaus: otteluohjelman rivikohtainen koti/vieras säilyy pikakirjauksessa', async () => {
    const e = await repo.createFixture('p1', {
      kind: 'tournament',
      date: DAY,
      durationMin: 240,
      eventName: 'Syyscup',
      series: 'P9',
      games: [{ opponent: 'HJK', time: '09:00', homeAway: 'home' }, { time: '11:00', homeAway: 'away' }, { time: '13:00' }],
    });
    expect(e.fixture?.games?.map((g) => g.homeAway)).toEqual(['home', 'away', undefined]);
    expect(previewCard(e.plan, e.fixture).games.map((g) => g.homeAway)).toEqual(['home', 'away', undefined]);
    const a = await repo.recordTournamentGame({ planId: e.plan.id }, 0, { goalsFor: 1, goalsAgainst: 0 }, DAY);
    await repo.recordTournamentGame({ sessionId: a.sessionId }, 1, { goalsFor: 2, goalsAgainst: 2 }, DAY);
    const fd = (await repo.getFootballDetails(a.sessionId))!;
    expect(fd.series).toBe('P9');
    expect(fd.games!.map((g) => g.homeAway)).toEqual(['home', 'away', undefined]);
    const rc = resultCard(await rowsFor(a.sessionId))!;
    expect(rc.series).toBe('P9');
    expect(rc.games.map((g) => g.homeAway)).toEqual(['home', 'away', undefined]);
  });

  it('koti/vieras vain ottelulle; turnauksen tasolla ei tallennu', async () => {
    const e = await repo.createFixture('p1', { kind: 'tournament', date: DAY, durationMin: 120, homeAway: 'home' });
    expect(e.fixture?.homeAway).toBeUndefined();
  });
});

describe('tuloskuvan kommentti', () => {
  it('tallentuu kerralle ja säilyy, kun lisätiedot tallennetaan lomakkeelta', async () => {
    const e = await repo.createFixture('p1', { kind: 'game', date: DAY, durationMin: 90, opponent: 'PK-35' });
    const { session } = await repo.confirmPlanned(e.plan.id, DAY);
    await repo.setResultNote(session.id, '  Hieno   peli! ');
    expect((await repo.getFootballDetails(session.id))!.shareNote).toBe('Hieno peli!');
    await repo.saveFootballDetails(session.id, { attendance: 'full', focusTags: [], opponent: 'PK-35', goalsFor: 1, goalsAgainst: 0 });
    expect((await repo.getFootballDetails(session.id))!.shareNote).toBe('Hieno peli!');
    await repo.setResultNote(session.id, '');
    expect((await repo.getFootballDetails(session.id))!.shareNote).toBeUndefined();
  });
});

describe('harjoituspelin koti/vieras', () => {
  it('koskee koko tapahtumaa: ennakon kaikilla vastustajilla, siirtyy kuittauksessa', async () => {
    const e = await repo.createFixture('p1', { kind: 'friendly', date: DAY, durationMin: 90, startTime: '16:30', games: [{ opponent: 'Ilves' }, { opponent: 'TPV' }], homeAway: 'home' });
    expect(e.fixture?.homeAway).toBe('home');
    expect(previewCard(e.plan, e.fixture).games.map((g) => g.homeAway)).toEqual(['home', 'home']);
    const { session } = await repo.confirmPlanned(e.plan.id, DAY);
    expect((await repo.getFootballDetails(session.id))!.homeAway).toBe('home');
    expect((await rowsFor(session.id)).every((r) => r.homeAway === 'home')).toBe(true);
    await repo.saveFootballDetails(session.id, { attendance: 'full', focusTags: [], games: [{ opponent: 'Ilves' }], homeAway: 'away' });
    expect((await repo.getFootballDetails(session.id))!.homeAway).toBe('away');
  });
});
