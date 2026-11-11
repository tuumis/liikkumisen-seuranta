// Vaihe 2: kertojen tallennus, muokkaus, poisto ja kumoaminen sekä päivämerkinnät.

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type Repositories, type SessionInput } from './repositories';
import { activityTypeId, sessionIdFromPlanned } from '../domain/ids';
import type { FootballDetails, PlannedSession } from '../domain/types';

let n = 0;
let db: AppDB;
let repo: Repositories;

beforeEach(async () => {
  db = new AppDB(`sessions-${++n}`);
  repo = createRepositories(db);
  await repo.initialize();
});
afterEach(async () => {
  await db.delete();
});

const TRAINING = activityTypeId('football_training');
const GAME = activityTypeId('football_game');
const input = (over: Partial<SessionInput & { profileId: string }> = {}): SessionInput & { profileId: string } => ({
  profileId: 'p1',
  activityTypeId: TRAINING,
  date: '2026-11-10',
  durationMin: 75,
  effort: 0,
  muscle: false,
  bone: true,
  ...over,
});

describe('kerran tallennus', () => {
  it('laskee minuutit tehoprofiilista ja tallentaa snapshotin (A1)', async () => {
    const s = await repo.createSession(input());
    expect(s.minutes).toEqual({ light: 26, moderate: 23, vigorous: 11 });
    expect(s.intensitySource).toBe('profile');
    expect(s.sharesSnapshot).toEqual({ light: 0.35, moderate: 0.3, vigorous: 0.15 });
    expect(s.updatedBy).toBe(await repo.deviceId());
    expect(await db.sessions.get(s.id)).toEqual(s);
  });

  it('käsin syötetyt minuutit sellaisinaan, ei snapshotia (A5)', async () => {
    const s = await repo.createSession(input({ manual: { light: 5, moderate: 40, vigorous: 20 } }));
    expect(s).toMatchObject({ intensitySource: 'manual', minutes: { light: 5, moderate: 40, vigorous: 20 } });
    expect('sharesSnapshot' in s).toBe(false);
  });

  it('pelissä laskentapohja on pelatut minuutit (A3); treenissä playedMin ei tallennu', async () => {
    const g = await repo.createSession(input({ activityTypeId: GAME, durationMin: 90, playedMin: 40 }));
    expect(g.minutes).toEqual({ light: 8, moderate: 18, vigorous: 12 });
    expect(g.playedMin).toBe(40);
    const t = await repo.createSession(input({ playedMin: 40 }));
    expect('playedMin' in t).toBe(false);
  });

  it('tyhjä muistiinpano ei tallennu', async () => {
    const s = await repo.createSession(input({ note: '   ' }));
    expect('note' in s).toBe(false);
  });
});

describe('kerran muokkaus', () => {
  it('kesto 75 → 85: minuutit lasketaan kerran omasta profiilista, ei muuttuneesta lajista', async () => {
    const s = await repo.createSession(input());
    await db.activityTypes.update(TRAINING, { shares: { light: 0.1, moderate: 0.8, vigorous: 0.1 } });
    const u = await repo.updateSession(s.id, input({ durationMin: 85 }));
    // 85 · 0,35 = 29,75 → 30; 85 · 0,30 = 25,5 → 26; 85 · 0,15 = 12,75 → 13
    expect(u.minutes).toEqual({ light: 30, moderate: 26, vigorous: 13 });
    expect(u.sharesSnapshot).toEqual({ light: 0.35, moderate: 0.3, vigorous: 0.15 });
    expect(u.createdAt).toBe(s.createdAt);
    expect(u.updatedAt >= s.updatedAt).toBe(true);
  });

  it('lajin vaihto käyttää uuden lajin profiilia', async () => {
    const s = await repo.createSession(input());
    const u = await repo.updateSession(s.id, input({ activityTypeId: GAME, durationMin: 40 }));
    expect(u.minutes).toEqual({ light: 8, moderate: 18, vigorous: 12 });
  });

  it('profiili → käsin poistaa snapshotin; käsin → profiili palauttaa sen', async () => {
    const s = await repo.createSession(input());
    const m = await repo.updateSession(s.id, input({ manual: { light: 1, moderate: 2, vigorous: 3 } }));
    expect(m.intensitySource).toBe('manual');
    expect('sharesSnapshot' in m).toBe(false);
    const p = await repo.updateSession(s.id, input());
    expect(p.intensitySource).toBe('profile');
    expect(p.minutes).toEqual({ light: 26, moderate: 23, vigorous: 11 });
  });

  it('valinnaisten kenttien tyhjennys', async () => {
    const s = await repo.createSession(input({ note: 'hyvä treeni' }));
    const u = await repo.updateSession(s.id, input());
    expect('note' in u).toBe(false);
  });
});

