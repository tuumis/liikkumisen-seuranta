// Suunnitelmien luonti viikkopohjasta (SPEC 10, "Viikkopohjan luonti").
//
// Kaksoiskappaleet estetään kahdesti: transaktion sisäisellä tarkistuksella ja
// yksilöllisellä indeksillä &[templateItemId+date]. Tunniste on johdettu
// (p:<templateItemId>:<date>), joten kaksi laitetta tuottaa saman tietueen.

import { Dexie } from 'dexie';
import { addDays, maxDate } from '../domain/dates';

/** Takautuvien kertojen enimmäisikä: 12 viikkoa. */
export const BACKFILL_MAX_DAYS = 84;
import { plannedSessionId } from '../domain/ids';
import { defaultPlanningThrough, newPlanned, planningFrom, templateItemDates } from '../domain/planning';
import type { DeviceId, ISODate, PlannedSession, TemplateItem, UUID } from '../domain/types';
import { nowTimestamp } from './clock';
import type { AppDB } from './schema';

const throughKey = (profileId: UUID) => `plannedThrough:${profileId}`;

export function createPlanner(db: AppDB, deviceId: () => Promise<DeviceId>) {
  async function getPlannedThrough(profileId: UUID): Promise<ISODate | undefined> {
    return (await db.meta.get(throughKey(profileId)))?.value as ISODate | undefined;
  }

  async function activeItems(profileId: UUID): Promise<TemplateItem[]> {
    return (await db.templateItems.where('profileId').equals(profileId).toArray()).filter((i) => i.active && !i.deletedAt);
  }

  /** Luo pohjan suunnitelmat päivään `through` asti. Idempotentti (B1); takautuvasti enintään 14 pv (B6). */
  async function ensurePlanned(profileId: UUID, through: ISODate, today: ISODate): Promise<number> {
    return db.transaction('rw', db.templateItems, db.plannedSessions, db.meta, async () => {
      const done = await getPlannedThrough(profileId);
      const from = planningFrom(done, today);
      let created = 0;
      for (const item of await activeItems(profileId)) {
        for (const date of templateItemDates(item, from, through)) {
          // Myös poistomerkityt lasketaan: poistettua suunnitelmaa ei luoda uudelleen.
          const exists = await db.plannedSessions.where('[templateItemId+date]').equals([item.id, date]).count();
          if (!exists) {
            // Aikaleima ja tekijä pohjarivin versiosta: molemmat laitteet tuottavat saman tietueen, eikä
            // automaattinen luonti ole "muutos" – se ei odota siirtoa eikä voita toisella laitteella
            // tehtyä muokkausta tai poistoa samaan kertaan.
            await db.plannedSessions.add(newPlanned(item, date, item.updatedAt, item.updatedBy));
            created++;
          }
        }
      }
      await db.meta.put({ key: throughKey(profileId), value: done === undefined ? through : maxDate(done, through) });
      return created;
    });
  }

  /**
   * Pohjarivin lisäys, muokkaus tai poisto: rivin avoimet suunnitelmat, joiden
   * päivä ≥ tänään, poistetaan ja luodaan uudelleen (tästä päivästä
   * plannedThrough-päivään, vähintään ensi viikon loppuun). Menneet ja kuitatut
   * eivät muutu. Kutsutaan pohjarivin tallennuksen kanssa samassa transaktiossa.
   */
  async function regenerateItem(item: TemplateItem, today: ISODate): Promise<void> {
    const by = await deviceId();
    const through = maxDate(defaultPlanningThrough(today), await getPlannedThrough(item.profileId));
    const wanted = new Set(item.active && !item.deletedAt ? templateItemDates(item, today, through) : []);

    const future = (
      await db.plannedSessions
        .where('[profileId+date]')
        .between([item.profileId, today], [item.profileId, Dexie.maxKey], true, true)
        .toArray()
    ).filter((p) => p.templateItemId === item.id && !p.deletedAt);

    for (const p of future) {
      if (p.status === 'open' && !wanted.has(p.date)) {
        const ts = nowTimestamp();
        await db.plannedSessions.put({ ...p, deletedAt: ts, updatedAt: ts, updatedBy: by });
      }
    }
    for (const date of wanted) {
      const existing = await db.plannedSessions.get(plannedSessionId(item.id, date));
      if (existing?.deletedAt && existing.overridden) continue; // käyttäjä poisti juuri tämän kerran
      if (existing && !existing.deletedAt && existing.status !== 'open') continue; // kuitattu tai ohitettu säilyy
      if (existing && !existing.deletedAt && existing.overridden) continue; // yksittäin muutettu kerta säilyy
      const fresh: PlannedSession = newPlanned(item, date, nowTimestamp(), by);
      if (existing) fresh.createdAt = existing.createdAt; // sama tunniste herätetään henkiin
      await db.plannedSessions.put(fresh);
    }
  }

  /**
   * Takautuvat kerrat käyttäjän pyynnöstä: pohjarivin menneet päivät `from`–eilen (enintään
   * BACKFILL_MAX_DAYS taaksepäin) luodaan avoimiksi suunnitelmiksi kuitattaviksi. Olemassa olevia
   * (myös poistettuja tai kuitattuja) ei kosketa. Palauttaa luotujen määrän.
   */
  async function backfillItem(item: TemplateItem, from: ISODate, today: ISODate): Promise<number> {
    if (!item.active || item.deletedAt) return 0;
    const start = maxDate(maxDate(from, item.validFrom), addDays(today, -BACKFILL_MAX_DAYS));
    const end = addDays(today, -1);
    if (start > end) return 0;
    const by = await deviceId();
    let created = 0;
    for (const date of templateItemDates(item, start, end)) {
      const exists = await db.plannedSessions.where('[templateItemId+date]').equals([item.id, date]).count();
      if (exists) continue;
      await db.plannedSessions.add(newPlanned(item, date, nowTimestamp(), by));
      created++;
    }
    return created;
  }

  return { getPlannedThrough, ensurePlanned, regenerateItem, backfillItem };
}
