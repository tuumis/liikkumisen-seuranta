// Joukkuekirjasto (skeema v3): seurat, logot, nimien korjaus ja pelikommentit.

import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type Repositories } from './repositories';
import { buildSyncFile, mergeSyncFile, toJson } from './backup';

let n = 0;
const dbs: AppDB[] = [];
async function device(name: string): Promise<{ db: AppDB; repo: Repositories; id: string }> {
  const db = new AppDB(`clubs-${name}-${++n}`);
  dbs.push(db);
  const repo = createRepositories(db);
  await repo.initialize();
  return { db, repo, id: await repo.deviceId() };
}
afterEach(async () => {
  while (dbs.length) await dbs.pop()!.delete();
});

const LOGO = 'data:image/png;base64,iVBORw0KGgo=';

async function playedGame(repo: Repositories, opponent: string, date = '2026-11-10') {
  const s = await repo.createSession({ profileId: 'p1', activityTypeId: 't:football_game', date, durationMin: 60, effort: 0, muscle: false, bone: true });
  await repo.saveFootballDetails(s.id, { attendance: 'full', focusTags: [], opponent, goalsFor: 2, goalsAgainst: 1, ratingNote: 'Hyvä peli' });
  return s;
}

describe('seurat', () => {
  it('logo tallentuu seuralle; sama seura eri kirjoitusasulla on yksi tietue', async () => {
    const { repo } = await device('logo');
    await repo.saveClubLogo('FC Honka', LOGO);
    await repo.saveClubLogo('fc  honka', LOGO);
    const clubs = await repo.listClubs();
    expect(clubs).toHaveLength(1);
    expect(clubs[0]).toMatchObject({ id: 'club:fc honka', logo: LOGO });
    await repo.saveClubLogo('FC Honka', undefined);
    expect((await repo.listClubs())[0].logo).toBeUndefined();
  });

  it('ryhmän korjaus muuttaa kaikki saman ryhmän nimet (pelit, turnaukset, kalenteri)', async () => {
    const { repo, db } = await device('squad');
    const a = await playedGame(repo, 'FC Honka Musta');
    const t = await repo.createSession({ profileId: 'p1', activityTypeId: 't:football_tournament', date: '2026-11-08', durationMin: 200, effort: 0, muscle: false, bone: true });
    await repo.saveFootballDetails(t.id, { attendance: 'full', focusTags: [], eventName: 'Cup', gamesCount: 2, games: [{ opponent: 'fc honka musta', goalsFor: 0, goalsAgainst: 0 }, { opponent: 'HJK', goalsFor: 1, goalsAgainst: 0 }] });
    const fx = await repo.createFixture('p1', { kind: 'game', date: '2026-11-20', durationMin: 60, opponent: 'FC Honka Musta' });

    const changed = await repo.editSquad({ club: 'FC Honka Musta' }, { club: 'FC Honka', group: 'Musta', age: '2018' });
    expect(changed).toBe(3);
    expect((await db.footballDetails.get(a.id))!.opponent).toBe('FC Honka · Musta · 2018');
    expect((await db.footballDetails.get(t.id))!.games!.map((g) => g.opponent)).toEqual(['FC Honka · Musta · 2018', 'HJK']);
    expect((await db.fixtures.get(fx.plan.id))!.opponent).toBe('FC Honka · Musta · 2018');
    expect(await repo.editSquad({ club: 'FC Honka Musta' }, { club: 'FC Honka', group: 'Musta', age: '2018' })).toBe(0);
  });

  it('seuran nimen muutos säilyttää ryhmät ja siirtää logon; myös omat joukkueet', async () => {
    const { repo, db } = await device('rename');
    const a = await playedGame(repo, 'Honka / Valkoinen');
    const team = await repo.saveTeam('p1', { name: 'Honka · Musta · 2016' });
    await repo.saveClubLogo('Honka', LOGO);
    await repo.renameClub('honka', 'FC Honka');
    expect((await db.footballDetails.get(a.id))!.opponent).toBe('FC Honka · Valkoinen');
    expect((await db.teams.get(team.id))!.name).toBe('FC Honka · Musta · 2016');
    const clubs = await repo.listClubs();
    expect(clubs.map((c) => [c.name, c.logo])).toEqual([['FC Honka', LOGO]]);
  });

  it('kommentin muokkaus: yksittäinen peli ja turnauksen pelirivi', async () => {
    const { repo, db } = await device('note');
    const a = await playedGame(repo, 'HJK');
    await repo.setGameComment(a.id, undefined, '  Hieno torjunta ');
    expect((await db.footballDetails.get(a.id))!.ratingNote).toBe('Hieno torjunta');
    await repo.setGameComment(a.id, undefined, '');
    expect((await db.footballDetails.get(a.id))!.ratingNote).toBeUndefined();

    const t = await repo.createSession({ profileId: 'p1', activityTypeId: 't:football_tournament', date: '2026-11-08', durationMin: 200, effort: 0, muscle: false, bone: true });
    await repo.saveFootballDetails(t.id, { attendance: 'full', focusTags: [], gamesCount: 2, games: [{ opponent: 'A' }, { opponent: 'B', note: 'vanha' }] });
    await repo.setGameComment(t.id, 2, 'uusi');
    expect((await db.footballDetails.get(t.id))!.games!.map((g) => g.note)).toEqual([undefined, 'uusi']);
  });

  it('seurat synkronoituvat laitteelta toiselle', async () => {
    const pc = await device('pc');
    const phone = await device('phone');
    await pc.repo.saveClubLogo('FC Lahti', LOGO);
    await mergeSyncFile(phone.db, toJson(await buildSyncFile(pc.db, pc.id, 'pc')), phone.id);
    expect((await phone.repo.listClubs()).map((c) => [c.name, c.logo])).toEqual([['FC Lahti', LOGO]]);
  });
});
