// Suunnitelman yksittäinen muutos ja jalkapallon päiväkirjakommentit.

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type Repositories } from './repositories';
import { activityTypeId, plannedSessionId } from '../domain/ids';

let n = 0;
let db: AppDB;
let repo: Repositories;
beforeEach(async () => {
  db = new AppDB(`diary-${++n}`);
  repo = createRepositories(db);
  await repo.initialize();
});
afterEach(async () => {
  await db.delete();
});

const TRAINING = activityTypeId('football_training');

describe('suunnitelman muutos tälle kerralle', () => {
  it('lauantain 120 min → 60 min; viikkopohjan muokkaus ei kumoa muutosta', async () => {
    const item = await repo.createTemplateItem('p1', { activityTypeId: TRAINING, weekdays: [6], durationMin: 120, validFrom: '2026-11-01' }, '2026-11-12');
    const sat = plannedSessionId(item.id, '2026-11-14');
    const changed = await repo.updatePlannedOccurrence(sat, { durationMin: 60, startTime: '09:30' });
    expect(changed).toMatchObject({ durationMin: 60, startTime: '09:30', overridden: true, status: 'open' });

    await repo.updateTemplateItem(item.id, { activityTypeId: TRAINING, weekdays: [6], durationMin: 100, validFrom: '2026-11-01' }, '2026-11-12');
    expect((await db.plannedSessions.get(sat))!.durationMin).toBe(60);
    expect((await db.plannedSessions.get(plannedSessionId(item.id, '2026-11-21')))!.durationMin).toBe(100);

    // Kuittaus käyttää muutettua kestoa.
    const r = await repo.confirmPlanned(sat, '2026-11-14');
    expect(r.session.durationMin).toBe(60);
    await expect(repo.updatePlannedOccurrence(sat, { durationMin: 30 })).rejects.toThrow();
  });

  it('kuittaus muulla kestolla säilyttää suunnitelman kestot vertailua varten', async () => {
    const item = await repo.createTemplateItem('p1', { activityTypeId: TRAINING, weekdays: [6], durationMin: 120, validFrom: '2026-11-01' }, '2026-11-12');
    const sat = plannedSessionId(item.id, '2026-11-14');
    const r = await repo.confirmPlanned(sat, '2026-11-14', { durationMin: 60 });
    expect(r.session.durationMin).toBe(60);
    expect((await db.plannedSessions.get(sat))!.durationMin).toBe(120);
  });
});

describe('jalkapallon päiväkirja', () => {
  const session = () =>
    repo.createSession({ profileId: 'p1', activityTypeId: TRAINING, date: '2026-11-10', durationMin: 75, effort: 0, muscle: false, bone: true });

  it('kommentti luo lisätiedot tarvittaessa, säilyttää rivinvaihdot ja muut tiedot', async () => {
    const s = await session();
    await repo.setFootballNote(s.id, '  Syöttöharjoituksia.\nPienpeli 4v4 meni hyvin.  ');
    expect(await repo.getFootballDetails(s.id)).toMatchObject({ attendance: 'full', ratingNote: 'Syöttöharjoituksia.\nPienpeli 4v4 meni hyvin.' });

    await repo.saveFootballDetails(s.id, { attendance: 'partial', focusTags: ['passing'], enjoyment: 3, ratingNote: 'Rivi 1\nRivi 2' });
    expect((await repo.getFootballDetails(s.id))!.ratingNote).toBe('Rivi 1\nRivi 2');
    await repo.setFootballNote(s.id, 'Uusi kommentti');
    expect(await repo.getFootballDetails(s.id)).toMatchObject({ attendance: 'partial', focusTags: ['passing'], enjoyment: 3, ratingNote: 'Uusi kommentti' });

    await repo.setFootballNote(s.id, '   ');
    expect('ratingNote' in (await repo.getFootballDetails(s.id))!).toBe(false);
  });

  it('vain jalkapallokerroille', async () => {
    const s = await repo.createSession({ profileId: 'p1', activityTypeId: activityTypeId('trampoline'), date: '2026-11-10', durationMin: 30, effort: 0, muscle: false, bone: false });
    await expect(repo.setFootballNote(s.id, 'x')).rejects.toThrow();
  });
});
