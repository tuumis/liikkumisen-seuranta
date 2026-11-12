// Skeema v2: joukkueet, pelikalenteri (tulevat pelit ja turnaukset) ja taso → ponnistelu.

import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type Repositories } from './repositories';
import { buildSyncFile, mergeSyncFile, purgeProfile, toJson } from './backup';
import { gameRows, summarizeBy, summarizeByPosition, summarizeGames, LEVEL_LABEL } from '../domain/football';
import { BUILT_IN_ACTIVITY_TYPES } from '../seed/activityTypes';

let n = 0;
const dbs: AppDB[] = [];
async function device(name: string): Promise<{ db: AppDB; repo: Repositories; id: string }> {
  const db = new AppDB(`games-${name}-${++n}`);
  dbs.push(db);
  const repo = createRepositories(db);
  await repo.initialize();
  return { db, repo, id: await repo.deviceId() };
}
afterEach(async () => {
  while (dbs.length) await dbs.pop()!.delete();
});

const TODAY = '2026-11-12';

describe('joukkueet', () => {
  it('luonti, nimen siistiminen, muokkaus ja arkistointi', async () => {
    const { repo } = await device('teams');
    const a = await repo.saveTeam('p1', { name: '  P2018   Valkoinen ', level: 'kilpa' });
    expect(a).toMatchObject({ name: 'P2018 Valkoinen', level: 'kilpa', archived: false });
    await repo.saveTeam('p1', { name: 'P2018 Vihreä', level: 'elite' });
    await repo.saveTeam('p1', { name: 'P2018 Valkoinen', level: 'haaste' }, a.id);
    expect((await repo.listTeams('p1')).map((t) => `${t.name}:${t.level}`)).toEqual(['P2018 Valkoinen:haaste', 'P2018 Vihreä:elite']);
    await repo.setTeamArchived(a.id, true);
    expect(await repo.listTeams('p1')).toHaveLength(1);
    expect(await repo.listTeams('p2')).toEqual([]);
    await expect(repo.saveTeam('p1', { name: '   ', level: 'kilpa' })).rejects.toThrow();
  });
});