describe('kerran poisto ja kumoaminen', () => {
  it('poisto on poistomerkintä; kerta katoaa listoilta', async () => {
    const s = await repo.createSession(input());
    await repo.deleteSession(s.id);
    const row = await db.sessions.get(s.id);
    expect(row!.deletedAt).toBeDefined();
    expect(row!.updatedAt).toBe(row!.deletedAt);
    expect(await repo.sessionsInRange('p1', '2026-11-09', '2026-11-15')).toEqual([]);
  });

  it('B4: linkitetyn kerran poisto palauttaa suunnitelman tilaan open ja poistaa FootballDetails', async () => {
    const planId = 'p:tpl1:2026-11-10';
    const sessionId = sessionIdFromPlanned(planId);
    const base = { updatedAt: 'x', updatedBy: 'd' };
    const plan: PlannedSession = {
      id: planId, profileId: 'p1', activityTypeId: TRAINING, date: '2026-11-10', durationMin: 90,
      templateItemId: 'tpl1', status: 'done', sessionId, createdAt: 'x', ...base,
    };
    const s = await repo.createSession(input());
    await db.sessions.delete(s.id);
    await db.sessions.add({ ...s, id: sessionId, plannedSessionId: planId });
    await db.plannedSessions.add(plan);
    const fd: FootballDetails = { sessionId, attendance: 'full', focusTags: ['passing'], ...base };
    await db.footballDetails.add(fd);

    const undo = await repo.deleteSession(sessionId);
    const reopened = await db.plannedSessions.get(planId);
    expect(reopened!.status).toBe('open');
    expect('sessionId' in reopened!).toBe(false);
    expect(reopened!.durationMin).toBe(90);
    expect((await db.footballDetails.get(sessionId))!.deletedAt).toBeDefined();

    await repo.undoDelete(undo);
    expect((await db.sessions.get(sessionId))!.deletedAt).toBeUndefined();
    expect(await db.plannedSessions.get(planId)).toMatchObject({ status: 'done', sessionId });
    expect((await db.footballDetails.get(sessionId))!.deletedAt).toBeUndefined();
  });

  it('kumoaminen palauttaa kerran listoille uudella muokkausajalla', async () => {
    const s = await repo.createSession(input());
    const undo = await repo.deleteSession(s.id);
    await repo.undoDelete(undo);
    const [back] = await repo.sessionsInRange('p1', '2026-11-10', '2026-11-10');
    expect(back.id).toBe(s.id);
    expect(back.minutes).toEqual(s.minutes);
    expect(back.updatedAt >= s.updatedAt).toBe(true);
  });
});

describe('haut', () => {
  it('sessionsInRange: vain profiilin kerrat jakson sisältä, päivän ja luonnin mukaan', async () => {
    await repo.createSession(input({ date: '2026-11-15' }));
    await repo.createSession(input({ date: '2026-11-09' }));
    await repo.createSession(input({ date: '2026-11-16' }));
    await repo.createSession(input({ profileId: 'p2', date: '2026-11-10' }));
    const rows = await repo.sessionsInRange('p1', '2026-11-09', '2026-11-15');
    expect(rows.map((r) => r.date)).toEqual(['2026-11-09', '2026-11-15']);
  });

  it('recentActivityTypeIds: uusin ensin, ei kaksoiskappaleita, poistetut ohitetaan', async () => {
    await repo.createSession(input({ activityTypeId: activityTypeId('trampoline') }));
    await repo.createSession(input({ activityTypeId: GAME, durationMin: 60 }));
    await repo.createSession(input());
    const del = await repo.createSession(input({ activityTypeId: activityTypeId('skiing') }));
    await repo.deleteSession(del.id);
    await repo.createSession(input());
    expect(await repo.recentActivityTypeIds('p1')).toEqual([TRAINING, GAME, activityTypeId('trampoline')]);
    expect(await repo.recentActivityTypeIds('p2')).toEqual([]);
  });
});

describe('päivämerkinnät', () => {
  it('asetus, vaihto, poisto ja uudelleen asetus samalla tunnisteella', async () => {
    await repo.setDayFlag('p1', '2026-11-12', 'sick');
    await repo.setDayFlag('p1', '2026-11-12', 'travel');
    let flags = await repo.dayFlagsInRange('p1', '2026-11-09', '2026-11-15');
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ id: 'f:p1:2026-11-12', reason: 'travel' });

    await repo.clearDayFlag('p1', '2026-11-12');
    expect(await repo.dayFlagsInRange('p1', '2026-11-09', '2026-11-15')).toEqual([]);
    expect((await db.dayFlags.get('f:p1:2026-11-12'))!.deletedAt).toBeDefined();

    await repo.setDayFlag('p1', '2026-11-12', 'sick');
    flags = await repo.dayFlagsInRange('p1', '2026-11-09', '2026-11-15');
    expect(flags).toHaveLength(1);
    expect(flags[0].deletedAt).toBeUndefined();
    expect(await db.dayFlags.count()).toBe(1);
  });
});
