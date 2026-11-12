// Suunnitelmien luonti viikkopohjasta (SPEC 10, "Viikkopohjan luonti").
//
// Kaksoiskappaleet estetään kahdesti: transaktion sisäisellä tarkistuksella ja
// yksilöllisellä indeksillä &[templateItemId+date]. Tunniste on johdettu
// (p:<templateItemId>:<date>), joten kaksi laitetta tuottaa saman tietueen.

import { Dexie } from 'dexie';
import { maxDate } from '../domain/dates';
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
      const by = await deviceId();
      let created = 0;
      for (const item of await activeItems(profileId)) {
        for (const date of templateItemDates(item, from, through)) {
          // Myös poistomerkityt lasketaan: poistettua suunnitelmaa ei luoda uudelleen.
          const exists = await db.plannedSessions.where('[templateItemId+date]').equals([item.id, date]).count();
          if (!exists) {
            await db.plannedSessions.add(newPlanned(item, date, nowTimestamp(), by));
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
      if (existing && !existing.deletedAt && existing.status !== 'open') continue; // kuitattu tai ohitettu säilyy
      if (existing && !existing.deletedAt && existing.overridden) continue; // yksittäin muutettu kerta säilyy
      const fresh: PlannedSession = newPlanned(item, date, nowTimestamp(), by);
      if (existing) fresh.createdAt = existing.createdAt; // sama tunniste herätetään henkiin
      await db.plannedSessions.put(fresh);
    }
  }

  return { getPlannedThrough, ensurePlanned, regenerateItem };
}
