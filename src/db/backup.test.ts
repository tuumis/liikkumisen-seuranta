// Vaihe 6: varmuuskopio (C1–C4), tyhjennys (E4), synkronointi (F1–F8, F10) ja profiilin poisto.

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type Repositories, type SessionInput } from './repositories';
import {
  buildBackup,
  buildSyncFile,
  clearAll,
  importBackup,
  markSent,
  mergeSyncFile,
  pendingChanges,
  pendingCount,
  purgeProfile,
  toJson,
  type BackupFile,
} from './backup';
import { canonicalJson, dataChecksum, sha256Hex, sha256HexSync } from '../domain/checksum';
import { activityTypeId, plannedSessionId } from '../domain/ids';
import { defaultPlanningThrough } from '../domain/planning';
import { SYNCED_TABLES } from '../domain/migrations';
import { sessionsCsv } from '../domain/csv';
import { BUILT_IN_ACTIVITY_TYPES } from '../seed/activityTypes';

let n = 0;
const dbs: AppDB[] = [];
async function device(name: string): Promise<{ db: AppDB; repo: Repositories; id: string }> {
  const db = new AppDB(`backup-${name}-${++n}`);
  dbs.push(db);
  const repo = createRepositories(db);
  await repo.initialize();
  return { db, repo, id: await repo.deviceId() };
}
afterEach(async () => {
  while (dbs.length) await dbs.pop()!.delete();
});

const TRAINING = activityTypeId('football_training');
const sessionInput = (over: Partial<SessionInput & { profileId: string }> = {}) => ({
  profileId: 'p1',
  activityTypeId: TRAINING,
  date: '2026-11-10',
  durationMin: 75,
  effort: 0 as const,
  muscle: false,
  bone: true,
  ...over,
});

async function seedData(repo: Repositories) {
  const p = await repo.createProfile({ name: 'Eetu', kind: 'child', birthYear: 2017, birthMonth: 5, color: '#16a34a' });
  const s = await repo.createSession(sessionInput({ profileId: p.id }));
  await repo.saveFootballDetails(s.id, { attendance: 'full', focusTags: ['passing'], parentRating: 4, team: 'P2018 Valkoinen' });
  await repo.saveEstimate(p.id, { category: 'school_recess', label: 'Välitunnit ä ö', weekdayMin: 60, weekendMin: 0, shares: { light: 0.5, moderate: 0.25, vigorous: 0.05 } }, '2026-11-02');
  await repo.createTemplateItem(p.id, { activityTypeId: TRAINING, weekdays: [2, 4], durationMin: 90, validFrom: '2026-08-01' }, '2026-11-11');
  await repo.setDayFlag(p.id, '2026-11-09', 'sick');
  await repo.updateSettings({ vigorousDayMin: 12 });
  return { p, s };
}

async function dump(db: AppDB) {
  const out: Record<string, unknown[]> = {};
  for (const t of SYNCED_TABLES) out[t] = await db.table(t).toArray();
  out.meta = (await db.meta.toArray()).filter((m) => m.key !== 'deviceId');
  return out;
}

/** Muokkaa tiedostoa ja laske tarkistussumma uudelleen (simuloi kelvollista mutta virheellistä dataa). */
async function resign(file: BackupFile, mutate: (f: BackupFile) => void): Promise<string> {
  const f = structuredClone(file);
  mutate(f);
  f.checksum = await dataChecksum(f.data);
  return toJson(f);
}

