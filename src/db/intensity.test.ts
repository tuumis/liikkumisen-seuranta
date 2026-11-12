// Tehon valinta kirjauksessa (esiasetukset) sekä lajin profiilin muokkaus ja "Laske uudelleen" (B5).

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type Repositories, type SessionInput } from './repositories';
import { activityTypeId } from '../domain/ids';

let n = 0;
let db: AppDB;
let repo: Repositories;
beforeEach(async () => {
  db = new AppDB(`intensity-${++n}`);
  repo = createRepositories(db);
  await repo.initialize();
});
afterEach(async () => {
  await db.delete();
});

const TRAINING = activityTypeId('football_training');
const input = (over: Partial<SessionInput & { profileId: string }> = {}) => ({
  profileId: 'p1',
  activityTypeId: TRAINING,
  date: '2026-11-10',
  durationMin: 60,
  effort: 0 as const,
  muscle: false,
  bone: true,
  ...over,
});

describe('tehon esiasetukset', () => {
  it('enimmäkseen kevyttä / reipasta / rasittavaa 60 min', async () => {
    const l = await repo.createSession(input({ intensityPreset: 'light' }));
    const m = await repo.createSession(input({ intensityPreset: 'moderate' }));
    const v = await repo.createSession(input({ intensityPreset: 'vigorous' }));
    expect(l.minutes).toEqual({ light: 45, moderate: 9, vigorous: 0 });
    expect(m.minutes).toEqual({ light: 12, moderate: 39, vigorous: 6 });
    expect(v.minutes).toEqual({ light: 6, moderate: 21, vigorous: 30 });
    expect(v).toMatchObject({ intensitySource: 'profile', intensityPreset: 'vigorous', sharesSnapshot: { light: 0.1, moderate: 0.35, vigorous: 0.5 } });
  });

  it('ponnistelukerrointa ei käytetä esiasetuksen kanssa', async () => {
    const s = await repo.createSession(input({ intensityPreset: 'moderate', effort: 1 }));
    expect(s.minutes).toEqual({ light: 12, moderate: 39, vigorous: 6 });
  });

  it('keston muutos skaalaa esiasetuksella; paluu "Arvio lajista" käyttää lajin profiilia', async () => {
    const s = await repo.createSession(input({ intensityPreset: 'vigorous' }));
    const longer = await repo.updateSession(s.id, input({ durationMin: 90, intensityPreset: 'vigorous' }));
    expect(longer.minutes).toEqual({ light: 9, moderate: 32, vigorous: 45 });
    const back = await repo.updateSession(s.id, input());
    expect(back.intensityPreset).toBeUndefined();
    expect(back.minutes).toEqual({ light: 21, moderate: 18, vigorous: 9 }); // 0,35/0,30/0,15
  });

  it('käsin syöttö voittaa esiasetuksen', async () => {
    const s = await repo.createSession(input({ intensityPreset: 'light', manual: { light: 10, moderate: 20, vigorous: 30 } }));
    expect(s).toMatchObject({ intensitySource: 'manual', minutes: { light: 10, moderate: 20, vigorous: 30 } });
    expect('intensityPreset' in s).toBe(false);
  });
});

describe('lajin profiilin muokkaus ja Laske uudelleen (B5)', () => {
  it('profiilin muutos ei muuta olemassa olevia kertoja', async () => {
    const s = await repo.createSession(input());
    await repo.updateActivityType(TRAINING, { shares: { light: 0.2, moderate: 0.5, vigorous: 0.2 } });
    expect((await db.sessions.get(s.id))!.minutes).toEqual(s.minutes);
    expect((await repo.getActivityType(TRAINING)).shares).toEqual({ light: 0.2, moderate: 0.5, vigorous: 0.2 });
  });

  it('"Laske uudelleen alkaen X" muuttaa vain profiililla lasketut kerrat, joiden päivä ≥ X', async () => {
    const before = await repo.createSession(input({ date: '2026-11-01' }));
    const after = await repo.createSession(input({ date: '2026-11-10' }));
    const manual = await repo.createSession(input({ date: '2026-11-10', manual: { light: 1, moderate: 2, vigorous: 3 } }));
    const preset = await repo.createSession(input({ date: '2026-11-10', intensityPreset: 'light' }));
    const other = await repo.createSession(input({ date: '2026-11-10', activityTypeId: activityTypeId('trampoline') }));
    await repo.updateActivityType(TRAINING, { shares: { light: 0.2, moderate: 0.5, vigorous: 0.2 } });

    expect((await repo.recalculableSessions(TRAINING, '2026-11-05')).map((s) => s.id)).toEqual([after.id]);
    expect(await repo.recalculateSessions(TRAINING, '2026-11-05')).toBe(1);

    expect((await db.sessions.get(after.id))!).toMatchObject({
      minutes: { light: 12, moderate: 30, vigorous: 12 },
      sharesSnapshot: { light: 0.2, moderate: 0.5, vigorous: 0.2 },
    });
    expect((await db.sessions.get(before.id))!.minutes).toEqual(before.minutes);
    expect((await db.sessions.get(manual.id))!.minutes).toEqual(manual.minutes);
    expect((await db.sessions.get(preset.id))!.minutes).toEqual(preset.minutes);
    expect((await db.sessions.get(other.id))!.minutes).toEqual(other.minutes);
  });

  it('uudelleenlaskenta säilyttää kerran ponnistelun ja pelatut minuutit', async () => {
    const game = activityTypeId('football_game');
    const s = await repo.createSession(input({ activityTypeId: game, durationMin: 90, playedMin: 40, effort: 1 }));
    await repo.updateActivityType(game, { shares: { light: 0.2, moderate: 0.4, vigorous: 0.4 } });
    await repo.recalculateSessions(game, '2026-01-01');
    // pelattu 40, kovempi: m' = 0,5, v' = 0,5 → summa 1 → kevyt 0; lämmittely 15 min treenin teholla 5 / 5 / 2
    expect((await db.sessions.get(s.id))!.minutes).toEqual({ light: 5, moderate: 25, vigorous: 22 });
  });

  it('lähtöoletusten palautus', async () => {
    await repo.updateActivityType(TRAINING, { shares: { light: 0.1, moderate: 0.1, vigorous: 0.1 }, muscleDefault: 'yes' });
    const t = await repo.restoreActivityTypeDefaults(TRAINING);
    expect(t).toMatchObject({ shares: { light: 0.35, moderate: 0.3, vigorous: 0.15 }, muscleDefault: 'ask', boneDefault: 'yes' });
  });
});
