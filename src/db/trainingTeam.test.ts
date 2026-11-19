// Treenin joukkue (19.11.2026): seuran treenille oma joukkue viikkorytmistä, yksittäisestä suunnitelmasta,
// lisätiedoista tai kerralla merkitsemällä; yhden joukkueen treenit merkitään automaattisesti.

import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type Repositories } from './repositories';
import { sessionSchema, templateItemSchema } from '../domain/schemas';

let n = 0;
const dbs: AppDB[] = [];
async function device(): Promise<{ db: AppDB; repo: Repositories }> {
  const db = new AppDB(`team-${++n}`);
  dbs.push(db);
  const repo = createRepositories(db);
  await repo.initialize();
  return { db, repo };
}
afterEach(async () => {
  while (dbs.length) await dbs.pop()!.delete();
});

const TODAY = '2026-11-12';
const TRAINING = 't:football_training';
const base = { effort: 0 as const, muscle: false, bone: false };

describe('treenin joukkue', () => {
  it('viikkorytmin joukkue siirtyy kuitattuun treeniin', async () => {
    const { repo } = await device();
    const a = await repo.saveTeam('p1', { name: 'Seura · P11 Musta' });
    await repo.saveTeam('p1', { name: 'Seura · P12' });
    const item = await repo.createTemplateItem('p1', { activityTypeId: TRAINING, weekdays: [2], durationMin: 90, validFrom: '2026-11-02', teamId: a.id }, TODAY);
    expect(item.teamId).toBe(a.id);
    expect(templateItemSchema.safeParse(item).success).toBe(true);
    await repo.backfillTemplateItem(item.id, TODAY);
    const { session } = await repo.confirmPlanned(`p:${item.id}:2026-11-10`, TODAY);
    expect(session.teamId).toBe(a.id);
    expect(sessionSchema.safeParse(session).success).toBe(true);
    // Lisätiedot puuttuvat edelleen (joukkue on kerralla, ei lisätiedoissa).
    expect(await repo.getFootballDetails(session.id)).toBeUndefined();
  });

  it('ilman valintaa: ainoa aktiivinen joukkue, kahdella ei mitään', async () => {
    const { repo } = await device();
    const a = await repo.saveTeam('p1', { name: 'P11 Musta' });
    const s1 = await repo.createSession({ profileId: 'p1', activityTypeId: TRAINING, date: '2026-11-10', durationMin: 60, ...base });
    expect(s1.teamId).toBe(a.id);
    await repo.saveTeam('p1', { name: 'P12' });
    const s2 = await repo.createSession({ profileId: 'p1', activityTypeId: TRAINING, date: '2026-11-11', durationMin: 60, ...base });
    expect(s2.teamId).toBeUndefined();
    // Arkistoitu ei laske.
    const b = (await repo.listTeams('p1')).find((t) => t.name === 'P12')!;
    await repo.setTeamArchived(b.id, true);
    const s3 = await repo.createSession({ profileId: 'p1', activityTypeId: TRAINING, date: '2026-11-12', durationMin: 60, ...base });
    expect(s3.teamId).toBe(a.id);
    // Muu laji ei saa joukkuetta.
    const s4 = await repo.createSession({ profileId: 'p1', activityTypeId: 't:football_self', date: '2026-11-12', durationMin: 30, ...base });
    expect(s4.teamId).toBeUndefined();
  });

  it('yksittäisen suunnitelman joukkue ja lisätiedoista vaihto', async () => {
    const { db, repo } = await device();
    await repo.saveTeam('p1', { name: 'P11 Musta' });
    const b = await repo.saveTeam('p1', { name: 'P12' });
    const plan = await repo.createPlannedOnce('p1', { activityTypeId: TRAINING, date: '2026-11-11', durationMin: 75, teamId: b.id });
    expect(plan.teamId).toBe(b.id);
    const { session } = await repo.confirmPlanned(plan.id, TODAY);
    expect(session.teamId).toBe(b.id);
    await repo.setSessionTeam(session.id, undefined);
    expect((await db.sessions.get(session.id))!.teamId).toBeUndefined();
    await repo.setSessionTeam(session.id, b.id);
    // Muokkaus ilman joukkuetta säilyttää sen; lajin vaihto poistaa.
    const edited = await repo.updateSession(session.id, { activityTypeId: TRAINING, date: '2026-11-11', durationMin: 80, ...base });
    expect(edited.teamId).toBe(b.id);
    const other = await repo.updateSession(session.id, { activityTypeId: 't:football_self', date: '2026-11-11', durationMin: 80, ...base });
    expect(other.teamId).toBeUndefined();
  });

  it('aiemmat treenit kerralla joukkueelle ja kumoaminen', async () => {
    const { db, repo } = await device();
    const a = await repo.saveTeam('p1', { name: 'P11 Musta' });
    const b = await repo.saveTeam('p1', { name: 'P12' });
    for (const d of ['2026-10-01', '2026-10-15', '2026-11-05']) await repo.createSession({ profileId: 'p1', activityTypeId: TRAINING, date: d, durationMin: 60, ...base });
    const tagged = await repo.createSession({ profileId: 'p1', activityTypeId: TRAINING, date: '2026-10-20', durationMin: 60, ...base, teamId: b.id });
    expect(tagged.teamId).toBe(b.id);
    expect((await repo.trainingsWithoutTeam('p1')).map((s) => s.date)).toEqual(['2026-11-05', '2026-10-15', '2026-10-01']);
    const ids = await repo.assignTrainingsTeam('p1', a.id, '2026-10-10', TODAY);
    expect(ids).toHaveLength(2);
    expect((await repo.trainingsWithoutTeam('p1')).map((s) => s.date)).toEqual(['2026-10-01']);
    const all = await db.sessions.toArray();
    expect(all.find((s) => s.date === '2026-10-20')!.teamId).toBe(b.id); // jo merkitty ei muutu
    await repo.clearTrainingsTeam(ids);
    expect(await repo.trainingsWithoutTeam('p1')).toHaveLength(3);
  });

  it('treeniryhmä: vain treeneille, ei pelien listaan', async () => {
    const { repo } = await device();
    const team = await repo.saveTeam('p1', { name: 'P11 Musta', format: '8v8' });
    const g = await repo.saveTeam('p1', { name: 'Pienryhmävalmennus', kind: 'group', format: '8v8', playShare: 0.5 });
    expect(g).toMatchObject({ kind: 'group' });
    expect(g.format).toBeUndefined();
    expect(g.playShare).toBeUndefined();
    expect((await repo.listTeams('p1')).map((t) => t.id)).toEqual([team.id]);
    expect((await repo.listTeams('p1', { groups: true })).map((t) => t.id).sort()).toEqual([team.id, g.id].sort());
    // Joukkue + ryhmä: ei automaattista valintaa.
    const s = await repo.createSession({ profileId: 'p1', activityTypeId: TRAINING, date: '2026-11-10', durationMin: 60, ...base });
    expect(s.teamId).toBeUndefined();
    await repo.setSessionTeam(s.id, g.id);
    expect((await repo.trainingsWithoutTeam('p1')).length).toBe(0);
    // Ryhmästä joukkueeksi ja takaisin.
    const back = await repo.saveTeam('p1', { name: 'Pienryhmä', kind: 'team', format: '5v5' }, g.id);
    expect(back.kind).toBeUndefined();
    expect(back.format).toBe('5v5');
  });
});