describe('pelikalenteri', () => {
  it('uusi peli näkyy suunnitelmana; muokkaus ja poisto', async () => {
    const { repo, db } = await device('fixture');
    const team = await repo.saveTeam('p1', { name: 'P2018 Valkoinen', level: 'kilpa' });
    const e = await repo.createFixture('p1', { kind: 'game', date: '2026-11-15', startTime: '10:00', durationMin: 60, teamId: team.id, opponent: ' HJK ', location: 'Kenttä 2' });
    expect(e.plan).toMatchObject({ activityTypeId: 't:football_game', status: 'open', date: '2026-11-15', startTime: '10:00', durationMin: 60 });
    expect(e.plan.templateItemId).toBeUndefined();
    expect(e.fixture).toMatchObject({ teamId: team.id, opponent: 'HJK', location: 'Kenttä 2' });
    expect((await repo.plansInRange('p1', '2026-11-09', '2026-11-15')).map((p) => p.id)).toEqual([e.plan.id]);

    await repo.updateFixture(e.plan.id, { kind: 'tournament', date: '2026-11-16', durationMin: 300, teamId: team.id, eventName: 'Syyscup', level: 'elite', gamesCount: 4 });
    const [entry] = await repo.listFixtures('p1');
    expect(entry.plan).toMatchObject({ activityTypeId: 't:football_tournament', date: '2026-11-16', durationMin: 300 });
    expect(entry.plan.startTime).toBeUndefined();
    expect(entry.fixture).toMatchObject({ eventName: 'Syyscup', level: 'elite', gamesCount: 4 });
    expect(entry.fixture!.opponent).toBeUndefined();

    await repo.deleteFixture(e.plan.id);
    expect(await repo.listFixtures('p1')).toEqual([]);
    expect((await db.fixtures.get(e.plan.id))!.deletedAt).toBeDefined();
  });

  it('kuittaus esitäyttää lisätiedot; taso ponnisteluna (Elite = kovempi)', async () => {
    const { repo } = await device('confirm');
    const team = await repo.saveTeam('p1', { name: 'P2018 Valkoinen', level: 'kilpa' });
    const e = await repo.createFixture('p1', { kind: 'game', date: '2026-11-10', durationMin: 90, teamId: team.id, opponent: 'HJK', level: 'elite' });
    const r = await repo.confirmPlanned(e.plan.id, TODAY);
    expect(r.session.effort).toBe(1);
    expect(await repo.getFootballDetails(r.session.id)).toMatchObject({ teamId: team.id, team: 'P2018 Valkoinen', opponent: 'HJK', level: 'elite', attendance: 'full' });

    // Pelatut 40 min tulosta kirjattaessa: Elite (kovempi) → m′ 0,5625, v′ 0,375 → 23 + 15 = 38 min.
    await repo.saveFootballDetails(r.session.id, { attendance: 'full', focusTags: [], teamId: team.id, level: 'elite', playedMin: 40, goalsFor: 2, goalsAgainst: 1 });
    const s = (await repo.sessionsInRange('p1', '2026-11-10', '2026-11-10'))[0];
    expect(s.minutes.moderate + s.minutes.vigorous).toBe(38);

    // Taso Haasteeksi → kevyempi: 40 · (0,3375 + 0,225) ≈ 23 min.
    await repo.saveFootballDetails(r.session.id, { attendance: 'full', focusTags: [], teamId: team.id, level: 'haaste', playedMin: 40 });
    const h = (await repo.sessionsInRange('p1', '2026-11-10', '2026-11-10'))[0];
    expect(h.effort).toBe(-1);
    expect(h.minutes.moderate + h.minutes.vigorous).toBe(23);
  });

  it('ilman tapahtumakohtaista tasoa käytetään joukkueen tasoa', async () => {
    const { repo } = await device('team-level');
    const team = await repo.saveTeam('p1', { name: 'P2018', level: 'haaste' });
    const e = await repo.createFixture('p1', { kind: 'tournament', date: '2026-11-08', durationMin: 240, teamId: team.id, eventName: 'Cup' });
    const r = await repo.confirmPlanned(e.plan.id, TODAY);
    expect(r.session.effort).toBe(-1);
    expect(await repo.getFootballDetails(r.session.id)).toMatchObject({ level: 'haaste', eventName: 'Cup' });
  });

  it('turnauksen kesto otteluohjelmasta: pelin pituus, lämmittely ja verryttely tallentuvat; käsin annettu merkitään', async () => {
    const { repo, db } = await device('timing');
    const e = await repo.createFixture('p1', {
      kind: 'tournament',
      date: '2026-11-21',
      startTime: '13:45',
      durationMin: 115,
      eventName: 'Winterliiga',
      games: [{ time: '14:00' }, { time: '15:00' }, { time: '15:30' }],
      gameLengthMin: 20,
      warmupMin: 15,
      cooldownMin: 10,
    });
    expect(await db.fixtures.get(e.plan.id)).toMatchObject({ gameLengthMin: 20, warmupMin: 15, cooldownMin: 10, gamesCount: 3 });
    expect((await db.fixtures.get(e.plan.id))!.durationManual).toBeUndefined();
    await repo.updateFixture(e.plan.id, { kind: 'tournament', date: '2026-11-21', durationMin: 300, eventName: 'Winterliiga', durationManual: true });
    expect(await db.fixtures.get(e.plan.id)).toMatchObject({ durationManual: true });
    expect((await db.plannedSessions.get(e.plan.id))!.durationMin).toBe(300);
  });

  it('turnauksen otteluohjelma: kuittaus luo pelirivit, tulokset ja pelikohtaiset kommentit säilyvät', async () => {
    const { repo, db } = await device('schedule');
    const e = await repo.createFixture('p1', {
      kind: 'tournament',
      date: '2026-11-08',
      durationMin: 300,
      eventName: 'Cup',
      gamesCount: 9,
      games: [
        { time: '09:00', opponent: ' HJK ', location: 'K1' },
        { time: '', opponent: '', location: '' }, // tyhjä rivi ohitetaan
        { time: '11:30', opponent: 'PK-35' },
      ],
    });
    expect(e.fixture?.games).toEqual([{ time: '09:00', opponent: 'HJK', location: 'K1' }, { time: '11:30', opponent: 'PK-35' }]);
    expect(e.fixture?.gamesCount).toBe(2);

    const r = await repo.confirmPlanned(e.plan.id, TODAY);
    const d = await repo.getFootballDetails(r.session.id);
    expect(d?.games).toEqual([{ time: '09:00', opponent: 'HJK', location: 'K1' }, { time: '11:30', opponent: 'PK-35' }]);
    expect(d?.gamesCount).toBe(2);

    await repo.saveFootballDetails(r.session.id, {
      attendance: 'full',
      focusTags: [],
      eventName: 'Cup',
      games: [
        { ...d!.games![0], goalsFor: 2, goalsAgainst: 1, note: '  Hyvä alku ' },
        { ...d!.games![1], goalsFor: 0, goalsAgainst: 0 },
      ],
    });
    const saved = await repo.getFootballDetails(r.session.id);
    expect(saved?.games?.[0]).toEqual({ time: '09:00', opponent: 'HJK', location: 'K1', goalsFor: 2, goalsAgainst: 1, note: 'Hyvä alku' });
    const sessions = await db.sessions.toArray();
    const rows = gameRows(sessions, await repo.footballDetailsFor(sessions.map((s) => s.id)), new Map(BUILT_IN_ACTIVITY_TYPES.map((t) => [t.id, t])));
    expect(rows.map((x) => [x.opponent, x.outcome, x.time, x.note])).toEqual([
      ['HJK', 'W', '09:00', 'Hyvä alku'],
      ['PK-35', 'D', '11:30', undefined],
    ]);
  });

  it('omat maalit, pelipaikka ja pelimuoto (joukkueen oletus, tapahtuma voi ohittaa)', async () => {
    const { repo, db } = await device('format');
    const team = await repo.saveTeam('p1', { name: 'P2018', level: 'kilpa', format: '8v8' });
    const g = await repo.createFixture('p1', { kind: 'game', date: '2026-11-10', durationMin: 60, teamId: team.id, opponent: 'HJK' });
    const t = await repo.createFixture('p1', { kind: 'tournament', date: '2026-11-11', durationMin: 240, teamId: team.id, format: '5v5', games: [{ opponent: 'A' }, { opponent: 'B' }] });
    const rg = await repo.confirmPlanned(g.plan.id, TODAY);
    const rt = await repo.confirmPlanned(t.plan.id, TODAY);
    expect((await repo.getFootballDetails(rg.session.id))?.format).toBe('8v8');
    expect((await repo.getFootballDetails(rt.session.id))?.format).toBe('5v5');

    await repo.saveFootballDetails(rg.session.id, { attendance: 'full', focusTags: [], teamId: team.id, goalsFor: 3, goalsAgainst: 1, playerGoals: 2, format: '8v8', positions: ['fwd', 'mid', 'fwd'] });
    const dt = await repo.getFootballDetails(rt.session.id);
    await repo.saveFootballDetails(rt.session.id, {
      attendance: 'full',
      focusTags: [],
      format: '5v5',
      positions: ['def'],
      games: [
        { ...dt!.games![0], goalsFor: 1, goalsAgainst: 0, playerGoals: 1 },
        { ...dt!.games![1], goalsFor: 0, goalsAgainst: 0 },
      ],
    });
    expect(await repo.getFootballDetails(rg.session.id)).toMatchObject({ playerGoals: 2, positions: ['mid', 'fwd'] });
    expect((await repo.getFootballDetails(rt.session.id))?.playerGoals).toBe(1);

    const sessions = await db.sessions.toArray();
    const rows = gameRows(sessions, await repo.footballDetailsFor(sessions.map((s) => s.id)), new Map(BUILT_IN_ACTIVITY_TYPES.map((x) => [x.id, x])));
    const total = summarizeGames(rows);
    expect([total.games, total.playerGoals, total.playerGoalsGames]).toEqual([3, 3, 2]);
    expect(summarizeBy(rows, (r) => r.format).map((x) => [x.label, x.summary.games])).toEqual([['5v5', 2], ['8v8', 1]]);
    expect(summarizeByPosition(rows).map((x) => [x.key, x.summary.games])).toEqual([['def', 2], ['mid', 1], ['fwd', 1]]);
  });

  it('pelattua peliä ei voi muokata eikä poistaa kalenterista', async () => {
    const { repo } = await device('done');
    const e = await repo.createFixture('p1', { kind: 'game', date: '2026-11-10', durationMin: 60 });
    await repo.confirmPlanned(e.plan.id, TODAY);
    await expect(repo.deleteFixture(e.plan.id)).rejects.toThrow();
    await expect(repo.updateFixture(e.plan.id, { kind: 'game', date: '2026-11-10', durationMin: 70 })).rejects.toThrow();
  });

  it('tasoyhteenveto pelilistasta', async () => {
    const { repo, db } = await device('summary');
    for (const [level, gf] of [['elite', 1], ['elite', 3], ['kilpa', 2]] as const) {
      const e = await repo.createFixture('p1', { kind: 'game', date: '2026-11-10', durationMin: 60, level, opponent: 'X' });
      const r = await repo.confirmPlanned(e.plan.id, TODAY);
      await repo.saveFootballDetails(r.session.id, { attendance: 'full', focusTags: [], level, goalsFor: gf, goalsAgainst: 2, opponent: 'X' });
    }
    const sessions = await db.sessions.toArray();
    const rows = gameRows(sessions, await repo.footballDetailsFor(sessions.map((s) => s.id)), new Map(BUILT_IN_ACTIVITY_TYPES.map((t) => [t.id, t])));
    const byLevel = summarizeBy(rows, (r) => (r.level ? LEVEL_LABEL[r.level] : undefined));
    expect(byLevel.map((g) => [g.label, g.summary.games, g.summary.wins, g.summary.losses, g.summary.draws])).toEqual([
      ['Elite', 2, 1, 1, 0],
      ['Kilpa', 1, 0, 0, 1],
    ]);
  });
});

