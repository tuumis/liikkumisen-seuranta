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

  it('maa ja kotipaikkakunta: vain annetut kentät muuttuvat, siirtyvät nimen muutoksessa ja synkronoituvat', async () => {
    const pc = await device('origin');
    const phone = await device('origin-phone');
    await pc.repo.saveClubLogo('FC Honka', LOGO);
    await pc.repo.saveClub('fc honka', { country: 'FI', city: '  Espoo ' });
    expect((await pc.repo.listClubs())[0]).toMatchObject({ logo: LOGO, country: 'FI', city: 'Espoo' });
    await pc.repo.saveClub('FC Honka', { city: '' });
    const c = (await pc.repo.listClubs())[0];
    expect([c.logo, c.country, c.city]).toEqual([LOGO, 'FI', undefined]);
    await pc.repo.saveClub('FC Honka', { city: 'Espoo', shareColor: 'navy' });
    await pc.repo.renameClub('FC Honka', 'Honka');
    expect((await pc.repo.listClubs()).map((x) => [x.name, x.country, x.city, x.shareColor])).toEqual([['Honka', 'FI', 'Espoo', 'navy']]);
    await mergeSyncFile(phone.db, toJson(await buildSyncFile(pc.db, pc.id, 'pc')), phone.id);
    expect((await phone.repo.listClubs()).map((x) => [x.name, x.country, x.city])).toEqual([['Honka', 'FI', 'Espoo']]);
  });
});

describe('vastustajat käsin ja tallennetut ryhmät (17.11.2026)', () => {
  it('vastustajan lisäys merkitsee seuran ja tallentaa ryhmän; ryhmät yhdistyvät ja poistuvat', async () => {
    const { repo } = await device('opp');
    const c = await repo.addOpponent('PK-35 · Vihreä · 2018');
    expect(c).toMatchObject({ name: 'PK-35', opponent: true, squads: [{ group: 'Vihreä', age: '2018' }] });
    await repo.saveClubSquad('pk-35', { group: ' vihreä ', age: '2018' }); // sama ryhmä toisella kirjoitusasulla
    await repo.saveClubSquad('PK-35', { group: 'Musta' });
    expect((await repo.listClubs())[0].squads).toEqual([{ group: 'Vihreä', age: '2018' }, { group: 'Musta' }]);
    await expect(repo.saveClubSquad('PK-35', { group: ' ' })).rejects.toThrow();
    await repo.removeClubSquad('PK-35', { group: 'vihreä', age: '2018' });
    expect((await repo.listClubs())[0].squads).toEqual([{ group: 'Musta' }]);
    // Logo ei kadota merkintää eikä ryhmiä.
    await repo.saveClubLogo('PK-35', LOGO);
    expect((await repo.listClubs())[0]).toMatchObject({ opponent: true, squads: [{ group: 'Musta' }], logo: LOGO });
    await repo.removeOpponentMark('PK-35');
    const after = (await repo.listClubs())[0];
    expect(after.opponent).toBeUndefined();
    expect(after.logo).toBe(LOGO);
  });

  it('nimen muutos ja ryhmän korjaus siirtävät tallennetut ryhmät; tiedot synkronoituvat', async () => {
    const pc = await device('opp-pc');
    const phone = await device('opp-phone');
    await pc.repo.addOpponent('FC Honka · Musta');
    await pc.repo.renameClub('FC Honka', 'Honka');
    expect((await pc.repo.listClubs()).map((x) => [x.name, x.opponent, x.squads])).toEqual([['Honka', true, [{ group: 'Musta' }]]]);
    await pc.repo.editSquad({ club: 'Honka', group: 'Musta' }, { club: 'Honka', group: 'Musta', age: '2018' });
    expect((await pc.repo.listClubs())[0].squads).toEqual([{ group: 'Musta', age: '2018' }]);
    await mergeSyncFile(phone.db, toJson(await buildSyncFile(pc.db, pc.id, 'pc')), phone.id);
    expect((await phone.repo.listClubs()).map((x) => [x.name, x.opponent, x.squads])).toEqual([['Honka', true, [{ group: 'Musta', age: '2018' }]]]);
  });

  it('Tietoja puuttuu tallentuu peliin kuvauksineen ja poistuu ruksin poistolla', async () => {
    const { repo } = await device('missing');
    const e = await repo.createFixture('p1', { kind: 'game', date: '2026-11-20', durationMin: 60, opponent: 'HJK', infoMissing: true, missingNote: '  kellonaika ' });
    expect(e.fixture).toMatchObject({ infoMissing: true, missingNote: 'kellonaika' });
    await repo.updateFixture(e.plan.id, { kind: 'game', date: '2026-11-20', durationMin: 60, opponent: 'HJK', infoMissing: false, missingNote: 'kellonaika' });
    const [entry] = await repo.listFixtures('p1');
    expect(entry.fixture?.infoMissing).toBeUndefined();
    expect(entry.fixture?.missingNote).toBeUndefined();
  });
});

describe('kalenterin pelin vastustaja talteen (17.11.2026)', () => {
  it('uusi ryhmä tallentuu seuralle heti, jo ennen pelin pelaamista; toinen tallennus ei kirjoita turhaan', async () => {
    const { repo, db } = await device('remember');
    const e = await repo.createFixture('p1', { kind: 'game', date: '2026-11-20', durationMin: 60, opponent: 'FC Honka · Punainen · 2018' });
    const club = (await repo.listClubs()).find((c) => c.name === 'FC Honka')!;
    expect(club.opponent).toBe(true);
    expect(club.squads).toEqual([{ group: 'Punainen', age: '2018' }]);
    const stamp = club.updatedAt;
    await repo.updateFixture(e.plan.id, { kind: 'game', date: '2026-11-21', durationMin: 60, opponent: 'FC Honka · Punainen · 2018' });
    expect((await db.clubs.get(club.id))!.updatedAt).toBe(stamp);
    await repo.createFixture('p1', { kind: 'friendly', date: '2026-11-25', durationMin: 90, games: [{ opponent: 'FC Honka · Valkoinen' }, { opponent: 'PK-35' }] });
    const after = (await repo.listClubs()).filter((c) => c.opponent).map((c) => [c.name, c.squads ?? []]);
    expect(after).toEqual([
      ['FC Honka', [{ group: 'Punainen', age: '2018' }, { group: 'Valkoinen' }]],
      ['PK-35', []],
    ]);
  });
});
