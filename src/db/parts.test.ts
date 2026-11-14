// Kerran osat (14.11.2026): liikuntapuistossa monta tekemistä yhdessä kerrassa.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type Repositories } from './repositories';
import { activityTypeId } from '../domain/ids';
import { partsShares, supportsParts } from '../domain/intensity';
import { BUILT_IN_ACTIVITY_TYPES } from '../seed/activityTypes';

let n = 0;
let db: AppDB;
let repo: Repositories;
beforeEach(async () => {
  db = new AppDB(`parts-${++n}`);
  repo = createRepositories(db);
  await repo.initialize();
});
afterEach(async () => {
  await db.delete();
});

const types = new Map(BUILT_IN_ACTIVITY_TYPES.map((t) => [t.id, t]));
const T = (k: string) => activityTypeId(k);

describe('osat', () => {
  it('yhdistetty teho on osien painotettu keskiarvo; muu aika on taukoja', () => {
    const s = partsShares([{ activityTypeId: T('trampoline'), durationMin: 60 }, { activityTypeId: T('kick_scooter'), durationMin: 60 }], types, 180)!;
    // trampoliini 30/30/30, potkulauta 40/50/5 → (60·x + 60·y) / 180
    expect(s.light).toBeCloseTo((0.3 * 60 + 0.4 * 60) / 180);
    expect(s.moderate).toBeCloseTo((0.3 * 60 + 0.5 * 60) / 180);
    expect(s.vigorous).toBeCloseTo((0.3 * 60 + 0.05 * 60) / 180);
    expect(partsShares([], types, 180)).toBeUndefined();
    expect(supportsParts(types.get(T('activity_park')))).toBe(true);
    expect(supportsParts(types.get(T('trampoline')))).toBe(false);
  });

  it('tallennus: minuutit osista, kesto säilyy; muokkaus ilman osia säilyttää ne, tyhjä lista poistaa', async () => {
    const p = await repo.createProfile({ name: 'Eino', kind: 'child', birthYear: 2021, birthMonth: 3, color: '#0891b2' });
    const parts = [
      { activityTypeId: T('trampoline'), durationMin: 60 },
      { activityTypeId: T('kick_scooter'), durationMin: 45 },
      { activityTypeId: T('climbing'), durationMin: 30 },
    ];
    const s = await repo.createSession({ profileId: p.id, activityTypeId: T('activity_park'), date: '2026-11-14', durationMin: 180, effort: 0, muscle: false, bone: true, parts });
    expect(s.parts).toEqual(parts);
    expect(s.durationMin).toBe(180);
    // trampoliini 18/18/18, potkulauta 18/22.5/2.25, kiipeily 13.5/10.5/3 → ≈ 50/51/23
    expect(s.minutes.moderate + s.minutes.vigorous).toBeGreaterThan(70);
    expect(s.minutes.light + s.minutes.moderate + s.minutes.vigorous).toBeLessThanOrEqual(135);
    const base = { activityTypeId: T('activity_park'), date: '2026-11-14', durationMin: 180, effort: 0 as const, muscle: false, bone: true };
    const kept = await repo.updateSession(s.id, base);
    expect(kept.parts).toEqual(parts);
    expect(kept.minutes).toEqual(s.minutes);
    const cleared = await repo.updateSession(s.id, { ...base, parts: [] });
    expect(cleared.parts).toBeUndefined();
    expect(cleared.sharesSnapshot).toEqual(types.get(T('activity_park'))!.shares);
    // Osiin jaettua kertaa ei lasketa uudelleen lajin profiililla.
    await repo.updateSession(s.id, { ...base, parts });
    expect(await repo.recalculableSessions(T('activity_park'), '2026-11-01')).toHaveLength(0);
  });

  it('virheet: osat yli keston, osana toinen osiin jaettava laji', async () => {
    const p = await repo.createProfile({ name: 'Eino', kind: 'child', birthYear: 2021, birthMonth: 3, color: '#0891b2' });
    const base = { profileId: p.id, activityTypeId: T('activity_park'), date: '2026-11-14', durationMin: 60, effort: 0 as const, muscle: false, bone: false };
    await expect(repo.createSession({ ...base, parts: [{ activityTypeId: T('trampoline'), durationMin: 61 }] })).rejects.toThrow('ylittävät');
    await expect(repo.createSession({ ...base, parts: [{ activityTypeId: T('activity_park'), durationMin: 30 }] })).rejects.toThrow('Tarkista');
    // Laji ilman osia: osat ohitetaan.
    const s = await repo.createSession({ ...base, activityTypeId: T('trampoline'), parts: [{ activityTypeId: T('climbing'), durationMin: 30 }] });
    expect(s.parts).toBeUndefined();
  });
});
