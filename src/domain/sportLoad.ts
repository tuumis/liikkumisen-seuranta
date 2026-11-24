// Urheilun kuormitus (SPEC 16, Viikon huomiot vaihe 2, 24.11.2026): ohjatun urheilun määrä, vapaapäivät,
// päälaji ja pisin tauko. Lähdetaso Tutkimus (kansainvälinen urheilulääketiede), ei Suomen virallinen suositus.
// Ohjattu urheilu = harrastus-kategorian kerrat (treenit, pelit, turnaukset); ei koululiikuntaa, ei omatoimista
// eikä treenin verryttelyä. Puhtaita funktioita.

import { addDays, datesBetween } from './dates';
import { isEstimateConfirmation } from './hours';
import type { SourceRef } from './recommendations';
import type { ActivityType, ISODate, Session, UUID } from './types';

/** Tutkimuslähteet; tarkistettu alkuperäisestä tiivistelmästä tai järjestön omalta sivulta. */
export const RESEARCH_SOURCES = {
  jayanthi2015: {
    title:
      'Jayanthi ym. 2015, American Journal of Sports Medicine 43(4): Sports-specialized intensive training and the risk of injury in young athletes (tapaus-verrokkitutkimus, 1 190 urheilijaa, 7–18 v)',
    url: 'https://europepmc.org/article/MED/25646361',
    checked: '2026-11-24',
  },
  aap2024: {
    title:
      'Yhdysvaltain lastenlääkäriyhdistys AAP: Overuse Injuries, Overtraining, and Burnout in Young Athletes (Pediatrics 2024) ja tiivistelmä vanhemmille (HealthyChildren.org)',
    url: 'https://www.healthychildren.org/English/health-issues/injuries-emergencies/sports-injuries/Pages/Preventing-Overuse-Injuries.aspx',
    checked: '2026-11-24',
  },
} as const satisfies Record<string, SourceRef>;

/** AAP: viikoittaista harjoitusmäärää lisätään kerralla enintään 10–20 %; huomio yli 20 %:n kasvusta. */
export const LOAD_INCREASE_LIMIT = 0.2;
/** Pienet erot (alle tunnin) eivät ole kasvua (sovelluksen tulkinta). */
export const LOAD_INCREASE_MIN = 60;

export function isOrganized(s: Session, types: Map<UUID, ActivityType>): boolean {
  return !s.deletedAt && !s.linkedTo && s.durationMin > 0 && !isEstimateConfirmation(s) && types.get(s.activityTypeId)?.category === 'hobby';
}

/** Ohjatun urheilun minuutit väliltä (mukaan lukien). */
export function organizedMinutes(sessions: Session[], types: Map<UUID, ActivityType>, start: ISODate, end: ISODate): number {
  return sessions.filter((s) => s.date >= start && s.date <= end && isOrganized(s, types)).reduce((a, s) => a + s.durationMin, 0);
}

/** Päivät, joilla oli ohjattua urheilua. */
export function organizedDays(sessions: Session[], types: Map<UUID, ActivityType>, start: ISODate, end: ISODate): Set<ISODate> {
  return new Set(sessions.filter((s) => s.date >= start && s.date <= end && isOrganized(s, types)).map((s) => s.date));
}

/** Lajin tunniste: saman lajin tyypit yhdessä (esim. jalkapallon treeni, peli ja turnaus). */
export const sportKey = (t: ActivityType): string => t.sport ?? t.id;
const SPORT_NAME: Record<string, string> = { football: 'Jalkapallo' };

export interface MainSport {
  key: string;
  name: string;
  /** Osuus ohjatun urheilun minuuteista. */
  share: number;
  minutes: number;
}

/** Päälaji: eniten ohjatun urheilun minuutteja. */
export function mainSport(sessions: Session[], types: Map<UUID, ActivityType>): MainSport | undefined {
  const by = new Map<string, { name: string; minutes: number }>();
  let total = 0;
  for (const s of sessions) {
    if (!isOrganized(s, types)) continue;
    const t = types.get(s.activityTypeId)!;
    const k = sportKey(t);
    const cur = by.get(k) ?? { name: SPORT_NAME[k] ?? t.name, minutes: 0 };
    cur.minutes += s.durationMin;
    by.set(k, cur);
    total += s.durationMin;
  }
  const top = [...by.entries()].sort((a, b) => b[1].minutes - a[1].minutes)[0];
  return top && total > 0 ? { key: top[0], name: top[1].name, minutes: top[1].minutes, share: top[1].minutes / total } : undefined;
}

export interface SportBreak {
  days: number;
  start: ISODate;
  end: ISODate;
}

/** Pisin yhtenäinen jakso väliltä from–to, jolloin lajia ei ollut (lajin kerrat päivinä `dates`). */
export function longestBreak(dates: ISODate[], from: ISODate, to: ISODate): SportBreak | undefined {
  if (to < from) return undefined;
  const has = new Set(dates);
  let best: SportBreak | undefined;
  let runStart: ISODate | undefined;
  for (const d of datesBetween(from, to)) {
    if (has.has(d)) {
      runStart = undefined;
      continue;
    }
    runStart ??= d;
    const days = datesBetween(runStart, d).length;
    if (!best || days > best.days) best = { days, start: runStart, end: d };
  }
  return best;
}

/** Lajin päivät (ohjattu urheilu). */
export function sportDates(sessions: Session[], types: Map<UUID, ActivityType>, key: string): ISODate[] {
  return sessions.filter((s) => isOrganized(s, types) && sportKey(types.get(s.activityTypeId)!) === key).map((s) => s.date);
}

/** Edellisten n viikon ohjatun urheilun minuutit (uusin ensin); viikko ennen seurannan alkua = undefined. */
export function previousWeeksMinutes(sessions: Session[], types: Map<UUID, ActivityType>, weekStart: ISODate, n: number, trackingStart: ISODate): (number | undefined)[] {
  return Array.from({ length: n }, (_, k) => {
    const start = addDays(weekStart, -7 * (k + 1));
    return start < trackingStart ? undefined : organizedMinutes(sessions, types, start, addDays(start, 6));
  });
}
