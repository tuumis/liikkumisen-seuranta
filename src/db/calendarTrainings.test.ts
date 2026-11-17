// Kuukausikalenterin treenit: suunnitelmat + viikkopohjasta johdetut tulevat kerrat (18.11.2026).
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type Repositories } from './repositories';
import { activityTypeId, plannedSessionId } from '../domain/ids';

let n = 0;
let db: AppDB;
let repo: Repositories;
beforeEach(async () => {
  db = new AppDB(`caltr-${++n}`);
  repo = createRepositories(db);
  await repo.initialize();
});
afterEach(async () => {
  await db.delete();
});

const TRAINING = activityTypeId('football_training');
const TODAY = '2026-11-18';

describe('kalenterin treenit', () => {
  it('suunnittelemattomat tulevat viikot johdetaan pohjasta; poistettu kerta ei palaa; mennyt ei johdeta', async () => {
    const item = await repo.createTemplateItem('p1', { activityTypeId: TRAINING, weekdays: [2, 4], startTime: '17:30', durationMin: 90, validFrom: '2026-11-01' }, TODAY);
    await repo.ensurePlanned('p1', '2026-11-29', TODAY);
    // Käyttäjä poistaa yhden suunnitellun kerran.
    await repo.deletePlanned(plannedSessionId(item.id, '2026-11-26'));

    const list = await repo.calendarTrainings('p1', '2026-11-01', '2026-12-31', TODAY);
    const dates = list.map((p) => p.date);
    expect(dates).not.toContain('2026-11-26');
    expect(dates).toContain('2026-11-24'); // suunniteltu
    expect(dates).toContain('2026-12-31'); // johdettu (to)
    expect(dates.filter((d) => d >= '2026-12-01')).toHaveLength(10); // ti + to joulukuussa
    expect(list.every((p) => p.startTime === '17:30')).toBe(true);
    // Johdettuja ei tallennettu.
    expect(await db.plannedSessions.get(plannedSessionId(item.id, '2026-12-31'))).toBeUndefined();
  });

  it('kirjatut treenit näkyvät, myös ilman suunnitelmaa; kuitattu kerran; verryttely ei omana', async () => {
    const item = await repo.createTemplateItem('p1', { activityTypeId: TRAINING, weekdays: [2], startTime: '17:30', durationMin: 90, validFrom: '2026-11-10', selfBeforeMin: 10 }, '2026-11-10');
    await repo.ensurePlanned('p1', '2026-11-22', '2026-11-10');
    // Ma 9.11. kirjattu suoraan Viikko-näkymässä (ei suunnitelmaa).
    await repo.createSession({ profileId: 'p1', activityTypeId: TRAINING, date: '2026-11-09', startTime: '18:00', durationMin: 60, effort: 0, muscle: false, bone: false });
    // Ti 10.11. suunnitelma kuitattu (luo myös linkitetyn omatoimisen verryttelyn).
    await repo.confirmPlanned(plannedSessionId(item.id, '2026-11-10'), '2026-11-10');
    // Ti 17.11. suunnitelma kuittaamatta, mutta treeni kirjattu suoraan: näkyy kerran.
    await repo.createSession({ profileId: 'p1', activityTypeId: TRAINING, date: '2026-11-17', durationMin: 90, effort: 0, muscle: false, bone: false });

    const list = await repo.calendarTrainings('p1', '2026-11-09', '2026-11-22', TODAY);
    expect(list.map((t) => [t.date, t.done])).toEqual([
      ['2026-11-09', true],
      ['2026-11-10', true],
      ['2026-11-17', true],
    ]);
  });

  it('pelit eivät ole treenejä', async () => {
    await repo.createFixture('p1', { kind: 'game', date: '2026-11-21', durationMin: 90, opponent: 'HJK' });
    expect(await repo.calendarTrainings('p1', '2026-11-01', '2026-11-30', TODAY)).toEqual([]);
  });
});
