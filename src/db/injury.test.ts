// Loukkaantumisjakso (24.11.2026): jakson päivämerkinnät, suunniteltujen kertojen automaattinen ohitus ja palautus.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type Repositories } from './repositories';
import { activityTypeId, plannedSessionId } from '../domain/ids';
import { injuryRunAt } from '../domain/injury';
import { dayFlagSchema } from '../domain/schemas';
import type { DayFlag } from '../domain/types';

let n = 0;
let db: AppDB;
let repo: Repositories;
beforeEach(async () => {
  db = new AppDB(`injury-${++n}`);
  repo = createRepositories(db);
  await repo.initialize();
});
afterEach(async () => {
  await db.delete();
});

const TRAINING = activityTypeId('football_training');
const WED = '2026-11-11';
const flag = (date: string, reason: DayFlag['reason'] = 'injured', deletedAt?: string): DayFlag =>
  ({ id: `f:p1:${date}`, profileId: 'p1', date, reason, updatedAt: '2026-11-01T00:00:00.000Z', updatedBy: 'd', ...(deletedAt ? { deletedAt } : {}) }) as DayFlag;

describe('injuryRunAt', () => {
  it('yhtenäinen jakso päivän ympäriltä; paluu = viimeistä seuraava päivä', () => {
    const flags = [flag('2026-11-10'), flag('2026-11-11'), flag('2026-11-12'), flag('2026-11-14'), flag('2026-11-09', 'sick')];
    expect(injuryRunAt(flags, '2026-11-11')).toEqual({ start: '2026-11-10', returnDate: '2026-11-13' });
    expect(injuryRunAt(flags, '2026-11-14')).toEqual({ start: '2026-11-14', returnDate: '2026-11-15' });
    expect(injuryRunAt(flags, '2026-11-13')).toBeNull();
    expect(injuryRunAt(flags, '2026-11-09')).toBeNull();
    expect(injuryRunAt([flag('2026-11-11', 'injured', '2026-11-12T00:00:00.000Z')], '2026-11-11')).toBeNull();
  });

  it('tuntematon syy toisesta versiosta luetaan muuksi poissaoloksi', () => {
    const r = dayFlagSchema.parse({ ...flag('2026-11-11'), reason: 'future_reason' });
    expect(r.reason).toBe('other');
    expect(dayFlagSchema.parse(flag('2026-11-11')).reason).toBe('injured');
  });
});

describe('loukkaantumisjakso ja suunnitelmat', () => {
  it('jakson kerrat ohitetaan; paluu aiemmin avaa myöhemmät; poisto avaa kaikki', async () => {
    const tr = await repo.createTemplateItem('p1', { activityTypeId: TRAINING, weekdays: [1, 3], durationMin: 90, validFrom: '2026-08-01' }, WED);
    await repo.ensurePlanned('p1', '2026-12-06', WED);
    const plan = (d: string) => db.plannedSessions.get(plannedSessionId(tr.id, d)).then((p) => p!);
    const run = { start: '2026-11-16', returnDate: '2026-11-30' };
    await repo.setInjury('p1', run, null);

    expect(await repo.injuryAt('p1', '2026-11-20')).toEqual(run);
    expect(await repo.injuryAt('p1', '2026-11-30')).toBeNull();
    for (const d of ['2026-11-16', '2026-11-18', '2026-11-23', '2026-11-25']) expect(await plan(d)).toMatchObject({ status: 'skipped', skipReason: 'injured', autoSkipped: true });
    expect((await plan('2026-11-30')).status).toBe('open');
    expect((await plan('2026-11-11')).status).toBe('open');
    // Idempotentti: toinen ajo ei muuta mitään.
    expect(await repo.applyInjurySkips()).toBe(0);

    // Palasi jo 23.11.: jakso päättyy 22.11., myöhemmät kerrat avataan.
    await repo.setInjury('p1', { start: run.start, returnDate: '2026-11-23' }, run);
    expect(await repo.injuryAt('p1', '2026-11-18')).toEqual({ start: '2026-11-16', returnDate: '2026-11-23' });
    expect((await plan('2026-11-18')).status).toBe('skipped');
    const back = await plan('2026-11-23');
    expect(back.status).toBe('open');
    expect(back.skipReason).toBeUndefined();
    expect(back.autoSkipped).toBeUndefined();

    await repo.setInjury('p1', null, { start: run.start, returnDate: '2026-11-23' });
    expect(await repo.injuryAt('p1', '2026-11-16')).toBeNull();
    expect((await plan('2026-11-16')).status).toBe('open');
  });

  it('käsin ohitettu ja kuitattu kerta eivät muutu; myöhemmin luotu kerta ohitetaan', async () => {
    const tr = await repo.createTemplateItem('p1', { activityTypeId: TRAINING, weekdays: [1], durationMin: 90, validFrom: '2026-08-01' }, WED);
    await repo.ensurePlanned('p1', '2026-11-20', WED);
    const manual = plannedSessionId(tr.id, '2026-11-16');
    await repo.skipPlanned(manual, 'injured', 'Nilkka');
    await repo.setInjury('p1', { start: '2026-11-16', returnDate: '2026-12-29' }, null);
    // Uusi viikko luodaan jakson aikana: kerta ohitetaan heti.
    await repo.ensurePlanned('p1', '2026-12-27', WED);
    expect((await db.plannedSessions.get(plannedSessionId(tr.id, '2026-12-21')))!).toMatchObject({ status: 'skipped', autoSkipped: true });
    await repo.setInjury('p1', null, { start: '2026-11-16', returnDate: '2026-12-29' });
    expect((await db.plannedSessions.get(manual))!).toMatchObject({ status: 'skipped', skipReason: 'injured', skipNote: 'Nilkka' });
    expect((await db.plannedSessions.get(plannedSessionId(tr.id, '2026-12-21')))!.status).toBe('open');
  });

  it('jakso korvaa päivän muun merkinnän eikä koske toista profiilia', async () => {
    await repo.setDayFlag('p1', '2026-11-17', 'sick');
    await repo.setDayFlag('p2', '2026-11-17', 'travel');
    await repo.setInjury('p1', { start: '2026-11-16', returnDate: '2026-11-19' }, null);
    expect((await db.dayFlags.get('f:p1:2026-11-17'))!.reason).toBe('injured');
    expect((await db.dayFlags.get('f:p2:2026-11-17'))!.reason).toBe('travel');
    expect(await repo.injuryAt('p2', '2026-11-17')).toBeNull();
  });
});
