// Suunnitelmien luonti viikkopohjasta (SPEC 10, "Viikkopohjan luonti").
//
// Kaksoiskappaleet estetään kahdesti: transaktion sisäisellä tarkistuksella ja
// yksilöllisellä indeksillä &[templateItemId+date]. Tunniste on johdettu
// (p:<templateItemId>:<date>), joten kaksi laitetta tuottaa saman tietueen.

import { Dexie } from 'dexie';
import { addDays, maxDate, minDate } from '../domain/dates';

/** Takautuvien kertojen enimmäisikä: 12 viikkoa. */
export const BACKFILL_MAX_DAYS = 84;
import { plannedSessionId } from '../domain/ids';
import { defaultPlanningThrough, newPlanned, planningFrom, templateItemDates } from '../domain/planning';
import type { DeviceId, ISODate, PlannedSession, TemplateItem, Timestamp, UUID } from '../domain/types';
import { nowTimestamp } from './clock';
import type { AppDB } from './schema';

const throughKey = (profileId: UUID) => `plannedThrough:${profileId}`;
const planKey = (itemId: UUID, date: ISODate) => `${itemId}|${date}`;

/**
 * Pohjariviltä johdetun muutoksen aikaleima: uudempi versioista + 1 ms, tekijä pohjarivistä. Molemmat
 * laitteet tuottavat saman tietueen, eikä muutos jää odottamaan siirtoa.
 */
const derivedStamp = (row: PlannedSession, item: TemplateItem): Pick<PlannedSession, 'updatedAt' | 'updatedBy'> => ({
  updatedAt: new Date(Math.max(Date.parse(row.updatedAt), Date.parse(item.updatedAt)) + 1).toISOString() as Timestamp,
  updatedBy: item.updatedBy,
});

/** Pohjarivin mukainen sisältö olemassa olevalle suunnitelmalle (tunniste ja luontiaika säilyvät). */
function fromItem(row: PlannedSession, item: TemplateItem): PlannedSession {
  const p = newPlanned(item, row.date, row.createdAt, row.updatedBy);
  return { ...p, id: row.id, createdAt: row.createdAt, ...derivedStamp(row, item) };
}

const sameContent = (a: PlannedSession, b: PlannedSession) =>
  a.activityTypeId === b.activityTypeId && a.durationMin === b.durationMin && a.startTime === b.startTime && a.label === b.label;

export function createPlanner(db: AppDB, deviceId: () => Promise<DeviceId>) {
  async function getPlannedThrough(profileId: UUID): Promise<ISODate | undefined> {
    return (await db.meta.get(throughKey(profileId)))?.value as ISODate | undefined;
  }

  /**
   * Luo pohjan suunnitelmat päivään `through` asti ja pitää tulevat avoimet suunnitelmat pohjan mukaisina.
   * Idempotentti (B1); takautuvasti enintään 14 pv (B6).
   *
   * Tulevat päivät (tästä päivästä) käydään aina läpi, ei vain `plannedThrough`-merkinnän jälkeiset:
   * toisella laitteella lisätty tai muokattu pohjarivi saapuu synkronoinnissa, eikä sen kertoja muuten
   * syntyisi päiville, jotka tämä laite on jo käynyt läpi (käyttäjän havainto 13.11.2026). Samasta syystä
   * tulevat avoimet, yksittäin muuttamattomat suunnitelmat korjataan pohjarivin nykyisen version mukaisiksi
   * (poistettu tai siirretty rivi, muuttunut kellonaika tai kesto).
   */
  async function ensurePlanned(profileId: UUID, through: ISODate, today: ISODate): Promise<number> {
    return db.transaction('rw', db.templateItems, db.plannedSessions, db.meta, async () => {
      const done = await getPlannedThrough(profileId);
      const from = minDate(planningFrom(done, today), today);
      const items = await db.templateItems.where('profileId').equals(profileId).toArray();
      const itemById = new Map(items.map((i) => [i.id, i]));
      const rows = await db.plannedSessions
        .where('[profileId+date]')
        .between([profileId, from], [profileId, Dexie.maxKey], true, true)
        .toArray();
      // Myös poistomerkityt lasketaan: käyttäjän poistamaa suunnitelmaa ei luoda uudelleen.
      const byKey = new Map<string, PlannedSession>();
      for (const p of rows) {
        if (!p.templateItemId) continue;
        const k = planKey(p.templateItemId, p.date);
        const prev = byKey.get(k);
        if (!prev || (prev.deletedAt && !p.deletedAt)) byKey.set(k, p);
      }

      let changed = 0;
      for (const item of items) {
        if (!item.active || item.deletedAt) continue;
        for (const date of templateItemDates(item, from, through)) {
          const existing = byKey.get(planKey(item.id, date));
          if (!existing) {
            // Aikaleima ja tekijä pohjarivin versiosta: molemmat laitteet tuottavat saman tietueen, eikä
            // automaattinen luonti ole "muutos" – se ei odota siirtoa eikä voita toisella laitteella
            // tehtyä muokkausta tai poistoa samaan kertaan.
            await db.plannedSessions.add(newPlanned(item, date, item.updatedAt, item.updatedBy));
            changed++;
          } else if (existing.deletedAt && !existing.overridden && existing.status === 'open' && date >= today) {
            // Järjestelmän (ei käyttäjän) poistama kerta päivältä, jonka pohjarivi nyt haluaa: esim. toisen
            // laitteen pohjamuokkaus poisti kertoja oman suunnitteluvälinsä ulkopuolelta. Herätetään henkiin.
            // Käyttäjän poistamat (overridden) eivät palaa.
            const revived = fromItem(existing, item);
            delete revived.deletedAt;
            await db.plannedSessions.put(revived);
            changed++;
          }
        }
      }

      for (const p of rows) {
        if (!p.templateItemId || p.deletedAt || p.status !== 'open' || p.overridden || p.date < today) continue;
        const item = itemById.get(p.templateItemId);
        if (!item) continue; // pohjarivi ei ole (vielä) tällä laitteella: ei kosketa
        const wanted = item.active && !item.deletedAt && templateItemDates(item, p.date, p.date).length > 0;
        if (!wanted) {
          const st = derivedStamp(p, item);
          await db.plannedSessions.put({ ...p, deletedAt: st.updatedAt, ...st });
          changed++;
          continue;
        }
        const next = fromItem(p, item);
        if (!sameContent(p, next)) {
          await db.plannedSessions.put(next);
          changed++;
        }
      }
      await db.meta.put({ key: throughKey(profileId), value: done === undefined ? through : maxDate(done, through) });
      return changed;
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
    const future = (
      await db.plannedSessions
        .where('[profileId+date]')
        .between([item.profileId, today], [item.profileId, Dexie.maxKey], true, true)
        .toArray()
    ).filter((p) => p.templateItemId === item.id && !p.deletedAt);
    // Väli kattaa myös toiselta laitteelta saapuneet kauemmas suunnitellut kerrat: niitä ei poisteta
    // vain siksi, että tämä laite ei ole vielä suunnitellut niin pitkälle.
    let through = maxDate(defaultPlanningThrough(today), await getPlannedThrough(item.profileId));
    for (const p of future) through = maxDate(through, p.date);
    const wanted = new Set(item.active && !item.deletedAt ? templateItemDates(item, today, through) : []);

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
