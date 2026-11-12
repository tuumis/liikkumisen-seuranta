// Vaihe 5: jalkapallon lisätietojen tallennus.

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type Repositories, type SessionInput } from './repositories';
import { activityTypeId } from '../domain/ids';

let n = 0;
let db: AppDB;
let repo: Repositories;
beforeEach(async () => {
  db = new AppDB(`football-${++n}`);
  repo = createRepositories(db);
  await repo.initialize();
});
afterEach(async () => {
  await db.delete();
});

const base = (activityTypeId: string, over: Partial<SessionInput> = {}): SessionInput & { profileId: string } => ({
  profileId: 'p1',
  activityTypeId,
  date: '2026-11-08',
  durationMin: 90,
  effort: 0,
  muscle: false,
  bone: true,
  ...over,
});

describe('jalkapallon lisätiedot', () => {
  it('treeni: arviot, tagit ja osallistuminen; tyhjät kentät eivät tallennu', async () => {
    const s = await repo.createSession(base(activityTypeId('football_training')));
    await repo.saveFootballDetails(s.id, {
      attendance: 'partial',
      focusTags: ['passing', 'passing', 'shooting'],
      parentRating: 4,
      enjoyment: 3,
      team: '  P2018   Valkoinen ',
      ratingNote: '   ',
      opponent: 'ei koske treeniä',
    });
    const d = (await repo.getFootballDetails(s.id))!;
    expect(d).toMatchObject({ attendance: 'partial', focusTags: ['passing', 'shooting'], parentRating: 4, enjoyment: 3, team: 'P2018 Valkoinen' });
    expect('ratingNote' in d).toBe(false);
    expect('opponent' in d).toBe(false);
    expect(d.updatedBy).toBe(await repo.deviceId());
  });

  it('peli: tulos ja vastustaja; pelatut minuutit päivittävät kerran laskentapohjan', async () => {
    const s = await repo.createSession(base(activityTypeId('football_game')));
    expect(s.minutes).toEqual({ light: 16, moderate: 29, vigorous: 18 }); // lämmittely 15 + pelattu 70 % × 75 = 53
    await repo.saveFootballDetails(s.id, { attendance: 'full', focusTags: [], opponent: 'HJK', goalsFor: 2, goalsAgainst: 1, playedMin: 40 });
    const after = (await db.sessions.get(s.id))!;
    expect(after.playedMin).toBe(40);
    expect(after.minutes).toEqual({ light: 13, moderate: 23, vigorous: 14 }); // A3 + lämmittely
    expect(after.durationMin).toBe(90);
    expect(await repo.getFootballDetails(s.id)).toMatchObject({ opponent: 'HJK', goalsFor: 2, goalsAgainst: 1 });
  });

  it('turnaus: pelirivit → gamesCount ja pelattujen minuuttien summa (merkitsemätön peli peliaika-arviolla)', async () => {
    const s = await repo.createSession(base(activityTypeId('football_tournament'), { durationMin: 300 }));
    await repo.saveFootballDetails(s.id, {
      attendance: 'full',
      focusTags: [],
      eventName: 'Syyscup',
      gamesCount: 9,
      games: [
        { opponent: 'PK-35', goalsFor: 1, goalsAgainst: 0, playedMin: 15 },
        { opponent: ' HJK ', goalsFor: 0, goalsAgainst: 3, playedMin: 10 },
        { opponent: 'Honka' },
      ],
    });
    const d = (await repo.getFootballDetails(s.id))!;
    expect(d.gamesCount).toBe(3);
    expect(d.games![1]).toEqual({ opponent: 'HJK', goalsFor: 0, goalsAgainst: 3, playedMin: 10 });
    expect(d.games![2]).toEqual({ opponent: 'Honka' });
    expect((await db.sessions.get(s.id))!.playedMin).toBe(15 + 10 + 14); // Honka: 70 % × 20 min
  });

  it('turnaus ilman rivejä: pelien määrä ja pelatut minuutit yhteensä', async () => {
    const s = await repo.createSession(base(activityTypeId('football_tournament'), { durationMin: 240 }));
    await repo.saveFootballDetails(s.id, { attendance: 'full', focusTags: [], gamesCount: 4, playedMin: 60 });
    expect((await repo.getFootballDetails(s.id))!.gamesCount).toBe(4);
    expect((await db.sessions.get(s.id))!.playedMin).toBe(60);
  });

  it('kerran poisto poistaa lisätiedot; kumoaminen palauttaa', async () => {
    const s = await repo.createSession(base(activityTypeId('football_training')));
    await repo.saveFootballDetails(s.id, { attendance: 'full', focusTags: ['physical'] });
    const undo = await repo.deleteSession(s.id);
    expect(await repo.getFootballDetails(s.id)).toBeUndefined();
    await repo.undoDelete(undo);
    expect((await repo.getFootballDetails(s.id))!.focusTags).toEqual(['physical']);
  });

  it('muu laji hylätään', async () => {
    const s = await repo.createSession(base(activityTypeId('trampoline')));
    await expect(repo.saveFootballDetails(s.id, { attendance: 'full', focusTags: [] })).rejects.toThrow();
  });

  it('nimiehdotukset: uusin ensin, kirjainkoko ja välilyönnit yhdistetään', async () => {
    const a = await repo.createSession(base(activityTypeId('football_game'), { date: '2026-10-01' }));
    const b = await repo.createSession(base(activityTypeId('football_game'), { date: '2026-11-01' }));
    const c = await repo.createSession(base(activityTypeId('football_tournament'), { date: '2026-11-05' }));
    await repo.saveFootballDetails(a.id, { attendance: 'full', focusTags: [], team: 'p2018 valkoinen', opponent: 'HJK' });
    await repo.saveFootballDetails(b.id, { attendance: 'full', focusTags: [], team: 'P2018  Valkoinen', opponent: 'FC Kasi' });
    await repo.saveFootballDetails(c.id, { attendance: 'full', focusTags: [], eventName: 'Syyscup', games: [{ opponent: 'hjk' }] });
    const s = await repo.footballNameSuggestions('p1');
    expect(s.teams).toEqual(['P2018 Valkoinen']);
    expect(s.opponents).toEqual(['hjk', 'FC Kasi']);
    expect(s.events).toEqual(['Syyscup']);
    expect((await repo.footballNameSuggestions('p2')).teams).toEqual([]);
  });
});
