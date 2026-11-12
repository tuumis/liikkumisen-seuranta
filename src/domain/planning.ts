// Viikkopohjan suunnitelmien päivät ja rajat (SPEC 10, "Viikkopohjan luonti"). Puhtaita funktioita.

import { addDays, datesBetween, endOfIsoWeek, isoWeekday, maxDate, minDate } from './dates';
import { plannedSessionId } from './ids';
import type { DeviceId, ISODate, PlannedSession, TemplateItem, Timestamp } from './types';

/** Takautuvan luonnin enimmäismäärä: ei kasaa lomien jälkeen. */
export const MAX_BACKFILL_DAYS = 14;
/** Tulevia viikkoja voi selata ja suunnitella enintään näin pitkälle. */
export const MAX_WEEKS_AHEAD = 8;

/** Oletusraja: nykyisen viikon +1 sunnuntai. */
export function defaultPlanningThrough(today: ISODate): ISODate {
  return endOfIsoWeek(addDays(today, 7));
}

/** Raja selattavalle viikolle: oletus tai selattavan tulevan viikon sunnuntai (enintään +8 viikkoa). */
export function planningThroughForWeek(today: ISODate, viewedDate: ISODate): ISODate {
  const max = endOfIsoWeek(addDays(today, 7 * MAX_WEEKS_AHEAD));
  return maxDate(defaultPlanningThrough(today), minDate(endOfIsoWeek(viewedDate), max));
}

/**
 * Mistä ensurePlanned aloittaa: max(plannedThrough + 1, tänään − 14).
 * Ensimmäisellä ajolla (plannedThrough puuttuu) aloitetaan tästä päivästä,
 * jotta alkuun ei synny kuittaamatonta kasaa (vahvistettu käyttäjän kanssa).
 */
export function planningFrom(plannedThrough: ISODate | undefined, today: ISODate): ISODate {
  if (plannedThrough === undefined) return today;
  return maxDate(addDays(plannedThrough, 1), addDays(today, -MAX_BACKFILL_DAYS));
}

/** Pohjarivin suunnitelmapäivät väliltä from–through (mukaan luettuina) voimassaolon ja viikonpäivien mukaan. */
export function templateItemDates(
  item: Pick<TemplateItem, 'weekdays' | 'validFrom' | 'validTo'>,
  from: ISODate,
  through: ISODate,
): ISODate[] {
  return datesBetween(maxDate(from, item.validFrom), minDate(through, item.validTo)).filter((d) =>
    item.weekdays.includes(isoWeekday(d)),
  );
}

/** Uusi avoin suunnitelma pohjariviltä; tunniste p:<templateItemId>:<date>. */
export function newPlanned(
  item: Pick<TemplateItem, 'id' | 'profileId' | 'activityTypeId' | 'durationMin' | 'startTime' | 'label'>,
  date: ISODate,
  ts: Timestamp,
  by: DeviceId,
): PlannedSession {
  const p: PlannedSession = {
    id: plannedSessionId(item.id, date),
    profileId: item.profileId,
    activityTypeId: item.activityTypeId,
    date,
    durationMin: item.durationMin,
    templateItemId: item.id,
    status: 'open',
    createdAt: ts,
    updatedAt: ts,
    updatedBy: by,
  };
  if (item.startTime) p.startTime = item.startTime;
  if (item.label) p.label = item.label;
  return p;
}