describe('tarkistussumma', () => {
  it('puhdas SHA-256 = crypto.subtle', async () => {
    for (const s of ['', 'abc', 'ä ö å € 😄', 'x'.repeat(1000), JSON.stringify({ a: 1 })]) {
      expect(sha256HexSync(new TextEncoder().encode(s))).toBe(await sha256Hex(s));
    }
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('kanoninen JSON: avaimet aakkosjärjestyksessä', () => {
    expect(canonicalJson({ b: 1, a: { d: [{ y: 1, x: 2 }], c: undefined } })).toBe('{"a":{"d":[{"x":2,"y":1}]},"b":1}');
  });
});

describe('varmuuskopio', () => {
  it('C1: vienti → tyhjennys → tuonti → taulut samat', async () => {
    const a = await device('c1');
    await seedData(a.repo);
    const before = await dump(a.db);
    const file = await buildBackup(a.db);
    expect(file).toMatchObject({ format: 'liikkumisseuranta-backup', schemaVersion: 3, appVersion: '0.1.0' });
    expect(file.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);

    await clearAll(a.db);
    await a.repo.initialize(); // laite aloittaa alusta (uusi laitetunniste)
    await importBackup(a.db, toJson(file), () => {});
    expect(await dump(a.db)).toEqual(before);
  });

  it('profiili- ja joukkuekuva kulkevat varmuuskopiossa; ulkoinen kuvaosoite hylätään', async () => {
    const a = await device('photo');
    const photo = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgK';
    const p = await a.repo.createProfile({ name: 'A', kind: 'child', birthYear: 2018, birthMonth: 5, color: '#000', photo });
    await a.repo.saveTeam(p.id, { name: 'P2018', level: 'kilpa', photo });
    const file = await buildBackup(a.db);
    await clearAll(a.db);
    await a.repo.initialize();
    await importBackup(a.db, toJson(file), () => {});
    expect((await a.db.profiles.get(p.id))?.photo).toBe(photo);
    expect((await a.db.teams.toArray())[0].photo).toBe(photo);

    const bad = await buildBackup(a.db);
    bad.data.profiles![0] = { ...bad.data.profiles![0], photo: 'https://example.com/x.jpg' } as never;
    await expect(importBackup(a.db, toJson(bad), () => {})).rejects.toThrow();
  });

  it('C2: käsin muutettu luku → tuonti hylätään tarkistussumman takia, tietokanta ei muutu', async () => {
    const a = await device('c2');
    await seedData(a.repo);
    const text = toJson(await buildBackup(a.db)).replace('"durationMin": 75', '"durationMin": 76');
    expect(text).toContain('"durationMin": 76');
    await a.repo.createSession(sessionInput({ date: '2026-11-11' }));
    const before = await dump(a.db);
    await expect(importBackup(a.db, text, () => {})).rejects.toThrow(/Tarkistussumma/);
    expect(await dump(a.db)).toEqual(before);
  });

  it('C3: tuonnin aikana virhe → tietokanta pysyy ennallaan', async () => {
    const a = await device('c3');
    await seedData(a.repo);
    const file = await buildBackup(a.db);
    // Kelvollinen tiedosto, jossa sama sisäänrakennetun lajin avain kahdesti → &key-indeksi kaatuu kesken lisäyksen.
    const text = await resign(file, (f) => f.data.activityTypes!.push({ ...(f.data.activityTypes![0] as object), id: 'dup' }));
    await a.repo.createSession(sessionInput({ date: '2026-11-12' }));
    const before = await dump(a.db);
    await expect(importBackup(a.db, text, () => {})).rejects.toThrow();
    expect(await dump(a.db)).toEqual(before);
  });

  it('C4: ennen tuontia syntyy automaattinen varmuuskopio nykytilasta', async () => {
    const a = await device('c4');
    await seedData(a.repo);
    const old = await buildBackup(a.db);
    await a.repo.createSession(sessionInput({ date: '2026-11-13', note: 'uusin' }));
    let safety: BackupFile | undefined;
    let sessionsAtSafety = -1;
    await importBackup(a.db, toJson(old), async (f) => {
      safety = f;
      sessionsAtSafety = await a.db.sessions.count();
    });
    expect(sessionsAtSafety).toBe(2); // kutsuttiin ennen muutoksia
    expect(safety!.data.sessions!.some((s) => (s as { note?: string }).note === 'uusin')).toBe(true);
    expect(await a.db.sessions.count()).toBe(1);
  });

  it('tuonti säilyttää tämän laitteen laitekentät', async () => {
    const a = await device('dev-a');
    const b = await device('dev-b');
    await seedData(a.repo);
    await b.repo.setDeviceRole('phone');
    await importBackup(b.db, toJson(await buildBackup(a.db)), () => {});
    expect(await b.repo.deviceId()).toBe(b.id);
    expect(await b.repo.getDeviceRole()).toBe('phone');
    expect(await b.db.profiles.count()).toBe(1);
  });

  it('väärä muoto, rikki JSON ja uudempi skeemaversio hylätään', async () => {
    const a = await device('bad');
    await expect(importBackup(a.db, '{', () => {})).rejects.toThrow(/JSON/);
    await expect(importBackup(a.db, '{"format":"muu","schemaVersion":1}', () => {})).rejects.toThrow(/varmuuskopio/);
    const newer = await resign(await buildBackup(a.db), (f) => (f.schemaVersion = 4));
    await expect(importBackup(a.db, newer, () => {})).rejects.toThrow('Päivitä sovellus tällä laitteella ensin');
  });

  it('E4: "Tyhjennä kaikki tiedot" tyhjentää kaikki taulut', async () => {
    const a = await device('e4');
    await seedData(a.repo);
    await clearAll(a.db);
    for (const t of [...SYNCED_TABLES, 'meta']) expect(await a.db.table(t).count()).toBe(0);
  });

  it('CSV: yksi rivi per kerta, BOM ja puolipiste, ä ja ö säilyvät (C5)', async () => {
    const a = await device('csv');
    const { p, s } = await seedData(a.repo);
    const csv = sessionsCsv({
      profiles: [p],
      sessions: await a.db.sessions.toArray(),
      types: new Map(BUILT_IN_ACTIVITY_TYPES.map((t) => [t.id, t])),
      details: await a.repo.footballDetailsFor([s.id]),
    });
    const lines = csv.slice(1).trim().split('\r\n');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(lines).toHaveLength(2);
    expect(lines[0].startsWith('Profiili;Päivä;Laji;Kategoria;Kesto (min)')).toBe(true);
    expect(lines[1]).toBe('Eetu;10.11.2026;Jalkapallo – treeni;Harrastus;75;26;23;11;tehoprofiili;ei;kyllä;;kokonaan;P2018 Valkoinen;;;;;;4;;passing;');
  });
});

describe('synkronointi PC ↔ puhelin', () => {
  async function pair() {
    const pc = await device('pc');
    const phone = await device('phone');
    await pc.repo.setDeviceRole('pc');
    await phone.repo.setDeviceRole('phone');
    return { pc, phone };
  }
  const send = async (from: { db: AppDB; id: string }, role: 'pc' | 'phone', to: { db: AppDB; id: string }) =>
    mergeSyncFile(to.db, toJson(await buildSyncFile(from.db, from.id, role)), to.id);

  it('F6: sisäänrakennetut lajit samat molemmilla; yhdistäminen ei luo kaksoislajeja', async () => {
    const { pc, phone } = await pair();
    const r = await send(pc, 'pc', phone);
    expect(r).toMatchObject({ added: 0, updated: 0, deleted: 0 });
    expect(await phone.db.activityTypes.count()).toBe(18);
  });

  it('F1: molemmat ajavat ensurePlanned offline-tilassa → yhdistämisen jälkeen 3 suunnitelmaa, ei 6', async () => {
    const { pc, phone } = await pair();
    const item = await pc.repo.createTemplateItem('p1', { activityTypeId: TRAINING, weekdays: [2, 4], durationMin: 90, validFrom: '2026-08-01' }, '2026-11-11');
    await send(pc, 'pc', phone); // pohja puhelimelle
    await phone.db.plannedSessions.clear(); // puhelin luo itse
    await phone.repo.ensurePlanned('p1', defaultPlanningThrough('2026-11-11'), '2026-11-11');
    expect(await phone.db.plannedSessions.count()).toBe(3);
    await send(phone, 'phone', pc);
    await send(pc, 'pc', phone);
    expect(await pc.db.plannedSessions.count()).toBe(3);
    expect(await phone.db.plannedSessions.count()).toBe(3);
    expect(await pc.db.plannedSessions.get(plannedSessionId(item.id, '2026-11-12'))).toBeDefined();
  });

  it('F2: PC 80 min klo 10.00, puhelin 85 min klo 10.05 → molemmissa 85, 1 ristiriita', async () => {
    const { pc, phone } = await pair();
    const s = await pc.repo.createSession(sessionInput());
    await send(pc, 'pc', phone);
    await send(phone, 'phone', pc); // molemmat synkronoitu
    await pc.db.sessions.update(s.id, { durationMin: 80, updatedAt: '2099-01-01T10:00:00.000Z', updatedBy: pc.id });
    await phone.db.sessions.update(s.id, { durationMin: 85, updatedAt: '2099-01-01T10:05:00.000Z', updatedBy: phone.id });
    const onPc = await send(phone, 'phone', pc);
    expect(onPc.conflicts).toHaveLength(1);
    expect(onPc.conflicts[0]).toMatchObject({ table: 'sessions', key: s.id, winner: 'incoming' });
    expect(onPc.updated).toBe(1);
    const onPhone = await send(pc, 'pc', phone);
    expect(onPhone.conflicts).toHaveLength(0); // sama versio, ei enää ristiriitaa
    expect((await pc.db.sessions.get(s.id))!.durationMin).toBe(85);
    expect((await phone.db.sessions.get(s.id))!.durationMin).toBe(85);
  });

  it('F3: PC poistaa kerran → puhelimessa piilossa, eikä puhelimen lähetys palauta sitä', async () => {
    const { pc, phone } = await pair();
    const s = await pc.repo.createSession(sessionInput());
    await send(pc, 'pc', phone);
    await pc.repo.deleteSession(s.id);
    const r = await send(pc, 'pc', phone);
    expect(r.deleted).toBe(1);
    expect(await phone.repo.sessionsInRange('p1', '2026-11-01', '2026-11-30')).toEqual([]);
    await send(phone, 'phone', pc);
    expect(await pc.repo.sessionsInRange('p1', '2026-11-01', '2026-11-30')).toEqual([]);
  });

  it('F4: puhelimen 2 kirjausta säilyvät "Päivitä PC:ltä" -toiminnossa ja odottavat siirtoa', async () => {
    const { pc, phone } = await pair();
    await markSent(phone.db);
    await phone.repo.createSession(sessionInput({ date: '2026-11-10' }));
    await phone.repo.createSession(sessionInput({ date: '2026-11-11' }));
    await pc.repo.createSession(sessionInput({ date: '2026-11-12' }));
    await send(pc, 'pc', phone);
    expect(await phone.db.sessions.count()).toBe(3);
    expect(await pendingCount(phone.db, phone.id)).toBe(2);
    await markSent(phone.db);
    expect(await pendingCount(phone.db, phone.id)).toBe(0);
  });

  it('F4b: "Päivitä PC:ltä" kuittaa siirretyiksi muutokset, jotka PC:n tiedostossa jo ovat', async () => {
    const { pc, phone } = await pair();
    await markSent(phone.db);
    await phone.repo.createSession(sessionInput({ date: '2026-11-10' }));
    await phone.repo.createSession(sessionInput({ date: '2026-11-11' }));
    expect(await pendingCount(phone.db, phone.id)).toBe(2);
    await send(phone, 'phone', pc); // PC sai tiedoston (esim. jaettu ilman "Lähetä"-merkintää)
    await phone.repo.createSession(sessionInput({ date: '2026-11-12' })); // tätä PC:llä ei vielä ole
    await send(pc, 'pc', phone);
    expect(await pendingCount(phone.db, phone.id)).toBe(1);
    await send(phone, 'phone', pc);
    await send(pc, 'pc', phone);
    expect(await pendingCount(phone.db, phone.id)).toBe(0);
  });

  it('F4c: sama sisältö molemmilla laitteilla (eri aikaleimat) ei odota siirtoa', async () => {
    const { pc, phone } = await pair();
    await markSent(phone.db);
    const s = await phone.repo.createSession(sessionInput({ date: '2026-11-10' }));
    const row = (await phone.db.sessions.get(s.id))!;
    await pc.db.sessions.put({ ...row, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', updatedBy: pc.id });
    await phone.db.sessions.update(s.id, { updatedAt: '2099-01-01T00:00:00.000Z' }); // puhelimen versio uudempi, sisältö sama
    await send(pc, 'pc', phone);
    expect(await pendingCount(phone.db, phone.id)).toBe(0);
    await phone.db.sessions.update(s.id, { durationMin: 33, updatedAt: '2099-01-02T00:00:00.000Z' }); // oikea muutos
    await send(pc, 'pc', phone);
    expect(await pendingCount(phone.db, phone.id)).toBe(1);
  });

  it('F4d: sama poisto molemmilla laitteilla eri aikaan (esim. käynnistyksen siivous) ei odota siirtoa', async () => {
    const { pc, phone } = await pair();
    const s = await pc.repo.createSession(sessionInput({ date: '2026-11-10' }));
    await send(pc, 'pc', phone);
    await markSent(phone.db);
    await pc.repo.deleteSession(s.id);
    await new Promise((r) => setTimeout(r, 5));
    await phone.repo.deleteSession(s.id); // puhelin poisti saman myöhemmin
    expect(await pendingCount(phone.db, phone.id)).toBe(1);
    await send(pc, 'pc', phone);
    expect(await pendingCount(phone.db, phone.id)).toBe(0);
  });

  it('F4e: viikkorytmin automaattisesti luomat kerrat eivät odota siirtoa eivätkä kumoa PC:n muutosta', async () => {
    const { pc, phone } = await pair();
    const item = await pc.repo.createTemplateItem('p1', { activityTypeId: TRAINING, weekdays: [2, 4], durationMin: 90, validFrom: '2026-08-01' }, '2026-11-11');
    await send(pc, 'pc', phone);
    await markSent(phone.db);
    // PC jatkaa suunnitelmia ja poistaa yhden uusista kerroista; puhelin luo samat kerrat myöhemmin itse.
    await pc.repo.ensurePlanned('p1', '2026-12-06', '2026-11-11');
    const removed = plannedSessionId(item.id, '2026-12-03');
    await pc.repo.deletePlanned(removed);
    await new Promise((r) => setTimeout(r, 5));
    expect(await phone.repo.ensurePlanned('p1', '2026-12-06', '2026-11-11')).toBeGreaterThan(0);
    expect(await pendingCount(phone.db, phone.id)).toBe(0);
    await send(pc, 'pc', phone);
    expect((await phone.db.plannedSessions.get(removed))?.deletedAt).toBeDefined();
    expect(await pendingCount(phone.db, phone.id)).toBe(0);
  });

  it('F4f: puhelimella luotu ja poistettu tietue, jota PC:llä ei ole koskaan ollut, ei odota siirtoa', async () => {
    const { pc, phone } = await pair();
    await markSent(phone.db);
    const s = await phone.repo.createSession(sessionInput({ date: '2026-11-10' }));
    await phone.repo.deleteSession(s.id);
    expect(await pendingCount(phone.db, phone.id)).toBe(1);
    await send(pc, 'pc', phone);
    expect(await pendingCount(phone.db, phone.id)).toBe(0);
  });

  it('F4g: yksi puuttuva muutos ei pidä myöhempiä, jo perillä olevia odottamassa', async () => {
    const { pc, phone } = await pair();
    await markSent(phone.db);
    const missing = await phone.repo.createSession(sessionInput({ date: '2026-11-10' })); // PC:llä ei ole
    await new Promise((r) => setTimeout(r, 5));
    const there = await phone.repo.createSession(sessionInput({ date: '2026-11-11' }));
    await pc.db.sessions.put({ ...(await phone.db.sessions.get(there.id))!, updatedBy: pc.id, updatedAt: '2026-01-01T00:00:00.000Z' });
    expect(await pendingCount(phone.db, phone.id)).toBe(2);
    await send(pc, 'pc', phone);
    expect((await pendingChanges(phone.db, phone.id)).map((p) => p.key)).toEqual([missing.id]);
    expect((await pendingChanges(phone.db, phone.id))[0].there).toEqual({ state: 'missing' });
    expect(await pendingCount(phone.db, phone.id)).toBe(1);
    // Kuitattu muutos muokataan uudelleen → taas odottava.
    await phone.repo.updateSession(there.id, sessionInput({ date: '2026-11-11', durationMin: 40 }));
    expect(await pendingCount(phone.db, phone.id)).toBe(2);
    await markSent(phone.db);
    expect(await pendingCount(phone.db, phone.id)).toBe(0);
  });

  it('F4h: toiselta laitteelta tullut avoin välituntikerta siivotaan yhdistämisen jälkeen, eikä poisto jää odottamaan', async () => {
    const { pc, phone } = await pair();
    const recessEstimate = { category: 'school_recess' as const, label: 'Välitunnit', weekdayMin: 45, weekendMin: 0, shares: { light: 0.5, moderate: 0.3, vigorous: 0.1 } };
    await pc.repo.saveEstimate('p1', recessEstimate, '2026-11-02');
    const item = await pc.repo.createTemplateItem('p1', { activityTypeId: activityTypeId('school_recess'), weekdays: [1, 2, 3, 4, 5], durationMin: 45, validFrom: '2026-11-02' }, '2026-11-11');
    await send(pc, 'pc', phone);
    await markSent(phone.db);
    // PC siivoaa ensin; puhelin (vanha tieto) luo vielä ensi viikon välituntikerran ja lähettää sen PC:lle.
    await pc.repo.foldEstimateOnlySessions('2026-11-13');
    const id = plannedSessionId(item.id, '2026-11-24');
    const ts = new Date().toISOString();
    const row = { ...(await phone.db.plannedSessions.get(plannedSessionId(item.id, '2026-11-12')))!, id, date: '2026-11-24', createdAt: ts, updatedAt: ts, updatedBy: phone.id };
    await phone.db.plannedSessions.put(row);
    await send(phone, 'phone', pc);
    expect((await pc.db.plannedSessions.get(id))?.deletedAt).toBeUndefined(); // avoin kerta tuli PC:lle
    await pc.repo.foldEstimateOnlySessions('2026-11-13'); // synkronoinnin jälkeinen siivous
    expect((await pc.db.plannedSessions.get(id))?.deletedAt).toBeDefined();
    await new Promise((r) => setTimeout(r, 5));
    await phone.repo.foldEstimateOnlySessions('2026-11-13'); // puhelin siivoaa myöhemmin itse
    expect((await phone.db.plannedSessions.get(id))?.deletedAt).toBeDefined();
    await send(pc, 'pc', phone);
    expect(await pendingChanges(phone.db, phone.id)).toEqual([]);
  });

  it('F5: saman tiedoston tuonti kahdesti → toisella kerralla 0 uutta, 0 päivitettyä, 0 poistettua', async () => {
    const { pc, phone } = await pair();
    await seedData(pc.repo);
    const text = toJson(await buildSyncFile(pc.db, pc.id, 'pc'));
    const first = await mergeSyncFile(phone.db, text, phone.id);
    expect(first.added).toBeGreaterThan(0);
    const second = await mergeSyncFile(phone.db, text, phone.id);
    expect(second).toMatchObject({ added: 0, updated: 0, deleted: 0, conflicts: [] });
  });

  it('F7: uudemman skeemaversion tiedosto hylätään, data ei muutu', async () => {
    const { pc, phone } = await pair();
    await seedData(pc.repo);
    const f = await buildSyncFile(pc.db, pc.id, 'pc');
    f.schemaVersion = 4;
    f.checksum = await dataChecksum(f.data);
    const before = await dump(phone.db);
    await expect(mergeSyncFile(phone.db, toJson(f), phone.id)).rejects.toThrow('Päivitä sovellus tällä laitteella ensin');
    expect(await dump(phone.db)).toEqual(before);
  });

  it('F8: yhdistämisen aikana virhe → tietokanta pysyy ennallaan', async () => {
    const { pc, phone } = await pair();
    await seedData(pc.repo);
    await phone.repo.createSession(sessionInput({ date: '2026-11-01' }));
    const f = await buildSyncFile(pc.db, pc.id, 'pc');
    // Kaksi suunnitelmaa samalla pohjalla ja päivällä eri tunnisteilla → &[templateItemId+date] kaatuu.
    const plan = f.data.plannedSessions![0] as Record<string, unknown>;
    f.data.plannedSessions!.push({ ...plan, id: 'other-id' });
    f.checksum = await dataChecksum(f.data);
    const before = await dump(phone.db);
    await expect(mergeSyncFile(phone.db, toJson(f), phone.id)).rejects.toThrow();
    expect(await dump(phone.db)).toEqual(before);
  });

  it('F10: sama suunnitelma kuitataan molemmilla laitteilla → yhdistämisen jälkeen yksi kerta', async () => {
    const { pc, phone } = await pair();
    const item = await pc.repo.createTemplateItem('p1', { activityTypeId: TRAINING, weekdays: [2], durationMin: 90, validFrom: '2026-08-01' }, '2026-11-09');
    await send(pc, 'pc', phone);
    const planId = plannedSessionId(item.id, '2026-11-10');
    await pc.repo.confirmPlanned(planId, '2026-11-11');
    await phone.repo.confirmPlanned(planId, '2026-11-11');
    await send(phone, 'phone', pc);
    await send(pc, 'pc', phone);
    expect(await pc.db.sessions.count()).toBe(1);
    expect(await phone.db.sessions.count()).toBe(1);
  });

  it('väärän tyyppinen tiedosto hylätään', async () => {
    const { pc, phone } = await pair();
    await expect(mergeSyncFile(phone.db, toJson(await buildBackup(pc.db)), phone.id)).rejects.toThrow(/synkronointitiedosto/);
  });
});

describe('profiilin poisto', () => {
  it('tyhjennetyt poistomerkinnät: sisältö häviää ja poisto siirtyy toiselle laitteelle', async () => {
    const pc = await device('purge-pc');
    const phone = await device('purge-phone');
    const { p, s } = await seedData(pc.repo);
    await mergeSyncFile(phone.db, toJson(await buildSyncFile(pc.db, pc.id, 'pc')), phone.id);
    expect(await phone.repo.listProfiles()).toHaveLength(1);

    const n = await purgeProfile(pc.db, p.id, pc.id);
    expect(n).toBeGreaterThan(5);
    const tomb = await pc.db.profiles.get(p.id);
    expect(Object.keys(tomb!).sort()).toEqual(['deletedAt', 'id', 'updatedAt', 'updatedBy']);
    expect(Object.keys((await pc.db.footballDetails.get(s.id))!).sort()).toEqual(['deletedAt', 'sessionId', 'updatedAt', 'updatedBy']);
    expect(JSON.stringify(await pc.db.sessions.toArray())).not.toContain('P2018');
    expect(await pc.repo.listProfiles({ includeArchived: true })).toEqual([]);

    const r = await mergeSyncFile(phone.db, toJson(await buildSyncFile(pc.db, pc.id, 'pc')), phone.id);
    expect(r.deleted).toBeGreaterThan(5);
    expect(await phone.repo.listProfiles({ includeArchived: true })).toEqual([]);
    expect(JSON.stringify(await phone.db.estimates.toArray())).not.toContain('Välitunnit');
    // Poistomerkinnät läpäisevät tuonnin validoinnin.
    await expect(importBackup(phone.db, toJson(await buildBackup(pc.db)), () => {})).resolves.toBeDefined();
  });
});

beforeEach(() => {});

describe('tiedostotyypin tunnistus (iOS-tuonti)', () => {
  it('tunnistaa varmuuskopion, synkronointitiedoston, BOMin ja väärät tiedostot', async () => {
    const { detectFileKind, wrongFileMessage } = await import('./backup');
    const a = await device('kind');
    const backupText = toJson(await buildBackup(a.db));
    const syncText = toJson(await buildSyncFile(a.db, a.id, 'pc'));
    expect(detectFileKind(backupText)).toBe('backup');
    expect(detectFileKind('﻿' + syncText + '\n')).toBe('sync');
    expect(detectFileKind('Profiili;Päivä\n')).toBe('not-json');
    expect(detectFileKind('{"a":1}')).toBe('other-json');
    expect(wrongFileMessage('not-json', '<!DOCTYPE html><html>')).toMatch(/verkkosivuna/);
  });

  it('"Päivitä PC:ltä" hyväksyy myös varmuuskopion ja yhdistää sen', async () => {
    const { mergeAnyFile } = await import('./backup');
    const pc = await device('any-pc');
    const phone = await device('any-phone');
    await seedData(pc.repo);
    await phone.repo.createSession(sessionInput({ date: '2026-11-01', note: 'puhelimen oma' }));
    const r = await mergeAnyFile(phone.db, toJson(await buildBackup(pc.db)), phone.id);
    expect(r.kind).toBe('backup');
    expect(r.added).toBeGreaterThan(0);
    expect(await phone.db.sessions.count()).toBe(2); // oma kerta säilyi (yhdistys, ei korvaus)
    const s = await mergeAnyFile(phone.db, toJson(await buildSyncFile(pc.db, pc.id, 'pc')), phone.id);
    expect(s).toMatchObject({ kind: 'sync', added: 0, updated: 0, deleted: 0 });
    await expect(mergeAnyFile(phone.db, 'Profiili;Päivä', phone.id)).rejects.toThrow(/JSON/);
  });
});

describe('B7: skeemaversioiden fixturet ja migraatioketju', () => {
  it('v1-varmuuskopio (fixture) tuodaan nykyiseen versioon; uudet taulut tyhjinä', async () => {
    const text = (await import('../domain/fixtures/backup-v1.json?raw')).default;
    const a = await device('b7');
    await importBackup(a.db, text, () => {});
    expect(await a.db.sessions.get('s1')).toMatchObject({ playedMin: 40, minutes: { light: 8, moderate: 18, vigorous: 12 } });
    expect(await a.db.footballDetails.get('s1')).toMatchObject({ opponent: 'HJK', goalsFor: 3 });
    expect(await a.db.teams.count()).toBe(0);
    expect(await a.db.fixtures.count()).toBe(0);
    expect(await a.repo.getMeta('schemaVersion')).toBe(3);
    // Vanhan asetusrivin puuttuvat kentät saavat oletukset.
    expect((await a.repo.getSettings()).vigorousDayRule).toBe('age');
  });
});
