// Kalenterimerkinnät (27.11.2026): tallennus, profiili / koko perhe, poisto ja palautus, profiilin poisto ja synkronointi.
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type Repositories } from './repositories';
import { buildBackup, buildSyncFile, mergeSyncFile, purgeProfile, toJson } from './backup';
import { noteError, noteTimeText } from '../domain/calendarNotes';
import { calendarNoteSchema } from '../domain/schemas';

let n = 0;
const dbs: AppDB[] = [];
async function device(): Promise<{ db: AppDB; repo: Repositories; id: string }> {
  const db = new AppDB(`notes-${++n}`);
  dbs.push(db);
  const repo = createRepositories(db);
  await repo.initialize();
  return { db, repo, id: await repo.deviceId() };
}
afterEach(async () => {
  while (dbs.length) await dbs.pop()!.delete();
});

const child = { name: 'Lapsi', kind: 'child' as const, birthYear: 2017, birthMonth: 5, color: '#0891b2' };

describe('kalenterimerkinnät', () => {
  it('profiilin ja koko perheen merkinnät näkyvät oikeilla profiileilla aikajärjestyksessä', async () => {
    const { repo } = await device();
    const a = await repo.createProfile(child);
    const b = await repo.createProfile({ ...child, name: 'Toinen' });
    await repo.saveCalendarNote({ profileId: a.id, date: '2026-11-27', title: ' Hammaslääkäri ', startTime: '14:30', endTime: '15:00' });
    await repo.saveCalendarNote({ date: '2026-11-27', title: 'Mummolaan', startTime: '09:00' });
    await repo.saveCalendarNote({ profileId: b.id, date: '2026-11-27', title: 'Kampaaja' });
    await repo.saveCalendarNote({ profileId: a.id, date: '2026-12-05', title: 'Myöhemmin' });

    const forA = await repo.listCalendarNotes(a.id, '2026-11-23', '2026-11-29');
    expect(forA.map((x) => x.title)).toEqual(['Mummolaan', 'Hammaslääkäri']);
    expect(forA[1]).toMatchObject({ startTime: '14:30', endTime: '15:00' });
    expect(forA[0].profileId).toBeUndefined();
    const forB = await repo.listCalendarNotes(b.id, '2026-11-23', '2026-11-29');
    expect(forB.map((x) => x.title)).toEqual(['Kampaaja', 'Mummolaan']);
  });

  it('muokkaus voi poistaa ajan ja vaihtaa koko perheeseen; poisto ja palautus', async () => {
    const { repo } = await device();
    const a = await repo.createProfile(child);
    const note = await repo.saveCalendarNote({ profileId: a.id, date: '2026-11-27', title: 'Hammaslääkäri', startTime: '14:30', endTime: '15:00' });
    const next = await repo.saveCalendarNote({ date: '2026-11-28', title: 'Hammaslääkäri' }, note.id);
    expect(next).toMatchObject({ id: note.id, date: '2026-11-28', createdAt: note.createdAt });
    expect('startTime' in next || 'endTime' in next || 'profileId' in next).toBe(false);

    await repo.deleteCalendarNote(note.id);
    expect(await repo.listCalendarNotes(a.id, '2026-11-23', '2026-11-29')).toEqual([]);
    await repo.restoreCalendarNote(note.id);
    expect((await repo.listCalendarNotes(a.id, '2026-11-23', '2026-11-29')).map((x) => x.id)).toEqual([note.id]);
  });

  it('tarkistus: nimi, päivä ja kellonajat', async () => {
    const { repo } = await device();
    expect(noteError({ date: '2026-11-27', title: '  ' })).toBe('Kirjoita merkinnän nimi');
    expect(noteError({ date: '2026-11-27', title: 'x', endTime: '10:00' })).toBe('Anna myös alkamisaika');
    expect(noteError({ date: '2026-11-27', title: 'x', startTime: '10:00', endTime: '09:00' })).toBe('Päättymisajan pitää olla alkamisajan jälkeen');
    expect(noteError({ date: '2026-11-27', title: 'x', startTime: '25:00' })).toBe('Tarkista alkamisaika');
    await expect(repo.saveCalendarNote({ date: '27.11.2026', title: 'x' })).rejects.toThrow('Tarkista päivä');
    expect(noteTimeText({ startTime: '14:30', endTime: '15:00' })).toBe('klo 14.30–15.00');
    expect(noteTimeText({})).toBe('');
  });

  it('profiilin poisto poistaa sen merkinnät; koko perheen merkintä jää', async () => {
    const { db, repo, id } = await device();
    const a = await repo.createProfile(child);
    await repo.saveCalendarNote({ profileId: a.id, date: '2026-11-27', title: 'Oma' });
    const family = await repo.saveCalendarNote({ date: '2026-11-27', title: 'Yhteinen' });
    await purgeProfile(db, a.id, id);
    const rows = await db.calendarNotes.toArray();
    expect(rows.filter((r) => !r.deletedAt).map((r) => r.id)).toEqual([family.id]);
    expect(rows.find((r) => r.id !== family.id)).not.toHaveProperty('title'); // sisältö ei jää talteen
  });

  it('siirtyy synkronoinnissa ja varmuuskopiossa, myös poisto', async () => {
    const pc = await device();
    const phone = await device();
    const a = await pc.repo.createProfile(child);
    const note = await pc.repo.saveCalendarNote({ profileId: a.id, date: '2026-11-27', title: 'Hammaslääkäri', startTime: '14:30' });
    expect((await buildBackup(pc.db)).data.calendarNotes).toHaveLength(1);

    await mergeSyncFile(phone.db, toJson(await buildSyncFile(pc.db, pc.id, 'pc')), phone.id);
    expect((await phone.repo.listCalendarNotes(a.id, '2026-11-27', '2026-11-27')).map((x) => x.title)).toEqual(['Hammaslääkäri']);

    await phone.repo.deleteCalendarNote(note.id);
    await mergeSyncFile(pc.db, toJson(await buildSyncFile(phone.db, phone.id, 'phone')), pc.id);
    expect(await pc.repo.listCalendarNotes(a.id, '2026-11-27', '2026-11-27')).toEqual([]);
  });

  it('skeema hyväksyy merkinnän ja poistomerkinnän, hylkää virheellisen ajan', () => {
    const base = { id: 'n1', date: '2026-11-27', title: 'x', createdAt: 't', updatedAt: 't', updatedBy: 'd' };
    expect(calendarNoteSchema.safeParse(base).success).toBe(true);
    expect(calendarNoteSchema.safeParse({ id: 'n1', updatedAt: 't', updatedBy: 'd', deletedAt: 't' }).success).toBe(true);
    expect(calendarNoteSchema.safeParse({ ...base, startTime: '9:00' }).success).toBe(false);
  });
});