describe('synkronointi ja poisto', () => {
  it('joukkueet ja kalenteri synkronoituvat; profiilin poisto tyhjentää ne', async () => {
    const pc = await device('sync-pc');
    const phone = await device('sync-phone');
    const team = await pc.repo.saveTeam('p1', { name: 'P2018', level: 'kilpa' });
    const e = await pc.repo.createFixture('p1', { kind: 'game', date: '2026-11-20', durationMin: 60, teamId: team.id, opponent: 'HJK' });
    const r = await mergeSyncFile(phone.db, toJson(await buildSyncFile(pc.db, pc.id, 'pc')), phone.id);
    expect(r.added).toBeGreaterThanOrEqual(3); // joukkue + suunnitelma + kalenteritiedot
    expect((await phone.repo.listFixtures('p1'))[0].fixture).toMatchObject({ opponent: 'HJK', teamId: team.id });

    await pc.db.profiles.put({ id: 'p1', name: 'X', kind: 'child', birthYear: 2017, birthMonth: 1, color: '#000', sortOrder: 0, archived: false, createdAt: 'x', updatedAt: 'x', updatedBy: 'd' });
    await purgeProfile(pc.db, 'p1', pc.id);
    expect(Object.keys((await pc.db.fixtures.get(e.plan.id))!).sort()).toEqual(['deletedAt', 'plannedSessionId', 'updatedAt', 'updatedBy']);
    expect(Object.keys((await pc.db.teams.get(team.id))!).sort()).toEqual(['deletedAt', 'id', 'updatedAt', 'updatedBy']);
    await mergeSyncFile(phone.db, toJson(await buildSyncFile(pc.db, pc.id, 'pc')), phone.id);
    expect(await phone.repo.listTeams('p1')).toEqual([]);
    expect(await phone.repo.listFixtures('p1')).toEqual([]);
  });
});

