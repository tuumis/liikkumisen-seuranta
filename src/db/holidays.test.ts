// Lomajaksot (SPEC 16): koululiikunnan automaattinen ohitus ja palautus.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type Repositories } from './repositories';
import { activityTypeId, plannedSessionId } from '../domain/ids';

let n = 0;
let db: AppDB;
let repo: Repositories;
beforeEach(async () => {
  db = new AppDB(`holidays-${++n}`);
  repo = createRepositories(db);
  await repo.initialize();
});
afterEach(async () => {
  await db.delete();
});

const PE = activityTypeId('school_pe');
const TRAINING = activityTypeId('football_training');
const WED = '2026-11-11';
const loma = { id: 'h1', label: 'Leiri', start: '2026-11-16', end: '2026-11-17' };

describe('lomajaksot ja suunnitelmat', () => {
  it('avoin koululiikunta lomapäivänä ohitetaan syyllä loma; treeni säilyy; poisto palauttaa', async () => {
    const pe = await repo.createTemplateItem('p1', { activityTypeId: PE, weekdays: [1, 3], durationMin: 45, validFrom: '2026-08-01' }, WED);
    const tr = await repo.createTemplateItem('p1', { activityTypeId: TRAINING, weekdays: [1], durationMin: 90, validFrom: '2026-08-01' }, WED);
    await repo.updateSettings({ holidays: [loma] });
    const mon = (await db.plannedSessions.get(plannedSessionId(pe.id, '2026-11-16')))!;
    expect(mon).toMatchObject({ status: 'skipped', skipReason: 'holiday' });
    expect((await db.plannedSessions.get(plannedSessionId(pe.id, '2026-11-18')))!.status).toBe('open');
    expect((await db.plannedSessions.get(plannedSessionId(tr.id, '2026-11-16')))!.status).toBe('open');
    // Johdettu aikaleima ja tekijä asetusriviltä: idempotentti, ei uusia muutoksia toisella ajolla.
    const settings = (await db.settings.get('settings'))!;
    expect(mon.updatedBy).toBe(settings.updatedBy);
    expect(mon.updatedAt > settings.updatedAt).toBe(true);
    expect(await repo.applyHolidaySkips()).toBe(0);

    await repo.updateSettings({ holidays: [] });
    const back = (await db.plannedSessions.get(plannedSessionId(pe.id, '2026-11-16')))!;
    expect(back.status).toBe('open');
    expect(back.skipReason).toBeUndefined();
  });

  it('myöhemmin luodut suunnitelmat lomalle ohitetaan; käsin ohitettu ei palaudu', async () => {
    await repo.updateSettings({ holidays: [{ id: 'h2', label: 'Joululoma', start: '2026-12-21', end: '2027-01-06' }] });
    const pe = await repo.createTemplateItem('p1', { activityTypeId: PE, weekdays: [2], durationMin: 45, validFrom: '2026-08-01' }, WED);
    await repo.ensurePlanned('p1', '2027-01-10', WED);
    const xmas = (await db.plannedSessions.get(plannedSessionId(pe.id, '2026-12-22')))!;
    expect(xmas).toMatchObject({ status: 'skipped', skipReason: 'holiday' });
    const sick = (await db.plannedSessions.get(plannedSessionId(pe.id, '2026-11-17')))!;
    await db.plannedSessions.put({ ...sick, status: 'skipped', skipReason: 'sick' });
    await repo.updateSettings({ holidays: [] });
    expect((await db.plannedSessions.get(sick.id))!.skipReason).toBe('sick');
    expect((await db.plannedSessions.get(xmas.id))!.status).toBe('open');
  });

  it('rajattu jakso koskee vain valittua profiilia', async () => {
    const pe = await repo.createTemplateItem('p1', { activityTypeId: PE, weekdays: [1], durationMin: 45, validFrom: '2026-08-01' }, WED);
    await repo.updateSettings({ holidays: [{ ...loma, profileIds: ['p2'] }] });
    expect((await db.plannedSessions.get(plannedSessionId(pe.id, '2026-11-16')))!.status).toBe('open');
    expect((await repo.getSettings()).holidays).toHaveLength(1);
  });
});
