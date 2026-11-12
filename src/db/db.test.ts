// Tietokannan perustestit (fake-indexeddb): skeema, siemendata, poistomerkinnät
// ja yksilölliset indeksit. Vaiheen 1 laajuus; B-kriteerit tulevat vaiheissa 2–3.

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type Repositories } from './repositories';
import { BUILT_IN_ACTIVITY_TYPES } from '../seed/activityTypes';
import { activityTypeId, sessionIdFromPlanned } from '../domain/ids';
import type { PlannedSession, Session } from '../domain/types';

let n = 0;
let db: AppDB;
let repo: Repositories;

beforeEach(() => {
  db = new AppDB(`test-${++n}`);
  repo = createRepositories(db);
});
afterEach(async () => {
  await db.delete();
});

const base = { createdAt: 'x', updatedAt: 'x', updatedBy: 'd' };

describe('käynnistys ja siemendata', () => {
  it('luo laitetunnisteen, skeemaversion ja 18 lajia', async () => {
    await repo.initialize();
    const id = await repo.deviceId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await repo.getMeta('schemaVersion')).toBe(2);
    expect(await db.activityTypes.count()).toBe(18);
    expect((await repo.listActivityTypes())[0].id).toBe('t:football_training');
  });

  it('initialize kahdesti ei tuplaa eikä vaihda laitetunnistetta', async () => {
    await repo.initialize();
    const id = await repo.deviceId();
    await repo.initialize();
    expect(await db.activityTypes.count()).toBe(18);
    expect(await repo.deviceId()).toBe(id);
  });

  it('käyttäjän muokkaamaa sisäänrakennettua lajia ei ylikirjoiteta', async () => {
    await repo.initialize();
    await db.activityTypes.update('t:trampoline', { shares: { light: 0.1, moderate: 0.1, vigorous: 0.1 } });
    await repo.initialize();
    expect((await db.activityTypes.get('t:trampoline'))!.shares.light).toBe(0.1);
  });

  it('F6: kaksi laitetta tuottaa identtiset sisäänrakennetut lajit', async () => {
    const other = new AppDB(`test-other-${n}`);
    const repo2 = createRepositories(other);
    await repo.initialize();
    await repo2.initialize();
    expect(await other.activityTypes.toArray()).toEqual(await db.activityTypes.toArray());
    expect(await repo.deviceId()).not.toBe(await repo2.deviceId());
    await other.delete();
  });

  it('&key estää kaksoisavaimen', async () => {
    await repo.initialize();
    const dup = { ...BUILT_IN_ACTIVITY_TYPES[0], id: 'other-id' };
    await expect(db.activityTypes.add(dup)).rejects.toThrow();
  });
});

describe('profiilit ja poistomerkinnät', () => {
  it('luonti, päivitys, arkistointi ja poistomerkintä', async () => {
    await repo.initialize();
    const p = await repo.createProfile({ name: 'Eetu', kind: 'child', birthYear: 2019, birthMonth: 3, color: '#2563eb', schoolStart: { year: 2026, month: 8 } });
    expect(p.updatedBy).toBe(await repo.deviceId());
    await repo.updateProfile(p.id, { name: 'Eetu P', schoolStart: undefined });
    let got = await db.profiles.get(p.id);
    expect(got!.name).toBe('Eetu P');
    expect('schoolStart' in got!).toBe(false);
    expect(got!.updatedAt >= p.updatedAt).toBe(true);

    await repo.setProfileArchived(p.id, true);
    expect(await repo.listProfiles()).toHaveLength(0);
    expect(await repo.listProfiles({ includeArchived: true })).toHaveLength(1);

    await repo.softDelete(db.profiles, p.id);
    got = await db.profiles.get(p.id);
    expect(got!.deletedAt).toBeDefined();
    expect(got!.updatedAt).toBe(got!.deletedAt);
    expect(await repo.listProfiles({ includeArchived: true })).toHaveLength(0);
  });

  it('asetukset: oletukset ja synkronoituva rivi', async () => {
    expect(await repo.getSettings()).toMatchObject({ vigorousDayMin: 10, vigorousDayRule: 'age', primaryView: 'logged_plus_estimate', backupReminderDays: 30 });
    expect((await repo.getSettings()).vigorousDayByAge['9']).toBe(20);
    await repo.updateSettings({ vigorousDayMin: 15 });
    const row = await db.settings.get('settings');
    expect(row).toMatchObject({ id: 'settings', vigorousDayMin: 15, updatedBy: await repo.deviceId() });
  });
});

describe('yksilölliset indeksit', () => {
  const plan = (over: Partial<PlannedSession>): PlannedSession => ({
    id: 'x', profileId: 'p1', activityTypeId: activityTypeId('football_training'), date: '2026-11-10',
    durationMin: 90, status: 'open', ...base, ...over,
  });
  const sess = (over: Partial<Session>): Session => ({
    id: 'y', profileId: 'p1', activityTypeId: activityTypeId('football_training'), date: '2026-11-10',
    durationMin: 90, effort: 0, intensitySource: 'manual', minutes: { light: 0, moderate: 0, vigorous: 0 },
    muscle: false, bone: false, ...base, ...over,
  });

  it('&[templateItemId+date] estää kaksoissuunnitelman; käsin lisätyt eivät ole indeksissä', async () => {
    await db.plannedSessions.add(plan({ id: 'p:t1:2026-11-10', templateItemId: 't1' }));
    await expect(db.plannedSessions.add(plan({ id: 'other', templateItemId: 't1' }))).rejects.toThrow();
    await db.plannedSessions.add(plan({ id: 'manual-1' }));
    await db.plannedSessions.add(plan({ id: 'manual-2' }));
    expect(await db.plannedSessions.count()).toBe(3);
  });

  it('&plannedSessionId estää toisen kerran samasta suunnitelmasta', async () => {
    const pid = 'p:t1:2026-11-10';
    await db.sessions.add(sess({ id: sessionIdFromPlanned(pid), plannedSessionId: pid }));
    await expect(db.sessions.add(sess({ id: 'dup', plannedSessionId: pid }))).rejects.toThrow();
    await db.sessions.add(sess({ id: 'free-1' }));
    await db.sessions.add(sess({ id: 'free-2' }));
    expect(await db.sessions.count()).toBe(3);
  });

  it('&[profileId+date] sallii yhden päivämerkinnän', async () => {
    await db.dayFlags.add({ id: 'f:p1:2026-11-10', profileId: 'p1', date: '2026-11-10', reason: 'sick', updatedAt: 'x', updatedBy: 'd' });
    await expect(
      db.dayFlags.add({ id: 'other', profileId: 'p1', date: '2026-11-10', reason: 'travel', updatedAt: 'x', updatedBy: 'd' }),
    ).rejects.toThrow();
  });
});