describe('Dexie-päivitys v1 → v2 olemassa olevalla tietokannalla', () => {
  it('vanha data säilyy ja uudet taulut syntyvät', async () => {
    const { Dexie } = await import('dexie');
    const name = `upgrade-${++n}`;
    // Sama v1-skeema kuin julkaistussa versiossa.
    const v1 = new Dexie(name);
    v1.version(1).stores({
      profiles: 'id, archived, sortOrder, updatedAt',
      activityTypes: 'id, &key, category, archived, updatedAt',
      estimates: 'id, profileId, [profileId+category], updatedAt',
      templateItems: 'id, profileId, active, updatedAt',
      plannedSessions: 'id, profileId, status, [profileId+date], &[templateItemId+date], updatedAt',
      sessions: 'id, activityTypeId, [profileId+date], &plannedSessionId, updatedAt',
      footballDetails: 'sessionId, updatedAt',
      dayFlags: 'id, &[profileId+date], updatedAt',
      settings: 'id, updatedAt',
      meta: 'key',
    });
    await v1.table('profiles').add({ id: 'p1', name: 'Vanha', kind: 'child', birthYear: 2017, birthMonth: 5, color: '#000', sortOrder: 0, archived: false, createdAt: 'x', updatedAt: 'x', updatedBy: 'd' });
    await v1.table('sessions').add({ id: 's1', profileId: 'p1', activityTypeId: 't:other', date: '2026-11-01', durationMin: 30, effort: 0, intensitySource: 'manual', minutes: { light: 30, moderate: 0, vigorous: 0 }, muscle: false, bone: false, createdAt: 'x', updatedAt: 'x', updatedBy: 'd' });
    await v1.table('meta').put({ key: 'schemaVersion', value: 1 });
    v1.close();

    const db = new AppDB(name);
    dbs.push(db);
    const repo = createRepositories(db);
    await repo.initialize();
    expect(db.verno).toBe(2);
    expect((await repo.listProfiles()).map((p) => p.name)).toEqual(['Vanha']);
    expect(await db.sessions.count()).toBe(1);
    expect(await db.teams.count()).toBe(0);
    expect(await repo.getMeta('schemaVersion')).toBe(2);
    expect(await db.activityTypes.get('t:football_self')).toBeDefined();
  });
});
